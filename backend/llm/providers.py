import re
from typing import Any, Dict, List, Tuple
import httpx
from llm.config import reload_env_config, runtime_config
from llm.knowledge_base import POLICIES_DATA, PROMOS_DATA, fmt_rp


def _format_llm_text_to_html(text: str) -> str:
    """Mengubah markdown (**bold** dan baris baru) dari LLM menjadi HTML rapi untuk chat UI."""
    cleaned = re.sub(
        r"\*\*(.+?)\*\*",
        r'<b class="text-gold-300">\1</b>',
        text.strip(),
    )
    cleaned = cleaned.replace("\n", "<br>")
    cleaned = re.sub(r"(<br\s*/?>\s*){3,}", "<br><br>", cleaned)
    return cleaned


def _build_gemini_contents(messages: List[Dict[str, str]]) -> List[Dict[str, Any]]:
    """
    Menyusun riwayat pesan untuk Gemini API:
    - Wajib diawali oleh role 'user' (pesan welcome awal dari 'assistant' dilewati).
    - Menggabungkan pesan berurutan dengan role yang sama agar selalu bergantian user/model.
    """
    contents: List[Dict[str, Any]] = []
    for m in messages[-10:]:
        role = "user" if m.get("role") == "user" else "model"
        content_text = re.sub(r"<[^>]+>", " ", m.get("content", "")).strip()
        if not content_text:
            continue
        # Gemini wajib memulai percakapan dengan role 'user'
        if not contents and role == "model":
            continue
        if contents and contents[-1]["role"] == role:
            contents[-1]["parts"][0]["text"] += "\n" + content_text
        else:
            contents.append({"role": role, "parts": [{"text": content_text}]})

    if not contents and messages:
        last_text = messages[-1].get("content", "").strip()
        contents.append({"role": "user", "parts": [{"text": last_text or "Halo"}]})
    return contents


async def call_gemini(system_prompt: str, messages: List[Dict[str, str]]) -> str:
    """
    Memanggil Google Gemini API (generativelanguage.googleapis.com).
    Menggunakan model aktif (gemini-3.5-flash / gemini-3.1-flash-lite) dengan thinkingBudget=0
    agar merespons cepat (~2 detik) dan tidak terkena 404 pada akun baru.
    """
    api_key = runtime_config.gemini_api_key.strip()
    contents = _build_gemini_contents(messages)

    models_to_try = []
    for m_name in [
        runtime_config.gemini_model,
        "gemini-3.5-flash",
        "gemini-3.1-flash-lite",
        "gemini-3.7-flash",
        "gemini-3.8-flash",
    ]:
        if m_name and m_name not in models_to_try and not m_name.startswith("gemini-2.5"):
            models_to_try.append(m_name)

    last_err: Exception = RuntimeError("Gemini call failed")
    async with httpx.AsyncClient(timeout=18.0) as client:
        for model in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            payload = {
                "systemInstruction": {"role": "system", "parts": [{"text": system_prompt}]},
                "contents": contents,
                "generationConfig": {
                    "temperature": runtime_config.temperature,
                    "maxOutputTokens": 2500,
                    "thinkingConfig": {"thinkingBudget": 0},
                },
            }
            try:
                resp = await client.post(url, params={"key": api_key}, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    parts = data["candidates"][0]["content"]["parts"]
                    non_thought = [p["text"] for p in parts if "text" in p and not p.get("thought")]
                    return "".join(non_thought) if non_thought else "".join(p.get("text", "") for p in parts)
                last_err = RuntimeError(f"HTTP {resp.status_code}: {resp.text[:200]}")
            except Exception as exc:
                last_err = exc
                continue

    raise last_err


async def call_openai_compatible(
    base_url: str,
    api_key: str,
    model: str,
    system_prompt: str,
    messages: List[Dict[str, str]],
) -> str:
    url = f"{base_url.rstrip('/')}/chat/completions"
    chat_msgs = [{"role": "system", "content": system_prompt}] + [
        {"role": m["role"], "content": m["content"]} for m in messages[-10:]
    ]
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": chat_msgs,
        "temperature": runtime_config.temperature,
        "max_tokens": 900,
    }
    async with httpx.AsyncClient(timeout=25.0) as client:
        resp = await client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def call_ollama(system_prompt: str, messages: List[Dict[str, str]]) -> str:
    url = f"{runtime_config.ollama_base_url.rstrip('/')}/api/chat"
    chat_msgs = [{"role": "system", "content": system_prompt}] + [
        {"role": m["role"], "content": m["content"]} for m in messages[-10:]
    ]
    payload = {
        "model": runtime_config.ollama_model,
        "messages": chat_msgs,
        "stream": False,
        "options": {"temperature": runtime_config.temperature},
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["message"]["content"]


def generate_smart_rag_response(user_message: str, rag: Dict[str, Any]) -> str:
    """
    Built-in Context-Aware AI Concierge (Smart RAG Engine).
    Memahami filter harga (di atas / di bawah / sekitar nominal tertentu),
    bahasa santai/non-baku, serta merinci tipe kamar yang sesuai budget.
    """
    text = user_message.lower().strip()
    intent = rag["intent"]
    matched = rag["matched_hotels"]
    quote = rag["price_quote"]
    bookings = rag["user_bookings"]
    budget_mode = rag.get("budget_mode")
    min_budget = rag.get("min_budget")
    max_budget = rag.get("max_budget")
    target_budget = rag.get("target_budget")

    # 1. Check user's real bookings
    if intent == "booking_check":
        if not bookings:
            return (
                'Saat ini belum ada reservasi aktif yang tercatat pada akun Anda.<br><br>'
                'Apakah Anda ingin saya bantu merekomendasikan properti terbaik kami di <b class="text-gold-300">Bali</b>, '
                '<b class="text-gold-300">Jakarta</b>, atau <b class="text-gold-300">Maldives</b>?'
            )
        lines = [
            f'Saya menemukan <b class="text-gold-300">{len(bookings)} reservasi</b> pada akun Anda ✦<br>'
        ]
        for b in bookings[:3]:
            status_label = "AKAN DATANG" if b["status"] == "upcoming" else "SELESAI"
            lines.append(
                f'• Kode <b class="text-gold-300">{b["code"]}</b> ({status_label})<br>'
                f'  <b>{b["hotel_name"]}</b> — {b["room_name"]}<br>'
                f'  📅 {b["check_in"]} → {b["check_out"]} ({b["nights"]} malam, {b["guests"]} tamu)<br>'
                f'  💎 Total Dibayar: <b class="text-gold-300">{fmt_rp(b["total"])}</b>'
            )
        lines.append(
            "<br>Tunjukkan kode booking tersebut kepada Personal Butler kami saat check-in."
        )
        return "<br>".join(lines)

    # 2. Price Calculation / Quote Simulation
    if intent == "price_calculation" and quote:
        return (
            f'Berikut simulasi rincian biaya menginap <b class="text-gold-300">{quote["nights"]} malam</b> di '
            f'<b class="text-gold-300">{quote["hotelName"]}</b> ({quote["hotelCity"]}) ✦<br><br>'
            f'• Tipe Kamar: <b>{quote["roomName"]}</b><br>'
            f'• Harga per Malam: {fmt_rp(quote["roomPrice"])}<br>'
            f'• Subtotal ({quote["nights"]} malam): {fmt_rp(quote["subtotal"])}<br>'
            f'• Pajak PPN (11%): {fmt_rp(quote["tax"])}<br>'
            f'• Service Charge (5%): {fmt_rp(quote["service"])}<br>'
            f'────────────────────────<br>'
            f'✦ <b class="text-gold-300">Estimasi Total: {fmt_rp(quote["total"])}</b><br><br>'
            f'Harga sudah termasuk sarapan pagi dan pembatalan gratis hingga 24 jam sebelum check-in. '
            f'Klik tombol pada kartu di bawah untuk langsung melanjutkan pemesanan.'
        )

    # 3. Promo & Membership
    if intent == "promo_inquiry":
        promo_items = "<br>".join(
            f'✦ <b class="text-gold-300">{p["title"]}</b> (Kode: <code>{p["code"]}</code>)<br>  {p["desc"]}'
            for p in PROMOS_DATA
        )
        return (
            f"Saat ini tersedia penawaran eksklusif di Aurelia Collection:<br><br>"
            f"{promo_items}<br><br>"
            f'Sebagai <b class="text-gold-300">Gold Member</b>, Anda juga menikmati prioritas late check-out dan welcome amenity di seluruh properti.'
        )

    # 4. Cancellation Policy
    if intent == "cancellation_policy":
        pol = "<br>".join(f"• {c}" for c in POLICIES_DATA["cancellation"])
        return (
            f'Berikut <b class="text-gold-300">Kebijakan Pembatalan & Refund</b> Aurelia Collection:<br><br>'
            f"{pol}<br><br>"
            f"Apakah ada reservasi yang ingin Anda tinjau?"
        )

    # 5. Payment Methods
    if intent == "payment_policy":
        methods = "<br>".join(f"• {m}" for m in POLICIES_DATA["payment_methods"])
        return (
            f'Kami mendukung berbagai metode pembayaran instan yang terenkripsi penuh ✦<br><br>'
            f"{methods}<br><br>"
            f"Seluruh transaksi dilindungi protokol keamanan perbankan SSL 256-bit."
        )

    # 6. Booking Guide
    if intent == "booking_guide":
        return (
            'Memesan kamar di <b class="text-gold-300">Aurelia Collection</b> sangat mudah ✦<br><br>'
            '1. Pilih destinasi & tanggal menginap di Beranda atau klik kartu rekomendasi di chat ini<br>'
            '2. Pilih tipe kamar/vila yang sesuai preferensi Anda<br>'
            '3. Isi detail tamu sesuai KTP/Paspor<br>'
            '4. Pilih metode pembayaran (Kartu Kredit, Virtual Account, atau E-Wallet)<br>'
            '5. Kode booking <b class="text-gold-300">AUR-XXXXXX</b> langsung diterbitkan seketika!'
        )

    # 7. Specific Budget Queries ("di atas X", "di bawah X", "sekitar/harga X")
    if budget_mode == "above" and min_budget is not None:
        if not matched:
            return (
                f'Saat ini belum ada kamar dengan tarif di atas <b class="text-gold-300">{fmt_rp(min_budget)}</b>/malam. '
                f'Kamar tertinggi kami adalah <b class="text-gold-300">Royal Sunset Water Residence</b> di Lumière Riviera Maldives seharga <b class="text-gold-300">Rp 9.200.000</b>/malam.'
            )
        blocks = []
        for h in matched:
            matching_rooms = [r for r in h["rooms"] if r["price"] >= min_budget]
            if not matching_rooms:
                matching_rooms = h["rooms"]
            rooms_str = ", ".join(
                f'<b>{r["name"]}</b> (<b class="text-gold-300">{fmt_rp(r["price"])}</b>/malam)'
                for r in matching_rooms
            )
            blocks.append(
                f'✦ <b class="text-gold-300">{h["name"]}</b> — {h["location"]} (★ {h["rating"]})<br>'
                f'  • Kamar Sesuai Budget Anda: {rooms_str}<br>'
                f'  • Fasilitas: {", ".join(h["amenities"][:4])}'
            )
        return (
            f'Berikut rekomendasi properti & suite mewah dengan tarif <b class="text-gold-300">di atas {fmt_rp(min_budget)}</b>/malam ✦<br><br>'
            + "<br><br>".join(blocks)
            + "<br><br>Silakan klik tombol <b class=\"text-gold-300\">Lanjut Pemesanan →</b> pada kartu di bawah untuk memilih kamar."
        )

    if budget_mode == "around" and target_budget is not None:
        low_b = int(target_budget * 0.72)
        high_b = int(target_budget * 1.35)
        blocks = []
        for h in matched:
            near_rooms = [r for r in h["rooms"] if low_b <= r["price"] <= high_b]
            if not near_rooms:
                near_rooms = [min(h["rooms"], key=lambda r: abs(r["price"] - target_budget))]
            rooms_str = ", ".join(
                f'<b>{r["name"]}</b> (<b class="text-gold-300">{fmt_rp(r["price"])}</b>/malam)'
                for r in near_rooms
            )
            blocks.append(
                f'✦ <b class="text-gold-300">{h["name"]}</b> — {h["location"]} (★ {h["rating"]})<br>'
                f'  • Tipe Kamar Rekomendasi: {rooms_str}<br>'
                f'  • Fasilitas Utama: {", ".join(h["amenities"][:4])}'
            )
        return (
            f'Untuk kisaran harga <b class="text-gold-300">{fmt_rp(target_budget)}</b>/malam, berikut pilihan kamar & properti yang paling sesuai untuk Anda ✦<br><br>'
            + "<br><br>".join(blocks)
            + "<br><br>Klik tombol <b class=\"text-gold-300\">Lanjut Pemesanan →</b> pada kartu di bawah untuk langsung memesan."
        )

    if budget_mode == "below" and max_budget is not None:
        if not matched:
            cheapest = min(rag["all_hotels"], key=lambda x: x["price"])
            return (
                f'Saat ini belum tersedia kamar di bawah <b class="text-gold-300">{fmt_rp(max_budget)}</b>/malam. '
                f'Tarif terbaik kami mulai dari <b class="text-gold-300">{fmt_rp(cheapest["price"])}</b>/malam di <b>{cheapest["name"]}</b> ({cheapest["location"]}).'
            )
        blocks = []
        for h in matched:
            eligible_rooms = [r for r in h["rooms"] if r["price"] <= max_budget]
            rooms_str = ", ".join(
                f'<b>{r["name"]}</b> (<b class="text-gold-300">{fmt_rp(r["price"])}</b>/malam)'
                for r in (eligible_rooms or h["rooms"][:1])
            )
            blocks.append(
                f'✦ <b class="text-gold-300">{h["name"]}</b> — {h["location"]} (★ {h["rating"]})<br>'
                f'  • Pilihan Kamar: {rooms_str}<br>'
                f'  • Fasilitas Utama: {", ".join(h["amenities"][:4])}'
            )
        return (
            f'Berikut rekomendasi properti bintang lima dengan tarif <b class="text-gold-300">di bawah {fmt_rp(max_budget)}</b>/malam ✦<br><br>'
            + "<br><br>".join(blocks)
            + "<br><br>Klik kartu hotel di bawah untuk melihat detail atau langsung memesan."
        )

    # 8. General Hotel Recommendations / Comparisons
    if matched:
        if len(matched) > 1:
            header = 'Berikut kurasi properti terbaik dari <b class="text-gold-300">Aurelia Collection</b> yang sesuai dengan kriteria Anda ✦<br><br>'
        else:
            header = f'Pilihan istimewa untuk Anda di <b class="text-gold-300">{matched[0]["city"]}</b> ✦<br><br>'

        blocks = []
        for h in matched:
            rooms_preview = ", ".join(
                f"{r['name']} ({fmt_rp(r['price'])})" for r in h["rooms"]
            )
            blocks.append(
                f'✦ <b class="text-gold-300">{h["name"]}</b> — {h["location"]} (★ {h["rating"]})<br>'
                f'  Mulai <b class="text-gold-300">{fmt_rp(h["price"])}</b>/malam<br>'
                f'  • Fasilitas Utama: {", ".join(h["amenities"][:4])}<br>'
                f'  • Pilihan Kamar: {rooms_preview}'
            )
        return (
            header
            + "<br><br>".join(blocks)
            + "<br><br>Anda dapat mengklik kartu hotel di bawah untuk melihat galeri lengkap atau memesan kamar secara langsung."
        )

    # 9. Greeting / Thanks
    if any(k in text for k in ["halo", "hai", "hi", "hello", "selamat", "pagi", "siang", "sore", "malam", "p", "min", "kak"]):
        return (
            'Selamat datang di <b class="text-gold-300">Aurelia Collection</b> ✦<br><br>'
            'Saya Aurelia Concierge. Silakan ceritakan rencana menginap Anda — misalnya destinasi (Bali, Ubud, Jakarta, Singapore, Maldives, Dubai), kisaran budget (misal: <i>"harga 5jt"</i> atau <i>"di atas 4 juta"</i>), atau jumlah malam menginap!'
        )

    if any(k in text for k in ["terima kasih", "thanks", "makasih", "mantap", "oke", "ok", "sip", "thank"]):
        return (
            'Dengan senang hati ✦ Merupakan kehormatan bagi saya membantu perjalanan Anda. '
            'Jangan ragu menghubungi saya kapan saja jika memerlukan bantuan tambahan.'
        )

    # Default comprehensive response
    return (
        'Terima kasih atas pertanyaan Anda ✦ Sebagai <b class="text-gold-300">Aurelia Concierge</b>, saya siap membantu Anda dengan:<br><br>'
        '• <b>Rekomendasi Sesuai Budget</b> (contoh: <i>"rekomendasi harga 5jt"</i>, <i>"budget di atas 4 juta"</i>, atau <i>"di bawah 3 juta"</i>)<br>'
        '• <b>Rekomendasi Destinasi</b> di Bali, Ubud, Jakarta, Singapore, Maldives, dan Dubai<br>'
        '• <b>Simulasi Biaya Menginap</b> otomatis lengkap dengan Pajak (11%) & Service (5%)<br>'
        '• <b>Pengecekan Status Reservasi</b> & Kode Booking aktif Anda<br><br>'
        'Kamar atau kisaran budget berapa yang sedang Anda cari?'
    )


async def generate_llm_reply(
    system_prompt: str,
    messages: List[Dict[str, str]],
    user_message: str,
    rag: Dict[str, Any],
) -> Tuple[str, str, str]:
    """
    Mengeksekusi panggilan ke provider LLM terpilih (membaca ulang backend/.env otomatis).
    Jika provider eksternal tidak dikonfigurasi atau gagal, otomatis fallback ke Smart RAG Engine.
    """
    reload_env_config()
    p = runtime_config.provider.lower()

    try:
        if p == "gemini" or (p == "auto" and runtime_config.gemini_api_key):
            if runtime_config.gemini_api_key:
                reply = await call_gemini(system_prompt, messages)
                return _format_llm_text_to_html(reply), "gemini", runtime_config.gemini_model

        if p == "openai" or (p == "auto" and runtime_config.openai_api_key):
            if runtime_config.openai_api_key:
                reply = await call_openai_compatible(
                    runtime_config.openai_base_url,
                    runtime_config.openai_api_key,
                    runtime_config.openai_model,
                    system_prompt,
                    messages,
                )
                return _format_llm_text_to_html(reply), "openai", runtime_config.openai_model

        if p == "groq" or (p == "auto" and runtime_config.groq_api_key):
            if runtime_config.groq_api_key:
                reply = await call_openai_compatible(
                    "https://api.groq.com/openai/v1",
                    runtime_config.groq_api_key,
                    runtime_config.groq_model,
                    system_prompt,
                    messages,
                )
                return _format_llm_text_to_html(reply), "groq", runtime_config.groq_model

        if p == "ollama":
            reply = await call_ollama(system_prompt, messages)
            return _format_llm_text_to_html(reply), "ollama", runtime_config.ollama_model
    except Exception as exc:
        fallback_reply = generate_smart_rag_response(user_message, rag)
        return (
            fallback_reply,
            f"smart_fallback (fallback dari {p}: {type(exc).__name__})",
            "aurelia-rag-concierge-v2",
        )

    reply = generate_smart_rag_response(user_message, rag)
    return reply, "smart_fallback", "aurelia-rag-concierge-v2"
