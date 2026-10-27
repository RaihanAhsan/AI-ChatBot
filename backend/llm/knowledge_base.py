import re
from typing import Any, Dict, List, Optional
from database import get_all_hotels, get_user_bookings_db


def fmt_rp(amount: int) -> str:
    return "Rp " + f"{int(amount):,}".replace(",", ".")


PROMOS_DATA = [
    {
        "code": "EARLYBIRD15",
        "title": "Early Bird Privilege",
        "discount": "15%",
        "desc": "Diskon 15% untuk pemesanan minimal 30 hari sebelum tanggal check-in.",
    },
    {
        "code": "STAY3PAY2",
        "title": "Stay 3 Pay 2 Suite Escape",
        "discount": "Gratis 1 Malam",
        "desc": "Menginap 3 malam berturut-turut di tipe Suite/Villa, cukup bayar 2 malam.",
    },
    {
        "code": "GOLD2X",
        "title": "Gold Member Double Points",
        "discount": "2x Poin Reward",
        "desc": "Anggota Gold Member mendapatkan 2x poin reward untuk setiap Rp 100.000 transaksi.",
    },
]

POLICIES_DATA = {
    "cancellation": [
        "Gratis pembatalan 100% hingga 24 jam sebelum waktu check-in (14:00 waktu setempat).",
        "Pembatalan kurang dari 24 jam sebelum check-in dikenakan biaya 1 malam pertama.",
        "No-show (tidak hadir tanpa konfirmasi) dikenakan biaya penuh.",
        "Proses refund dikembalikan dalam 3–7 hari kerja ke metode pembayaran awal.",
    ],
    "payment_methods": [
        "Kartu Kredit / Debit Internasional (Visa, Mastercard, JCB, AMEX) dengan enkripsi SSL 256-bit.",
        "Virtual Account Instan (BCA, Mandiri, BNI, BRI).",
        "E-Wallet (OVO, GoPay, DANA, ShopeePay).",
    ],
    "check_in_out": "Check-in mulai pukul 14:00, Check-out hingga pukul 12:00 siang (Early check-in & Late check-out gratis untuk Gold Member sesuai ketersediaan).",
}


def _parse_rupiah_value(text: str) -> Optional[int]:
    """Mengekstrak nominal Rupiah dari teks seperti '5jt', '4 juta', '2,5 juta', '2.500.000'."""
    juta_m = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:juta|jt|jtan|jutaan)\b", text)
    if juta_m:
        val = float(juta_m.group(1).replace(",", "."))
        return int(val * 1_000_000)

    raw_m = re.search(r"(?:rp\.?\s*)?(\d{1,3}(?:[.,]\d{3}){2,})\b", text)
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
    Menganalisis pesan user (baik bahasa formal maupun non-baku/gaul),
    mendeteksi filter harga (di atas / di bawah / sekitar nominal tertentu),
    mengekstrak hotel & tipe kamar yang tepat, dan menghitung simulasi biaya.
    """
    text = message.lower().strip()
    hotels = get_all_hotels()
    user_bookings = get_user_bookings_db(user_email)

    # 1. Detect nights (e.g., "3 malam", "4 hari", "2 malem", "3 mlm")
    nights_match = re.search(r"(\d+)\s*(malam|malem|mlm|hari|night)", text)
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
                "di atas",
                "diatas",
                "lebih dari",
                "minimal",
                "min ",
                "ke atas",
                "keatas",
                "mulai dari",
                ">",
            ]
        ):
            min_budget = amount
            budget_mode = "above"
        elif any(
            kw in text
            for kw in [
                "di bawah",
                "dibawah",
                "kurang dari",
                "maksimal",
                "maks ",
                "max ",
                "mentok",
                "paling mahal",
                "<",
            ]
        ):
            max_budget = amount
            budget_mode = "below"
        else:
            # User menyebut angka seperti "rekomendasi harga 5jt", "budget 5 juta", "kamar 5jt"
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
            or (h_city == "jakarta" and any(c in text for c in ["jkt", "jakpus", "jaksel", "ibu kota"]))
            or (h_city == "maldives" and any(c in text for c in ["maladewa", "maldiv"]))
            or (h_city == "singapore" and any(c in text for c in ["singapura", "sg", "singapur"]))
        ):
            matched_hotels.append(h)

    # 4. Filter by Budget Mode (accurate hotel & room matching)
    if budget_mode == "above" and min_budget is not None:
        pool = matched_hotels if matched_hotels else hotels
        # Utamakan hotel yang harga dasarnya >= min_budget, atau yang punya kamar >= min_budget
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
        # Urutkan dari yang paling mendekati max_budget (bukan yang paling murah 1 jutaan jika budgetnya tinggi)
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
        if any(k in text for k in ["overwater", "laguna", "seaplane", "chef", "laut"]):
            matched_hotels = [h for h in hotels if h["id"] == "h5"]
        elif any(k in text for k in ["burj", "dubai", "timur tengah", "arab"]):
            matched_hotels = [h for h in hotels if h["id"] == "h6"]
        elif any(k in text for k in ["sawah", "yoga", "tegallalang", "retret", "healing", "tenang", "alam", "hutan"]):
            matched_hotels = [h for h in hotels if h["id"] == "h3"]
        elif any(k in text for k in ["sudirman", "scbd", "bisnis", "kerja", "kantor", "meeting"]):
            matched_hotels = [h for h in hotels if h["id"] == "h2"]
        elif any(k in text for k in ["honeymoon", "romantis", "pasangan", "pantai", "private pool", "bulan madu", "couple", "pacar", "suami", "istri"]):
            matched_hotels = [h for h in hotels if h["id"] in ("h1", "h3", "h5")]
        elif any(k in text for k in ["termurah", "murah", "hemat", "terjangkau", "paling murah", "low budget", "miring", "ekonomis"]):
            matched_hotels = sorted(hotels, key=lambda x: x["price"])[:3]
        elif any(k in text for k in ["termahal", "mahal", "paling mewah", "sultan"]):
            matched_hotels = sorted(hotels, key=lambda x: x["price"], reverse=True)[:3]
        elif any(k in text for k in ["terbaik", "rekomendasi", "rekom", "rekomen", "spill", "info hotel", "semua hotel", "daftar hotel", "list hotel", "ada hotel apa"]):
            matched_hotels = hotels[:4]

    # 6. Detect Intent (supports formal & non-baku / slang)
    intent = "general_concierge"
    if any(k in text for k in ["reservasi saya", "booking saya", "bookingan", "cek booking", "cek reservasi", "kode booking", "aur-", "pesanan saya", "pesenan", "status booking"]):
        intent = "booking_check"
    elif any(k in text for k in ["hitung", "itung", "total biaya", "simulasi", "berapa total", "brp total", "rincian biaya", "estimasi", "habis berapa", "abis brp", "kena berapa", "kena brp"]) or (nights_match and matched_hotels):
        intent = "price_calculation"
    elif any(k in text for k in ["promo", "diskon", "discount", "potongan", "voucher", "member", "poin", "reward", "cashback"]):
        intent = "promo_inquiry"
    elif any(k in text for k in ["batal", "cancel", "refund", "uang kembali", "duit balik", "pembatalan", "reschedule", "ganti jadwal", "kebijakan"]):
        intent = "cancellation_policy"
    elif any(k in text for k in ["bayar", "payment", "pembayaran", "kartu", "virtual account", "va", "ewallet", "gopay", "ovo", "dana", "shopeepay", "bca", "mandiri", "bni", "bri", "transfer", "qris"]):
        intent = "payment_policy"
    elif any(k in text for k in ["cara pesan", "cara pesen", "cara booking", "gimana cara", "gmn cara", "langkah", "prosedur"]):
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
                "kamar",
                "villa",
                "suite",
                "menginap",
                "nginep",
                "staycation",
                "cari",
                "nyari",
                "bandingkan",
                "bandingin",
                "pesan",
                "pesen",
                "booking",
                "book",
                "spill",
                "rekom",
                "rekomen",
                "berapa",
                "brp",
                "harga",
                "budget",
                "bajet",
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
        or (any(k in text for k in ["pesan", "pesen", "booking", "reservasi"]) and len(matched_hotels) >= 1 and intent != "booking_check")
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
            f"{r['name']} ({r['size']}, {r['bed']}, maks {r['max']} tamu, {fmt_rp(r['price'])}/malam, Perks: {', '.join(r['perks'])})"
            for r in h["rooms"]
        )
        hotel_lines.append(
            f"- [{h['id']}] {h['name']} ({h['location']}) | Rating: {h['rating']} ({h['reviews']} ulasan) | Mulai {fmt_rp(h['price'])}/malam\n"
            f"  Deskripsi: {h['description']}\n"
            f"  Fasilitas: {', '.join(h['amenities'])}\n"
            f"  Tipe Kamar: {rooms_str}"
        )

    booking_lines = []
    if user_bookings:
        for b in user_bookings[:5]:
            booking_lines.append(
                f"- Kode: {b['code']} | Hotel: {b['hotel_name']} | Kamar: {b['room_name']} | "
                f"Check-in: {b['check_in']} → Check-out: {b['check_out']} ({b['nights']} malam, {b['guests']} tamu) | "
                f"Total: {fmt_rp(b['total'])} | Status: {b['status'].upper()}"
            )
    else:
        booking_lines.append("- Belum ada reservasi aktif untuk akun ini.")

    promo_lines = [f"- {p['title']} ({p['code']}): {p['desc']}" for p in PROMOS_DATA]

    knowledge_text = (
        "=== KATALOG HOTEL RESMI AURELIA COLLECTION ===\n"
        + "\n".join(hotel_lines)
        + "\n\n=== RESERVASI TAMU SAAT INI ("
        + user_email
        + ") ===\n"
        + "\n".join(booking_lines)
        + "\n\n=== PROMO AKTIF ===\n"
        + "\n".join(promo_lines)
        + "\n\n=== KEBIJAKAN & METODE PEMBAYARAN ===\n"
        + "Pembayaran: "
        + " | ".join(POLICIES_DATA["payment_methods"])
        + "\nPembatalan: "
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
