import re
from typing import Any, Dict, List, Optional
from database import get_all_hotels, get_user_bookings_db


def fmt_rp(amount: int) -> str:
    return "Rp " + f"{int(amount):,}".replace(",", ".")


PROMOS_DATA = [
    {
        "code": "EARLYBIRD15",
        "title": "Early Bird Privilege",
        "discount": "15% OFF",
        "desc": "Enjoy 15% off when booking at least 30 days prior to your check-in date.",
    },
    {
        "code": "STAY3PAY2",
        "title": "Stay 3 Pay 2 Suite Escape",
        "discount": "1 Night Free",
        "desc": "Stay 3 consecutive nights in any Suite or Villa and pay for only 2 nights.",
    },
    {
        "code": "GOLD2X",
        "title": "Gold Member Double Points",
        "discount": "2x Reward Points",
        "desc": "Gold Members earn 2x reward points on every Rp 100.000 spent across all properties.",
    },
]

POLICIES_DATA = {
    "cancellation": [
        "100% Free Cancellation up to 24 hours prior to check-in (14:00 local time).",
        "Cancellations made less than 24 hours before check-in incur a 1-night charge.",
        "No-shows without prior notice are charged in full.",
        "Refunds are processed within 3–7 business days back to the original payment method.",
    ],
    "payment_methods": [
        "International Credit / Debit Cards (Visa, Mastercard, JCB, AMEX) with 256-bit SSL encryption.",
        "Instant Virtual Account (BCA, Mandiri, BNI, BRI).",
        "Digital Wallets / E-Wallet (OVO, GoPay, DANA, ShopeePay).",
    ],
    "check_in_out": "Check-in from 14:00, Check-out until 12:00 noon (Complimentary early check-in & late check-out for Gold Members subject to availability).",
}


def _parse_rupiah_value(text: str) -> Optional[int]:
    """Extracts IDR amounts from expressions like '5m', '5 million', '5jt', '4 juta', '2,500,000'."""
    mil_m = re.search(
        r"(\d+(?:[.,]\d+)?)\s*(?:million|mil|m|mio|juta|jt|jtan|jutaan)\b", text
    )
    if mil_m:
        val = float(mil_m.group(1).replace(",", "."))
        return int(val * 1_000_000)

    raw_m = re.search(r"(?:rp\.?|idr)?\s*(\d{1,3}(?:[.,]\d{3}){2,})\b", text)
    if raw_m:
        digits = re.sub(r"[^\d]", "", raw_m.group(1))
        if len(digits) >= 6:
            return int(digits)

    plain_m = re.search(r"\b(\d{7,8})\b", text)
    if plain_m:
        return int(plain_m.group(1))

    return None


def build_rag_analysis(message: str, user_email: str = "demo@aurelia.com") -> Dict[str, Any]:
    """
    Analyzes user message (formal/informal English & Indonesian),
    detects budget filters (above / below / around a target rate),
    extracts matching hotels & rooms, and computes price quotes.
    """
    text = message.lower().strip()
    hotels = get_all_hotels()
    user_bookings = get_user_bookings_db(user_email)

    # 1. Detect nights (e.g., "3 nights", "4 days", "3 malam")
    nights_match = re.search(r"(\d+)\s*(nights?|days?|malam|malem|mlm|hari)", text)
    nights = int(nights_match.group(1)) if nights_match else 2
    nights = max(1, min(nights, 30))

    # 2. Detect Budget & Price Filters (min_budget, max_budget, target_budget)
    min_budget: Optional[int] = None
    max_budget: Optional[int] = None
    target_budget: Optional[int] = None
    budget_mode: Optional[str] = None  # "above" | "below" | "around"

    amount = _parse_rupiah_value(text)
    if amount is not None:
        if any(
            kw in text
            for kw in [
                "above",
                "over",
                "more than",
                "minimum",
                "at least",
                "starting from",
                "di atas",
                "diatas",
                "lebih dari",
                "minimal",
                "min ",
                "ke atas",
                "keatas",
                ">",
            ]
        ):
            min_budget = amount
            budget_mode = "above"
        elif any(
            kw in text
            for kw in [
                "under",
                "below",
                "less than",
                "maximum",
                "up to",
                "max ",
                "di bawah",
                "dibawah",
                "kurang dari",
                "maksimal",
                "maks ",
                "mentok",
                "<",
            ]
        ):
            max_budget = amount
            budget_mode = "below"
        else:
            target_budget = amount
            budget_mode = "around"

    # 3. Match hotels by explicit name or city first
    matched_hotels: List[Dict[str, Any]] = []
    for h in hotels:
        h_name = h["name"].lower()
        h_city = h["city"].lower()
        if (
            h_name in text
            or any(part in text for part in h_name.split() if len(part) >= 4 and part not in ("the", "villa"))
            or h_city in text
            or (h_city == "ubud" and "bali" in text)
            or (h_city == "jakarta" and any(c in text for c in ["jkt", "jakpus", "jaksel", "capital"]))
            or (h_city == "maldives" and any(c in text for c in ["maladewa", "maldiv"]))
            or (h_city == "singapore" and any(c in text for c in ["singapura", "sg", "singapur"]))
        ):
            matched_hotels.append(h)

    # 4. Filter by Budget Mode
    if budget_mode == "above" and min_budget is not None:
        pool = matched_hotels if matched_hotels else hotels
        above_base = [h for h in pool if h["price"] >= min_budget]
        above_rooms = [
            h
            for h in pool
            if h not in above_base and any(r["price"] >= min_budget for r in h["rooms"])
        ]
        above_base.sort(key=lambda x: x["price"])
        above_rooms.sort(key=lambda x: max(r["price"] for r in x["rooms"]), reverse=True)
        matched_hotels = above_base + above_rooms

    elif budget_mode == "below" and max_budget is not None:
        pool = matched_hotels if matched_hotels else hotels
        below_hotels = [h for h in pool if h["price"] <= max_budget]
        below_hotels.sort(key=lambda x: x["price"], reverse=True)
        matched_hotels = below_hotels

    elif budget_mode == "around" and target_budget is not None:
        pool = matched_hotels if matched_hotels else hotels
        low_bound = int(target_budget * 0.72)
        high_bound = int(target_budget * 1.35)

        def closest_room_diff(hotel: Dict[str, Any]) -> int:
            diffs = [abs(hotel["price"] - target_budget)] + [
                abs(r["price"] - target_budget) for r in hotel["rooms"]
            ]
            return min(diffs)

        def has_room_near_target(hotel: Dict[str, Any]) -> bool:
            if low_bound <= hotel["price"] <= high_bound:
                return True
            return any(low_bound <= r["price"] <= high_bound for r in hotel["rooms"])

        near_hotels = [h for h in pool if has_room_near_target(h)]
        if near_hotels:
            near_hotels.sort(key=closest_room_diff)
            matched_hotels = near_hotels
        else:
            matched_hotels = sorted(pool, key=closest_room_diff)[:3]

    # 5. Amenity & slang keywords if no hotel matched yet
    if not matched_hotels and budget_mode is None:
        if any(k in text for k in ["overwater", "lagoon", "laguna", "seaplane", "chef", "ocean"]):
            matched_hotels = [h for h in hotels if h["id"] == "h5"]
        elif any(k in text for k in ["burj", "dubai", "middle east", "arab"]):
            matched_hotels = [h for h in hotels if h["id"] == "h6"]
        elif any(k in text for k in ["rice", "sawah", "yoga", "tegallalang", "retreat", "healing", "quiet", "nature", "jungle"]):
            matched_hotels = [h for h in hotels if h["id"] == "h3"]
        elif any(k in text for k in ["sudirman", "scbd", "business", "work", "office", "meeting"]):
            matched_hotels = [h for h in hotels if h["id"] == "h2"]
        elif any(k in text for k in ["honeymoon", "romantic", "romantis", "couple", "pasangan", "beach", "pantai", "private pool"]):
            matched_hotels = [h for h in hotels if h["id"] in ("h1", "h3", "h5")]
        elif any(k in text for k in ["cheapest", "cheap", "affordable", "termurah", "murah", "hemat", "low budget"]):
            matched_hotels = sorted(hotels, key=lambda x: x["price"])[:3]
        elif any(k in text for k in ["most expensive", "expensive", "termahal", "mahal", "paling mewah", "sultan"]):
            matched_hotels = sorted(hotels, key=lambda x: x["price"], reverse=True)[:3]
        elif any(k in text for k in ["best", "recommend", "recommendation", "terbaik", "rekomendasi", "rekom", "spill", "all hotels", "list"]):
            matched_hotels = hotels[:4]

    # 6. Detect Intent
    intent = "general_concierge"
    if any(k in text for k in ["my booking", "my reservation", "check booking", "check reservation", "booking code", "booking status", "aur-", "reservasi saya", "booking saya", "cek booking", "pesanan saya"]):
        intent = "booking_check"
    elif any(k in text for k in ["calculate", "total cost", "quote", "price quote", "how much for", "estimate", "hitung", "itung", "total biaya", "simulasi", "berapa total", "brp total", "rincian biaya"]) or (nights_match and matched_hotels):
        intent = "price_calculation"
    elif any(k in text for k in ["promo", "promotion", "discount", "diskon", "voucher", "member", "points", "reward", "perks"]):
        intent = "promo_inquiry"
    elif any(k in text for k in ["cancel", "refund", "cancellation", "reschedule", "policy", "batal", "pembatalan", "kebijakan"]):
        intent = "cancellation_policy"
    elif any(k in text for k in ["pay", "payment", "credit card", "virtual account", "va", "ewallet", "wallet", "gopay", "ovo", "dana", "bca", "mandiri", "bayar", "pembayaran"]):
        intent = "payment_policy"
    elif any(k in text for k in ["how to book", "booking steps", "how do i book", "cara pesan", "cara booking", "langkah"]):
        intent = "booking_guide"
        if not matched_hotels:
            matched_hotels = hotels[:2]
    elif (
        matched_hotels
        or budget_mode is not None
        or any(
            k in text
            for k in [
                "hotel",
                "resort",
                "room",
                "kamar",
                "villa",
                "suite",
                "stay",
                "menginap",
                "nginep",
                "staycation",
                "find",
                "search",
                "cari",
                "compare",
                "bandingkan",
                "book",
                "booking",
                "pesan",
                "spill",
                "recommend",
                "rekom",
                "price",
                "rate",
                "harga",
                "budget",
                "tarif",
            ]
        )
    ):
        intent = "hotel_recommendation"
        if not matched_hotels and budget_mode is None:
            matched_hotels = hotels[:2]

    # 7. Price Quote Simulation if applicable
    price_quote: Optional[Dict[str, Any]] = None
    if (
        intent == "price_calculation"
        or (nights_match and len(matched_hotels) >= 1)
        or (any(k in text for k in ["book", "reserve", "pesan", "pesen", "booking"]) and len(matched_hotels) >= 1 and intent != "booking_check")
    ):
        target_hotel = matched_hotels[0] if matched_hotels else hotels[0]
        target_room = target_hotel["rooms"][0]
        if target_budget is not None:
            target_room = min(
                target_hotel["rooms"],
                key=lambda r: abs(r["price"] - target_budget),
            )
        elif min_budget is not None:
            eligible_rooms = [r for r in target_hotel["rooms"] if r["price"] >= min_budget]
            if eligible_rooms:
                target_room = eligible_rooms[0]
        for r in target_hotel["rooms"]:
            if r["name"].lower() in text or ("suite" in text and "suite" in r["name"].lower()) or ("villa" in text and "villa" in r["name"].lower()):
                target_room = r
                break
        subtotal = target_room["price"] * nights
        tax = round(subtotal * 0.11)
        service = round(subtotal * 0.05)
        total = subtotal + tax + service
        price_quote = {
            "hotelId": target_hotel["id"],
            "hotelName": target_hotel["name"],
            "hotelCity": target_hotel["city"],
            "roomId": target_room["id"],
            "roomName": target_room["name"],
            "roomPrice": target_room["price"],
            "nights": nights,
            "subtotal": subtotal,
            "tax": tax,
            "service": service,
            "total": total,
        }

    # 8. Build formatted text context for LLM prompt
    hotel_lines = []
    for h in hotels:
        rooms_str = "; ".join(
            f"{r['name']} ({r['size']}, {r['bed']}, max {r['max']} guests, {fmt_rp(r['price'])}/night, Perks: {', '.join(r['perks'])})"
            for r in h["rooms"]
        )
        hotel_lines.append(
            f"- [{h['id']}] {h['name']} ({h['location']}) | Rating: {h['rating']} ({h['reviews']} reviews) | Starting from {fmt_rp(h['price'])}/night\n"
            f"  Description: {h['description']}\n"
            f"  Amenities: {', '.join(h['amenities'])}\n"
            f"  Room Types: {rooms_str}"
        )

    booking_lines = []
    if user_bookings:
        for b in user_bookings[:5]:
            booking_lines.append(
                f"- Code: {b['code']} | Hotel: {b['hotel_name']} | Room: {b['room_name']} | "
                f"Check-in: {b['check_in']} → Check-out: {b['check_out']} ({b['nights']} nights, {b['guests']} guests) | "
                f"Total: {fmt_rp(b['total'])} | Status: {b['status'].upper()}"
            )
    else:
        booking_lines.append("- No active reservations found for this account.")

    promo_lines = [f"- {p['title']} ({p['code']}): {p['desc']}" for p in PROMOS_DATA]

    knowledge_text = (
        "=== OFFICIAL AURELIA COLLECTION HOTEL CATALOG ===\n"
        + "\n".join(hotel_lines)
        + "\n\n=== CURRENT GUEST RESERVATIONS ("
        + user_email
        + ") ===\n"
        + "\n".join(booking_lines)
        + "\n\n=== ACTIVE PROMOTIONS ===\n"
        + "\n".join(promo_lines)
        + "\n\n=== POLICIES & PAYMENT METHODS ===\n"
        + "Payment Methods: "
        + " | ".join(POLICIES_DATA["payment_methods"])
        + "\nCancellation Policy: "
        + " | ".join(POLICIES_DATA["cancellation"])
    )

    return {
        "intent": intent,
        "nights": nights,
        "min_budget": min_budget,
        "max_budget": max_budget,
        "target_budget": target_budget,
        "budget_mode": budget_mode,
        "matched_hotels": matched_hotels[:3],
        "all_hotels": hotels,
        "user_bookings": user_bookings,
        "price_quote": price_quote,
        "knowledge_text": knowledge_text,
    }
