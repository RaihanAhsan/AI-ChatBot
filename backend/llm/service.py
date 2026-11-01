import time
from typing import Any, Dict, List
from llm.config import runtime_config
from llm.knowledge_base import build_rag_analysis
from llm.prompts import AURELIA_SYSTEM_PROMPT
from llm.providers import generate_llm_reply


def get_dynamic_quick_replies(intent: str, matched_hotels: List[Dict[str, Any]]) -> List[str]:
    if intent == "hotel_recommendation" and matched_hotels:
        h = matched_hotels[0]
        return [
            f"Calculate 3 nights at {h['name']}",
            "Hotels under Rp 2,500,000",
            "What promotions are active?",
            "Check my reservation status",
        ]
    if intent == "price_calculation":
        return [
            "What payment methods are accepted?",
            "Cancellation & refund policy",
            "Compare hotels in Bali",
            "Check my reservation status",
        ]
    if intent == "booking_check":
        return [
            "Recommended hotels in Bali",
            "3-night quote in Maldives",
            "Cancellation policy",
            "Gold Member perks",
        ]
    return [
        "Recommended hotels in Bali",
        "Calculate 3 nights in Maldives",
        "Hotels under Rp 2,500,000",
        "Check my reservation status",
        "Payment methods & promos",
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

    rag = build_rag_analysis(latest_user_msg, user_email=user_email)

    system_prompt = AURELIA_SYSTEM_PROMPT.format(
        knowledge_context=rag["knowledge_text"]
    )
    if runtime_config.custom_system_note.strip():
        system_prompt += (
            f"\n\nINSTRUKSI TAMBAHAN KUSTOM:\n{runtime_config.custom_system_note.strip()}"
        )

    reply_html, provider_used, model_used = await generate_llm_reply(
        system_prompt=system_prompt,
        messages=messages,
        user_message=latest_user_msg,
        rag=rag,
    )

    latency_ms = round((time.perf_counter() - start_ts) * 1000, 1)

    recommended_cards = []
    target_b = rag.get("target_budget")
    min_b = rag.get("min_budget")
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
            }
        )

    quick_replies = get_dynamic_quick_replies(rag["intent"], rag["matched_hotels"])

    return {
        "reply": reply_html,
        "intent": rag["intent"],
        "recommendedHotels": recommended_cards,
        "priceQuote": rag["price_quote"],
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
