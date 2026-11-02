import re
import time
from typing import Any, Dict, List
from llm.config import runtime_config
from llm.knowledge_base import (
    _extract_explicit_duration,
    _normalize_cjk_numbers,
    build_booking_checkout,
    build_rag_analysis,
)
from llm.prompts import AURELIA_SYSTEM_PROMPT
from llm.providers import generate_llm_reply


def get_dynamic_quick_replies(
    lang: str,
    intent: str,
    matched_hotels: List[Dict[str, Any]],
    booking_checkout: Any = None,
) -> List[str]:
    if lang == "id":
        if booking_checkout:
            return [
                "Konfirmasi & lanjut ke pembayaran",
                "Pesan 1 minggu: 2 hari di Jakarta, 5 hari di Bali",
                "Metode pembayaran apa saja?",
                "Cek status reservasi saya",
            ]
        return [
            "Pesan 1 minggu: 2 hari di Jakarta, 5 hari di Bali",
            "Rekomendasi hotel di Bali",
            "Hitung biaya 3 malam di Maldives",
            "Hotel budget 5 juta",
            "Cek status reservasi saya",
        ]

    if lang == "ja":
        if booking_checkout:
            return [
                "予約を確定して支払いへ進む",
                "1週間予約：ジャカルタ2泊、バリ島5泊",
                "支払い方法を教えてください",
                "予約状況を確認する",
            ]
        return [
            "1週間予約：ジャカルタ2泊、バリ島5泊",
            "バリ島のおすすめホテル",
            "モルディブ3泊の料金を計算",
            "予算500万ルピア前後のホテル",
            "予約状況を確認する",
        ]

    if lang == "zh":
        if booking_checkout:
            return [
                "确认预订并前往付款",
                "预订1周：雅加达2晚，巴厘岛5晚",
                "支持哪些支付方式？",
                "查询我的预订状态",
            ]
        return [
            "预订1周：雅加达2晚，巴厘岛5晚",
            "推荐巴厘岛的奢华酒店",
            "计算马尔代夫3晚总费用",
            "预算500万印尼盾左右的酒店",
            "查询我的预订状态",
        ]

    # Default: English ('en')
    if booking_checkout:
        return [
            "Confirm & proceed to payment",
            "Book 1 week: 2 days in Jakarta, 5 days in Bali",
            "What payment methods are accepted?",
            "Check my reservation status",
        ]
    if intent == "hotel_recommendation" and matched_hotels:
        h = matched_hotels[0]
        return [
            f"Book 3 nights at {h['name']}",
            "Book 1 week: 2 days in Jakarta, 5 days in Bali",
            "Hotels under Rp 2,500,000",
            "Check my reservation status",
        ]
    return [
        "Book 1 week: 2 days in Jakarta, 5 days in Bali",
        "Recommended hotels in Bali",
        "Calculate 3 nights in Maldives",
        "Hotels around Rp 5,000,000",
        "Check my reservation status",
    ]


async def process_chat_message(
    messages: List[Dict[str, str]],
    user_email: str = "demo@aurelia.com",
) -> Dict[str, Any]:
    start_ts = time.perf_counter()

    latest_user_msg = ""
    for m in reversed(messages):
        if m.get("role") == "user":
            latest_user_msg = m.get("content", "")
            break

    rag = build_rag_analysis(
        latest_user_msg,
        user_email=user_email,
        messages=messages,
    )

    system_prompt = AURELIA_SYSTEM_PROMPT.format(
        knowledge_context=rag["knowledge_text"]
    )
    if runtime_config.custom_system_note.strip():
        system_prompt += (
            f"\n\nADDITIONAL CUSTOM INSTRUCTIONS:\n{runtime_config.custom_system_note.strip()}"
        )

    # Reinforce the detected language right at the end of the system instruction
    lang_code = rag.get("language", "en")
    lang_name = rag.get("language_name", "English")
    system_prompt += (
        f"\n\nMANDATORY RESPONSE LANGUAGE FOR THIS TURN: {lang_name} ({lang_code}). "
        f"Write your entire response in {lang_name}."
    )

    reply_html, provider_used, model_used = await generate_llm_reply(
        system_prompt=system_prompt,
        messages=messages,
        user_message=latest_user_msg,
        rag=rag,
    )

    # If the LLM reply contains a payment link / checkout summary (e.g. "[ 🔒 Proceed Directly to Payment ]")
    # and booking_checkout was not yet built from user text alone, build it from the LLM reply + history.
    plain_reply = re.sub(r"<[^>]+>", " ", reply_html)
    if not rag.get("booking_checkout") and any(
        kw in plain_reply.lower()
        for kw in [
            "proceed directly to payment",
            "ringkasan pembayaran",
            "rincian pemesanan",
            "grand total",
            "total pembayaran",
            "halaman pembayaran",
            "payment page",
        ]
    ):
        reply_norm = _normalize_cjk_numbers(plain_reply.lower())
        reply_nights = _extract_explicit_duration(reply_norm) or rag.get("nights", 2)
        inferred_checkout = build_booking_checkout(
            text=plain_reply + " confirm",
            messages=messages,
            hotels=rag.get("all_hotels", []),
            default_nights=reply_nights,
            target_budget=rag.get("target_budget"),
            min_budget=rag.get("min_budget"),
            matched_hotels=rag.get("matched_hotels"),
        )
        if inferred_checkout:
            rag["booking_checkout"] = inferred_checkout
            rag["nights"] = inferred_checkout["totalNights"]

    latency_ms = round((time.perf_counter() - start_ts) * 1000, 1)

    recommended_cards = []
    target_b = rag.get("target_budget")
    min_b = rag.get("min_budget")
    checkout_obj = rag.get("booking_checkout")
    for h in rag["matched_hotels"]:
        chosen_room = h["rooms"][0] if h["rooms"] else None
        display_price = h["price"]
        if chosen_room and target_b is not None:
            chosen_room = min(h["rooms"], key=lambda r: abs(r["price"] - target_b))
            display_price = chosen_room["price"]
        elif chosen_room and min_b is not None:
            above_r = [r for r in h["rooms"] if r["price"] >= min_b]
            if above_r:
                chosen_room = above_r[0]
                display_price = chosen_room["price"]
        card_nights = rag.get("nights", 2)
        if checkout_obj and checkout_obj.get("items"):
            for leg in checkout_obj["items"]:
                if leg.get("hotelId") == h["id"]:
                    card_nights = leg.get("nights", card_nights)
                    break
        recommended_cards.append(
            {
                "id": h["id"],
                "name": h["name"],
                "city": h["city"],
                "location": h["location"],
                "rating": h["rating"],
                "price": display_price,
                "image": h["image"],
                "topRoom": chosen_room["name"] if chosen_room else "Deluxe Room",
                "nights": card_nights,
            }
        )

    quick_replies = get_dynamic_quick_replies(
        lang_code,
        rag["intent"],
        rag["matched_hotels"],
        rag.get("booking_checkout"),
    )

    return {
        "reply": reply_html,
        "language": lang_code,
        "intent": rag["intent"],
        "recommendedHotels": recommended_cards,
        "priceQuote": rag["price_quote"],
        "bookingCheckout": rag.get("booking_checkout"),
        "quickReplies": quick_replies,
        "metadata": {
            "provider": provider_used,
            "model": model_used,
            "latencyMs": latency_ms,
            "matchedHotelsCount": len(recommended_cards),
            "activeBookingsCount": len(rag["user_bookings"]),
            "temperature": runtime_config.temperature,
        },
    }
