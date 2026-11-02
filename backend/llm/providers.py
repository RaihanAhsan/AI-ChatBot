import re
from typing import Any, Dict, List, Tuple
import httpx
from llm.config import reload_env_config, runtime_config
from llm.knowledge_base import POLICIES_DATA, PROMOS_DATA, fmt_rp


def _format_llm_text_to_html(text: str) -> str:
    """Converts markdown (**bold** and newlines) from LLM into clean HTML for chat UI."""
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
    Formats conversation history for Gemini API:
    - Must start with role 'user' (initial 'assistant' welcome message is skipped).
    - Merges consecutive messages with the same role so turns strictly alternate user/model.
    """
    contents: List[Dict[str, Any]] = []
    for m in messages[-10:]:
        role = "user" if m.get("role") == "user" else "model"
        content_text = re.sub(r"<[^>]+>", " ", m.get("content", "")).strip()
        if not content_text:
            continue
        if not contents and role == "model":
            continue
        if contents and contents[-1]["role"] == role:
            contents[-1]["parts"][0]["text"] += "\n" + content_text
        else:
            contents.append({"role": role, "parts": [{"text": content_text}]})

    if not contents and messages:
        last_text = messages[-1].get("content", "").strip()
        contents.append({"role": "user", "parts": [{"text": last_text or "Hello"}]})
    return contents


async def call_gemini(system_prompt: str, messages: List[Dict[str, str]]) -> str:
    """
    Calls Google Gemini API (generativelanguage.googleapis.com).
    Uses active models (gemini-3.5-flash / gemini-3.1-flash-lite) with thinkingBudget=0
    for fast ~2s responses without 404 errors on new accounts.
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
    Built-in Context-Aware AI Concierge (Smart RAG Engine) supporting 4 languages:
    Indonesian ('id'), English ('en'), Japanese ('ja'), and Chinese ('zh').
    """
    lang = rag.get("language", "en")
    text = user_message.lower().strip()
    intent = rag["intent"]
    matched = rag["matched_hotels"]
    checkout = rag.get("booking_checkout")
    bookings = rag["user_bookings"]
    budget_mode = rag.get("budget_mode")
    min_budget = rag.get("min_budget")
    max_budget = rag.get("max_budget")
    target_budget = rag.get("target_budget")

    # 1. Check user's real bookings (4 languages)
    if intent == "booking_check":
        if not bookings:
            return {
                "id": 'Saat ini belum ada reservasi aktif yang tercatat pada akun Anda.<br><br>Apakah Anda ingin saya merekomendasikan properti terbaik kami di <b class="text-gold-300">Bali</b>, <b class="text-gold-300">Jakarta</b>, atau <b class="text-gold-300">Maldives</b>?',
                "ja": '現在、お客様のアカウントには有効なご予約が登録されておりません。<br><br><b class="text-gold-300">バリ島</b>、<b class="text-gold-300">ジャカルタ</b>、または<b class="text-gold-300">モルディブ</b>の最高級ホテルをご案内いたしましょうか？',
                "zh": '目前您的账户下暂无有效预订记录。<br><br>需要我为您推荐我们在<b class="text-gold-300">巴厘岛</b>、<b class="text-gold-300">雅加达</b>或<b class="text-gold-300">马尔代夫</b>的五星级酒店吗？',
                "en": 'You currently have no active reservations recorded under your account.<br><br>Would you like me to curate our finest properties in <b class="text-gold-300">Bali</b>, <b class="text-gold-300">Jakarta</b>, or the <b class="text-gold-300">Maldives</b>?',
            }.get(lang, "")

        header_map = {
            "id": f'Ditemukan <b class="text-gold-300">{len(bookings)} reservasi</b> pada akun Anda ✦<br>',
            "ja": f'お客様のアカウントで <b class="text-gold-300">{len(bookings)}件のご予約</b> が確認できました ✦<br>',
            "zh": f'在您的账户下找到了 <b class="text-gold-300">{len(bookings)} 笔预订</b> ✦<br>',
            "en": f'I found <b class="text-gold-300">{len(bookings)} reservation(s)</b> under your account ✦<br>',
        }
        lines = [header_map.get(lang, header_map["en"])]
        for b in bookings[:4]:
            lines.append(
                f'• Code <b class="text-gold-300">{b["code"]}</b> ({b["status"].upper()})<br>'
                f'  <b>{b["hotel_name"]}</b> — {b["room_name"]}<br>'
                f'  📅 {b["check_in"]} → {b["check_out"]} ({b["nights"]} nights, {b["guests"]} guests)<br>'
                f'  💎 Total: <b class="text-gold-300">{fmt_rp(b["total"])}</b>'
            )
        return "<br>".join(lines)

    # 2. Multi-Stay Itinerary or Direct Chat Booking Checkout (4 languages)
    if checkout and (intent in ("direct_booking_checkout", "price_calculation") or checkout.get("isMultiStay")):
        items = checkout["items"]
        if len(items) > 1:
            leg_lines = []
            for idx, item in enumerate(items, start=1):
                if lang == "id":
                    leg_lines.append(
                        f'✦ <b class="text-gold-300">Stay #{idx}: {item["hotelName"]} ({item["hotelCity"]})</b><br>'
                        f'  • Kamar: <b>{item["roomName"]}</b> ({fmt_rp(item["roomPrice"])}/malam)<br>'
                        f'  • Tanggal: 📅 {item["checkIn"]} → {item["checkOut"]} (<b>{item["nights"]} malam</b>, {item["guests"]} tamu)<br>'
                        f'  • Subtotal: {fmt_rp(item["subtotal"])} | PPN 11%: {fmt_rp(item["tax"])} | Service 5%: {fmt_rp(item["service"])}<br>'
                        f'  • Total Stay #{idx}: <b class="text-gold-300">{fmt_rp(item["total"])}</b>'
                    )
                elif lang == "ja":
                    leg_lines.append(
                        f'✦ <b class="text-gold-300">滞在 #{idx}: {item["hotelName"]} ({item["hotelCity"]})</b><br>'
                        f'  • 客室: <b>{item["roomName"]}</b> ({fmt_rp(item["roomPrice"])}/泊)<br>'
                        f'  • 日程: 📅 {item["checkIn"]} → {item["checkOut"]} (<b>{item["nights"]}泊</b>・{item["guests"]}名様)<br>'
                        f'  • 小計: {fmt_rp(item["subtotal"])} | 税金11%: {fmt_rp(item["tax"])} | サービス料5%: {fmt_rp(item["service"])}<br>'
                        f'  • 滞在 #{idx} 合計: <b class="text-gold-300">{fmt_rp(item["total"])}</b>'
                    )
                elif lang == "zh":
                    leg_lines.append(
                        f'✦ <b class="text-gold-300">行程 #{idx}: {item["hotelName"]} ({item["hotelCity"]})</b><br>'
                        f'  • 房型: <b>{item["roomName"]}</b> ({fmt_rp(item["roomPrice"])}/晚)<br>'
                        f'  • 日期: 📅 {item["checkIn"]} → {item["checkOut"]} (<b>{item["nights"]}晚</b>, {item["guests"]}位宾客)<br>'
                        f'  • 小计: {fmt_rp(item["subtotal"])} | 税费11%: {fmt_rp(item["tax"])} | 服务费5%: {fmt_rp(item["service"])}<br>'
                        f'  • 行程 #{idx} 总计: <b class="text-gold-300">{fmt_rp(item["total"])}</b>'
                    )
                else:
                    leg_lines.append(
                        f'✦ <b class="text-gold-300">Stay #{idx}: {item["hotelName"]} ({item["hotelCity"]})</b><br>'
                        f'  • Room: <b>{item["roomName"]}</b> ({fmt_rp(item["roomPrice"])}/night)<br>'
                        f'  • Dates: 📅 {item["checkIn"]} → {item["checkOut"]} (<b>{item["nights"]} nights</b>, {item["guests"]} guests)<br>'
                        f'  • Subtotal: {fmt_rp(item["subtotal"])} | VAT 11%: {fmt_rp(item["tax"])} | Service 5%: {fmt_rp(item["service"])}<br>'
                        f'  • Stay #{idx} Total: <b class="text-gold-300">{fmt_rp(item["total"])}</b>'
                    )

            if lang == "id":
                return (
                    f'Berikut rincian <b class="text-gold-300">Itinerary Multi-Kota {checkout["totalNights"]} Malam ({checkout["totalStays"]} Hotel)</b> Anda ✦<br><br>'
                    + "<br><br>".join(leg_lines)
                    + "<br><br>────────────────────────<br>"
                    + f'• Subtotal Gabungan ({checkout["totalNights"]} malam): {fmt_rp(checkout["grandSubtotal"])}<br>'
                    + f'• Pajak PPN (11%): {fmt_rp(checkout["grandTax"])}<br>'
                    + f'• Biaya Layanan / Service (5%): {fmt_rp(checkout["grandService"])}<br>'
                    + f'✦ <b class="text-gold-300">Grand Total saat Checkout: {fmt_rp(checkout["grandTotal"])}</b><br><br>'
                    + 'Silakan klik tombol <b class="text-gold-300">🔒 Proceed Directly to Payment</b> pada kartu di bawah untuk langsung menuju halaman pembayaran dan menyimpan seluruh pesanan ke database.'
                )
            if lang == "ja":
                return (
                    f'ご希望の <b class="text-gold-300">{checkout["totalNights"]}泊 マルチ都市ご滞在プラン（計{checkout["totalStays"]}ホテル）</b> のお見積もりをご用意いたしました ✦<br><br>'
                    + "<br><br>".join(leg_lines)
                    + "<br><br>────────────────────────<br>"
                    + f'• 合計小計 ({checkout["totalNights"]}泊): {fmt_rp(checkout["grandSubtotal"])}<br>'
                    + f'• 付加価値税 (11%): {fmt_rp(checkout["grandTax"])}<br>'
                    + f'• サービス料 (5%): {fmt_rp(checkout["grandService"])}<br>'
                    + f'✦ <b class="text-gold-300">お支払い総額 (Grand Total): {fmt_rp(checkout["grandTotal"])}</b><br><br>'
                    + '下のカードにある <b class="text-gold-300">🔒 Proceed Directly to Payment</b> ボタンをクリックすると、直接お支払いページへ進み、すべてのご予約がデータベースに保存されます。'
                )
            if lang == "zh":
                return (
                    f'已为您准备好 <b class="text-gold-300">{checkout["totalNights"]}晚多城市行程方案（共{checkout["totalStays"]}家酒店）</b> 的费用明细 ✦<br><br>'
                    + "<br><br>".join(leg_lines)
                    + "<br><br>────────────────────────<br>"
                    + f'• 合计小计 ({checkout["totalNights"]}晚): {fmt_rp(checkout["grandSubtotal"])}<br>'
                    + f'• 增值税 (11%): {fmt_rp(checkout["grandTax"])}<br>'
                    + f'• 服务费 (5%): {fmt_rp(checkout["grandService"])}<br>'
                    + f'✦ <b class="text-gold-300">结账总计 (Grand Total): {fmt_rp(checkout["grandTotal"])}</b><br><br>'
                    + '请点击下方卡片中的 <b class="text-gold-300">🔒 Proceed Directly to Payment</b> 按钮直接前往付款页面，所有预订将立即保存至数据库。'
                )
            return (
                f'I have prepared your <b class="text-gold-300">{checkout["totalNights"]}-Night Multi-Destination Itinerary ({checkout["totalStays"]} Stays)</b> ✦<br><br>'
                + "<br><br>".join(leg_lines)
                + "<br><br>────────────────────────<br>"
                + f'• Combined Subtotal ({checkout["totalNights"]} nights): {fmt_rp(checkout["grandSubtotal"])}<br>'
                + f'• Combined VAT Tax (11%): {fmt_rp(checkout["grandTax"])}<br>'
                + f'• Combined Service Charge (5%): {fmt_rp(checkout["grandService"])}<br>'
                + f'✦ <b class="text-gold-300">Grand Total at Checkout: {fmt_rp(checkout["grandTotal"])}</b><br><br>'
                + 'Your itinerary is ready for checkout! Click <b class="text-gold-300">🔒 Proceed Directly to Payment</b> on the card below to complete your payment and save all reservations directly to your account.'
            )
        else:
            item = items[0]
            if lang == "id":
                return (
                    f'Berikut rincian reservasi & checkout untuk menginap <b class="text-gold-300">{item["nights"]} malam</b> di '
                    f'<b class="text-gold-300">{item["hotelName"]}</b> ({item["hotelCity"]}) ✦<br><br>'
                    f'• Tipe Kamar: <b>{item["roomName"]}</b><br>'
                    f'• Tanggal: 📅 {item["checkIn"]} → {item["checkOut"]}<br>'
                    f'• Harga per Malam: {fmt_rp(item["roomPrice"])}<br>'
                    f'• Subtotal ({item["nights"]} malam): {fmt_rp(item["subtotal"])}<br>'
                    f'• Pajak PPN (11%): {fmt_rp(item["tax"])}<br>'
                    f'• Service Charge (5%): {fmt_rp(item["service"])}<br>'
                    f'────────────────────────<br>'
                    f'✦ <b class="text-gold-300">Total Pembayaran: {fmt_rp(item["total"])}</b><br><br>'
                    f'Klik tombol <b class="text-gold-300">🔒 Proceed Directly to Payment</b> di bawah untuk langsung menuju halaman pembayaran.'
                )
            if lang == "ja":
                return (
                    f'<b class="text-gold-300">{item["hotelName"]}</b> ({item["hotelCity"]}) での <b class="text-gold-300">{item["nights"]}泊</b> のお見積もり・ご予約内容は以下の通りです ✦<br><br>'
                    f'• 客室タイプ: <b>{item["roomName"]}</b><br>'
                    f'• 日程: 📅 {item["checkIn"]} → {item["checkOut"]}<br>'
                    f'• 1泊料金: {fmt_rp(item["roomPrice"])}<br>'
                    f'• 小計 ({item["nights"]}泊): {fmt_rp(item["subtotal"])}<br>'
                    f'• 税金 (11%): {fmt_rp(item["tax"])}<br>'
                    f'• サービス料 (5%): {fmt_rp(item["service"])}<br>'
                    f'────────────────────────<br>'
                    f'✦ <b class="text-gold-300">お支払い総額: {fmt_rp(item["total"])}</b><br><br>'
                    f'下の <b class="text-gold-300">🔒 Proceed Directly to Payment</b> ボタンをクリックして直接お支払いへお進みください。'
                )
            if lang == "zh":
                return (
                    f'以下是您在 <b class="text-gold-300">{item["hotelName"]}</b> ({item["hotelCity"]}) 入住 <b class="text-gold-300">{item["nights"]}晚</b> 的预订与结账明细 ✦<br><br>'
                    f'• 房型: <b>{item["roomName"]}</b><br>'
                    f'• 日期: 📅 {item["checkIn"]} → {item["checkOut"]}<br>'
                    f'• 每晚房价: {fmt_rp(item["roomPrice"])}<br>'
                    f'• 小计 ({item["nights"]}晚): {fmt_rp(item["subtotal"])}<br>'
                    f'• 增值税 (11%): {fmt_rp(item["tax"])}<br>'
                    f'• 服务费 (5%): {fmt_rp(item["service"])}<br>'
                    f'────────────────────────<br>'
                    f'✦ <b class="text-gold-300">应付总额: {fmt_rp(item["total"])}</b><br><br>'
                    f'请点击下方卡片中的 <b class="text-gold-300">🔒 Proceed Directly to Payment</b> 按钮直接前往付款页面。'
                )
            return (
                f'Here is your reservation & checkout summary for a <b class="text-gold-300">{item["nights"]}-night stay</b> at '
                f'<b class="text-gold-300">{item["hotelName"]}</b> ({item["hotelCity"]}) ✦<br><br>'
                f'• Room Type: <b>{item["roomName"]}</b><br>'
                f'• Check-in / Check-out: 📅 {item["checkIn"]} → {item["checkOut"]}<br>'
                f'• Nightly Rate: {fmt_rp(item["roomPrice"])}<br>'
                f'• Subtotal ({item["nights"]} nights): {fmt_rp(item["subtotal"])}<br>'
                f'• VAT Tax (11%): {fmt_rp(item["tax"])}<br>'
                f'• Service Charge (5%): {fmt_rp(item["service"])}<br>'
                f'────────────────────────<br>'
                f'✦ <b class="text-gold-300">Total Due at Checkout: {fmt_rp(item["total"])}</b><br><br>'
                f'Click <b class="text-gold-300">🔒 Proceed Directly to Payment</b> on the checkout card below to complete payment and record your booking directly into the database.'
            )

    # 3. Promo & Membership
    if intent == "promo_inquiry":
        promo_items = "<br>".join(
            f'✦ <b class="text-gold-300">{p["title"]}</b> (Code: <code>{p["code"]}</code>)<br>  {p["desc"]}'
            for p in PROMOS_DATA
        )
        intro = {
            "id": "Berikut promo eksklusif yang sedang berlaku di Aurelia Collection:<br><br>",
            "ja": "現在 Aurelia Collection でご利用いただける特別プロモーションはこちらです：<br><br>",
            "zh": "以下是 Aurelia Collection 当前提供的专属优惠活动：<br><br>",
            "en": "Here are the exclusive offers currently available at Aurelia Collection:<br><br>",
        }.get(lang, "")
        return intro + promo_items

    # 4. Cancellation Policy
    if intent == "cancellation_policy":
        pol = "<br>".join(f"• {c}" for c in POLICIES_DATA["cancellation"])
        intro = {
            "id": 'Berikut <b class="text-gold-300">Kebijakan Pembatalan & Refund</b> di Aurelia Collection:<br><br>',
            "ja": 'Aurelia Collection の<b class="text-gold-300">キャンセルおよび返金ポリシー</b>は以下の通りです：<br><br>',
            "zh": '以下是 Aurelia Collection 的<b class="text-gold-300">取消与退款政策</b>：<br><br>',
            "en": 'Here is the <b class="text-gold-300">Cancellation & Refund Policy</b> at Aurelia Collection:<br><br>',
        }.get(lang, "")
        return intro + pol

    # 5. Payment Methods
    if intent == "payment_policy":
        methods = "<br>".join(f"• {m}" for m in POLICIES_DATA["payment_methods"])
        intro = {
            "id": "Kami mendukung berbagai metode pembayaran instan berenkripsi penuh ✦<br><br>",
            "ja": "当コレクションでは、暗号化された安全な各種お支払い方法をご利用いただけます ✦<br><br>",
            "zh": "我们支持多种银行级加密的即时支付方式 ✦<br><br>",
            "en": "We support a wide range of fully encrypted instant payment methods ✦<br><br>",
        }.get(lang, "")
        return intro + methods

    # 6. Specific Budget Queries ("above X", "below X", "around X")
    if budget_mode and (min_budget or max_budget or target_budget):
        blocks = []
        for h in matched:
            rooms_str = ", ".join(
                f'<b>{r["name"]}</b> (<b class="text-gold-300">{fmt_rp(r["price"])}</b>/night)'
                for r in h["rooms"]
            )
            blocks.append(
                f'✦ <b class="text-gold-300">{h["name"]}</b> — {h["location"]} (★ {h["rating"]})<br>'
                f'  • Rooms: {rooms_str}<br>'
                f'  • Amenities: {", ".join(h["amenities"][:4])}'
            )
        header = {
            "id": "Berikut rekomendasi hotel & kamar bintang lima yang sesuai dengan budget Anda ✦<br><br>",
            "ja": "ご予算に合わせたおすすめの5つ星ホテル＆スイートはこちらです ✦<br><br>",
            "zh": "以下是符合您预算的五星级酒店与套房推荐 ✦<br><br>",
            "en": "Here are the best-matching five-star hotels & rooms for your budget ✦<br><br>",
        }.get(lang, "")
        return header + "<br><br>".join(blocks)

    # 7. General Hotel Recommendations
    if matched:
        header = {
            "id": 'Berikut kurasi properti <b class="text-gold-300">Aurelia Collection</b> pilihan untuk Anda ✦<br><br>',
            "ja": '<b class="text-gold-300">Aurelia Collection</b> より厳選したおすすめホテルをご案内いたします ✦<br><br>',
            "zh": '为您精选以下 <b class="text-gold-300">Aurelia Collection</b> 奢华酒店 ✦<br><br>',
            "en": 'Here is our curated selection of <b class="text-gold-300">Aurelia Collection</b> properties tailored to your preferences ✦<br><br>',
        }.get(lang, "")
        blocks = []
        for h in matched:
            rooms_preview = ", ".join(
                f"{r['name']} ({fmt_rp(r['price'])})" for r in h["rooms"]
            )
            blocks.append(
                f'✦ <b class="text-gold-300">{h["name"]}</b> — {h["location"]} (★ {h["rating"]})<br>'
                f'  Starting from <b class="text-gold-300">{fmt_rp(h["price"])}</b>/night<br>'
                f'  • Amenities: {", ".join(h["amenities"][:4])}<br>'
                f'  • Rooms: {rooms_preview}'
            )
        return header + "<br><br>".join(blocks)

    # 8. Default multilingual response
    return {
        "id": (
            'Selamat datang di <b class="text-gold-300">Aurelia Collection</b> ✦<br><br>'
            'Saya Aurelia Concierge. Anda dapat memesan langsung via chat (termasuk multi-kota seperti <i>"Pesan 1 minggu: 2 hari di Jakarta dan 5 hari di Bali"</i>), menanyakan rekomendasi sesuai budget, atau memeriksa status reservasi Anda.'
        ),
        "ja": (
            '<b class="text-gold-300">Aurelia Collection</b> へようこそ ✦<br><br>'
            '専属AIバトラーの Aurelia Concierge でございます。チャットから直接ホテルのご予約（例：<i>「ジャカルタで2泊、バリ島で5泊予約したい」</i>などの複数都市プランも対応）、料金のお見積もり、ご予約状況の確認を承ります。'
        ),
        "zh": (
            '欢迎光临 <b class="text-gold-300">Aurelia Collection</b> ✦<br><br>'
            '我是您的专属 AI 礼宾管家 Aurelia Concierge。您可以直接在聊天中预订酒店（支持多城市行程，例如：<i>“预订1周：雅加达2晚，巴厘岛5晚”</i>）、计算税费总价或查询您的预订状态。'
        ),
        "en": (
            'Welcome to <b class="text-gold-300">Aurelia Collection</b> ✦<br><br>'
            'I am your Aurelia Concierge. You can book single or multi-city itineraries directly via chat (e.g., <i>"Book 1 week: 2 days in Jakarta and 5 days in Bali"</i>), filter hotels by budget, or check your reservation status.'
        ),
    }.get(lang, "")


async def generate_llm_reply(
    system_prompt: str,
    messages: List[Dict[str, str]],
    user_message: str,
    rag: Dict[str, Any],
) -> Tuple[str, str, str]:
    """
    Executes call to the configured LLM provider (auto-reloading backend/.env).
    Falls back gracefully to Smart RAG Engine if external provider is unconfigured or unreachable.
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
            f"smart_fallback (fallback from {p}: {type(exc).__name__})",
            "aurelia-rag-concierge-v2",
        )

    reply = generate_smart_rag_response(user_message, rag)
    return reply, "smart_fallback", "aurelia-rag-concierge-v2"
