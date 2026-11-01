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
    Built-in Context-Aware AI Concierge (Smart RAG Engine) in English.
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
                'You currently have no active reservations recorded under your account.<br><br>'
                'Would you like me to curate our finest properties in <b class="text-gold-300">Bali</b>, '
                '<b class="text-gold-300">Jakarta</b>, or the <b class="text-gold-300">Maldives</b>?'
            )
        lines = [
            f'I found <b class="text-gold-300">{len(bookings)} reservation(s)</b> under your account ✦<br>'
        ]
        for b in bookings[:3]:
            status_label = "UPCOMING" if b["status"] == "upcoming" else "COMPLETED"
            lines.append(
                f'• Code <b class="text-gold-300">{b["code"]}</b> ({status_label})<br>'
                f'  <b>{b["hotel_name"]}</b> — {b["room_name"]}<br>'
                f'  📅 {b["check_in"]} → {b["check_out"]} ({b["nights"]} nights, {b["guests"]} guests)<br>'
                f'  💎 Total Paid: <b class="text-gold-300">{fmt_rp(b["total"])}</b>'
            )
        lines.append(
            "<br>Simply present your booking code to our Personal Butler upon check-in."
        )
        return "<br>".join(lines)

    # 2. Price Calculation / Quote Simulation
    if intent == "price_calculation" and quote:
        return (
            f'Here is the estimated breakdown for a <b class="text-gold-300">{quote["nights"]}-night stay</b> at '
            f'<b class="text-gold-300">{quote["hotelName"]}</b> ({quote["hotelCity"]}) ✦<br><br>'
            f'• Room Type: <b>{quote["roomName"]}</b><br>'
            f'• Nightly Rate: {fmt_rp(quote["roomPrice"])}<br>'
            f'• Subtotal ({quote["nights"]} nights): {fmt_rp(quote["subtotal"])}<br>'
            f'• VAT Tax (11%): {fmt_rp(quote["tax"])}<br>'
            f'• Service Charge (5%): {fmt_rp(quote["service"])}<br>'
            f'────────────────────────<br>'
            f'✦ <b class="text-gold-300">Estimated Total: {fmt_rp(quote["total"])}</b><br><br>'
            f'Rates include daily breakfast and complimentary cancellation up to 24 hours before check-in. '
            f'Click the button on the card below to proceed directly to booking.'
        )

    # 3. Promo & Membership
    if intent == "promo_inquiry":
        promo_items = "<br>".join(
            f'✦ <b class="text-gold-300">{p["title"]}</b> (Code: <code>{p["code"]}</code>)<br>  {p["desc"]}'
            for p in PROMOS_DATA
        )
        return (
            f"Here are the exclusive offers currently available at Aurelia Collection:<br><br>"
            f"{promo_items}<br><br>"
            f'As a <b class="text-gold-300">Gold Member</b>, you also enjoy priority late check-out and welcome amenities across all properties.'
        )

    # 4. Cancellation Policy
    if intent == "cancellation_policy":
        pol = "<br>".join(f"• {c}" for c in POLICIES_DATA["cancellation"])
        return (
            f'Here is the <b class="text-gold-300">Cancellation & Refund Policy</b> at Aurelia Collection:<br><br>'
            f"{pol}<br><br>"
            f"Is there a specific reservation you would like me to assist you with?"
        )

    # 5. Payment Methods
    if intent == "payment_policy":
        methods = "<br>".join(f"• {m}" for m in POLICIES_DATA["payment_methods"])
        return (
            f'We support a wide range of fully encrypted instant payment methods ✦<br><br>'
            f"{methods}<br><br>"
            f"Every transaction is protected by bank-grade 256-bit SSL security protocols."
        )

    # 6. Booking Guide
    if intent == "booking_guide":
        return (
            'Reserving a stay at <b class="text-gold-300">Aurelia Collection</b> is effortless ✦<br><br>'
            '1. Select your destination & stay dates on the Home page or click a recommended hotel card in this chat<br>'
            '2. Choose your preferred room, suite, or private villa<br>'
            '3. Enter guest details as shown on your ID/Passport<br>'
            '4. Choose your payment method (Credit Card, Virtual Account, or E-Wallet)<br>'
            '5. Your instant booking code <b class="text-gold-300">AUR-XXXXXX</b> is issued immediately!'
        )

    # 7. Specific Budget Queries ("above X", "below X", "around X")
    if budget_mode == "above" and min_budget is not None:
        if not matched:
            return (
                f'We currently do not have rooms priced above <b class="text-gold-300">{fmt_rp(min_budget)}</b>/night. '
                f'Our most prestigious accommodation is the <b class="text-gold-300">Sunset Grand Villa</b> at Lumière Riviera Maldives at <b class="text-gold-300">Rp 12.500.000</b>/night.'
            )
        blocks = []
        for h in matched:
            matching_rooms = [r for r in h["rooms"] if r["price"] >= min_budget]
            if not matching_rooms:
                matching_rooms = h["rooms"]
            rooms_str = ", ".join(
                f'<b>{r["name"]}</b> (<b class="text-gold-300">{fmt_rp(r["price"])}</b>/night)'
                for r in matching_rooms
            )
            blocks.append(
                f'✦ <b class="text-gold-300">{h["name"]}</b> — {h["location"]} (★ {h["rating"]})<br>'
                f'  • Matching Rooms: {rooms_str}<br>'
                f'  • Key Amenities: {", ".join(h["amenities"][:4])}'
            )
        return (
            f'Here are our luxury properties & suites priced <b class="text-gold-300">above {fmt_rp(min_budget)}</b>/night ✦<br><br>'
            + "<br><br>".join(blocks)
            + '<br><br>Click <b class="text-gold-300">Book Now →</b> on any card below to select your room.'
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
                f'<b>{r["name"]}</b> (<b class="text-gold-300">{fmt_rp(r["price"])}</b>/night)'
                for r in near_rooms
            )
            blocks.append(
                f'✦ <b class="text-gold-300">{h["name"]}</b> — {h["location"]} (★ {h["rating"]})<br>'
                f'  • Recommended Rooms: {rooms_str}<br>'
                f'  • Key Amenities: {", ".join(h["amenities"][:4])}'
            )
        return (
            f'For a budget around <b class="text-gold-300">{fmt_rp(target_budget)}</b>/night, here are the best-matching rooms & properties ✦<br><br>'
            + "<br><br>".join(blocks)
            + '<br><br>Click <b class="text-gold-300">Book Now →</b> on any card below to reserve your stay.'
        )

    if budget_mode == "below" and max_budget is not None:
        if not matched:
            cheapest = min(rag["all_hotels"], key=lambda x: x["price"])
            return (
                f'We currently do not have rooms under <b class="text-gold-300">{fmt_rp(max_budget)}</b>/night. '
                f'Our best starting rate is <b class="text-gold-300">{fmt_rp(cheapest["price"])}</b>/night at <b>{cheapest["name"]}</b> ({cheapest["location"]}).'
            )
        blocks = []
        for h in matched:
            eligible_rooms = [r for r in h["rooms"] if r["price"] <= max_budget]
            rooms_str = ", ".join(
                f'<b>{r["name"]}</b> (<b class="text-gold-300">{fmt_rp(r["price"])}</b>/night)'
                for r in (eligible_rooms or h["rooms"][:1])
            )
            blocks.append(
                f'✦ <b class="text-gold-300">{h["name"]}</b> — {h["location"]} (★ {h["rating"]})<br>'
                f'  • Room Options: {rooms_str}<br>'
                f'  • Key Amenities: {", ".join(h["amenities"][:4])}'
            )
        return (
            f'Here are our five-star properties with rates <b class="text-gold-300">under {fmt_rp(max_budget)}</b>/night ✦<br><br>'
            + "<br><br>".join(blocks)
            + "<br><br>Click any hotel card below to view details or book directly."
        )

    # 8. General Hotel Recommendations / Comparisons
    if matched:
        if len(matched) > 1:
            header = 'Here is our curated selection of <b class="text-gold-300">Aurelia Collection</b> properties tailored to your preferences ✦<br><br>'
        else:
            header = f'An exceptional choice for your stay in <b class="text-gold-300">{matched[0]["city"]}</b> ✦<br><br>'

        blocks = []
        for h in matched:
            rooms_preview = ", ".join(
                f"{r['name']} ({fmt_rp(r['price'])})" for r in h["rooms"]
            )
            blocks.append(
                f'✦ <b class="text-gold-300">{h["name"]}</b> — {h["location"]} (★ {h["rating"]})<br>'
                f'  Starting from <b class="text-gold-300">{fmt_rp(h["price"])}</b>/night<br>'
                f'  • Key Amenities: {", ".join(h["amenities"][:4])}<br>'
                f'  • Room Options: {rooms_preview}'
            )
        return (
            header
            + "<br><br>".join(blocks)
            + "<br><br>Click any hotel card below to explore the full gallery or proceed to booking."
        )

    # 9. Greeting / Thanks
    if any(k in text for k in ["hello", "hi", "hey", "good morning", "good afternoon", "good evening", "halo", "hai"]):
        return (
            'Welcome to <b class="text-gold-300">Aurelia Collection</b> ✦<br><br>'
            'I am your Aurelia Concierge. Tell me about your travel plans — such as your preferred destination (Bali, Ubud, Jakarta, Singapore, Maldives, Dubai), target budget (e.g. <i>"around 5m"</i> or <i>"above 4 million"</i>), or number of nights!'
        )

    if any(k in text for k in ["thank", "thanks", "awesome", "great", "ok", "okay", "terima kasih", "makasih"]):
        return (
            'It is my absolute pleasure ✦ I am always at your service whenever you need assistance with your stay.'
        )

    # Default comprehensive response
    return (
        'Thank you for your inquiry ✦ As your <b class="text-gold-300">Aurelia Concierge</b>, I can assist you with:<br><br>'
        '• <b>Budget-Tailored Recommendations</b> (e.g., <i>"recommend around 5m"</i>, <i>"budget above 4 million"</i>, or <i>"under 2.5 million"</i>)<br>'
        '• <b>Destination Curation</b> across Bali, Ubud, Jakarta, Singapore, Maldives, and Dubai<br>'
        '• <b>Instant Stay Quotes</b> complete with 11% VAT & 5% Service Charge<br>'
        '• <b>Reservation Lookup</b> & active booking codes<br><br>'
        'Which destination or budget range are you considering for your next stay?'
    )


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
