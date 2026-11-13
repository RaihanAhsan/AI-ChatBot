from datetime import date, timedelta
import re
from typing import Any, Dict, List, Optional, Tuple
from database import get_all_hotels, get_user_bookings_db


def fmt_rp(amount: int) -> str:
    return "Rp " + f"{int(amount):,}".replace(",", ".")


LANGUAGE_NAMES = {
    "id": "Indonesian (Bahasa Indonesia)",
    "en": "English",
    "ja": "Japanese (日本語)",
    "zh": "Chinese (中文 / Mandarin)",
}

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


def _normalize_cjk_numbers(text: str) -> str:
    """
    Normalizes CJK number characters (一..十, 两) and Indonesian/English number words
    (seminggu, sepekan, a week, satu..sepuluh, one..ten) into Arabic digits before duration/room units.
    """
    cjk_map = {
        "一": "1",
        "二": "2",
        "两": "2",
        "兩": "2",
        "三": "3",
        "四": "4",
        "五": "5",
        "六": "6",
        "七": "7",
        "八": "8",
        "九": "9",
        "十": "10",
    }
    out = text
    for k, v in cjk_map.items():
        out = re.sub(
            rf"{k}(?:\s*[个個ヶ箇])?(?=\s*(?:泊|日|日間|週間|晚|夜|天|周|星期|개|室|间|間|名|人))",
            v,
            out,
        )

    # Normalize Indonesian & English single-word duration expressions
    out = re.sub(r"\b(?:seminggu|sepekan)\b", "1 minggu", out, flags=re.IGNORECASE)
    out = re.sub(r"\b(?:a\s+week|one\s+week)\b", "1 week", out, flags=re.IGNORECASE)
    out = re.sub(r"\bsehari\b", "1 hari", out, flags=re.IGNORECASE)
    out = re.sub(r"\b(?:semalam|semalem)\b", "1 malam", out, flags=re.IGNORECASE)

    word_num_map = [
        (r"\bsatu\b|\bone\b", "1"),
        (r"\bdua\b|\btwo\b", "2"),
        (r"\btiga\b|\bthree\b", "3"),
        (r"\bempat\b|\bfour\b", "4"),
        (r"\blima\b|\bfive\b", "5"),
        (r"\benam\b|\bsix\b", "6"),
        (r"\btujuh\b|\bseven\b", "7"),
        (r"\bdelapan\b|\beight\b", "8"),
        (r"\bsembilan\b|\bnine\b", "9"),
        (r"\bsepuluh\b|\bten\b", "10"),
    ]
    for pat, digit in word_num_map:
        out = re.sub(
            rf"(?:{pat})(?=\s*(?:nights?|days?|malam|malem|mlm|hari|hr|weeks?|minggu|pekan|rooms?|kamar|guests?|orang|tamu)\b)",
            digit,
            out,
            flags=re.IGNORECASE,
        )
    return out


def detect_user_language(
    message: str, messages: Optional[List[Dict[str, str]]] = None
) -> str:
    """
    Detects which of the 4 supported languages the user is using:
    - 'ja': Japanese (日本語)
    - 'zh': Chinese (中文)
    - 'id': Indonesian (Bahasa Indonesia)
    - 'en': English
    """
    text = (message or "").strip()
    t_lower = text.lower()

    # 1. Check for Japanese scripts (Hiragana \u3040-\u309f or Katakana \u30a0-\u30ff)
    if re.search(r"[\u3040-\u309f\u30a0-\u30ff]", text):
        return "ja"
    if any(
        kw in t_lower
        for kw in ["konnichiwa", "arigatou", "osusume", "yoyaku", "ikura"]
    ):
        return "ja"

    # 2. Check for Chinese script (Hanzi \u4e00-\u9fff without Kana)
    if re.search(r"[\u4e00-\u9fff]", text):
        # Distinguish Japanese kanji-only phrases if they contain typical Japanese particles/terms
        if any(jp_kw in text for jp_kw in ["予約", "泊", "円", "様", "日間"]):
            # Note: 泊 and 予約 are much more common in Japanese hotel queries, while 预订/晚 are Chinese
            if not any(zh_kw in text for zh_kw in ["预订", "预定", "晚", "多少钱", "酒店", "巴厘岛", "雅加达", "马尔代夫"]):
                return "ja"
        return "zh"
    if any(kw in t_lower for kw in ["nihao", "xiexie", "jiudian"]):
        return "zh"

    # 3. Check for Indonesian keywords & conversational markers
    id_markers = [
        r"\bsaya\b",
        r"\baku\b",
        r"\bgue\b",
        r"\bgw\b",
        r"\bmau\b",
        r"\bingin\b",
        r"\bpesan\b",
        r"\bpesen\b",
        r"\bkamar\b",
        r"\bmalam\b",
        r"\bmalem\b",
        r"\bhari\b",
        r"\bminggu\b",
        r"\bseminggu\b",
        r"\brekomendasi\b",
        r"\brekom\b",
        r"\bharga\b",
        r"\bberapa\b",
        r"\bbrp\b",
        r"\bbiaya\b",
        r"\bhitung\b",
        r"\bitung\b",
        r"\bdiatas\b",
        r"\bdi\s+atas\b",
        r"\bdibawah\b",
        r"\bdi\s+bawah\b",
        r"\bjuta\b",
        r"\bjt\b",
        r"\bjtan\b",
        r"\bbayar\b",
        r"\bpembayaran\b",
        r"\bpembatalan\b",
        r"\bbatal\b",
        r"\btolong\b",
        r"\bcari\b",
        r"\bnginep\b",
        r"\bmenginap\b",
        r"\buntuk\b",
        r"\bdan\b",
        r"\byang\b",
        r"\bada\b",
        r"\bapakah\b",
        r"\bbisa\b",
        r"\blanjut\b",
        r"\bkonfirmasi\b",
        r"\bpesanan\b",
        r"\breservasi\b",
        r"\bmurah\b",
        r"\bmahal\b",
    ]
    if any(re.search(pat, t_lower) for pat in id_markers):
        return "id"

    # 4. Check for English keywords
    en_markers = [
        r"\bbook\b",
        r"\bhotel\b",
        r"\bhotels\b",
        r"\bnights?\b",
        r"\bdays?\b",
        r"\bweek\b",
        r"\brecommend\b",
        r"\bcalculate\b",
        r"\bprice\b",
        r"\bcost\b",
        r"\bquote\b",
        r"\bcheck\b",
        r"\bpayment\b",
        r"\bcancel\b",
        r"\bplease\b",
        r"\bhow\s+much\b",
        r"\bunder\b",
        r"\babove\b",
        r"\baround\b",
        r"\bconfirm\b",
        r"\bproceed\b",
    ]
    if any(re.search(pat, t_lower) for pat in en_markers):
        return "en"

    # 5. If ambiguous/short message, check previous user message in history
    if messages:
        for prev in reversed(messages[:-1]):
            if prev.get("role") == "user" and prev.get("content"):
                prev_lang = detect_user_language(prev["content"], None)
                if prev_lang:
                    return prev_lang

    return "en"


def _parse_rupiah_value(text: str) -> Optional[int]:
    """
    Extracts IDR amounts from expressions in all 4 languages:
    - '5m', '5 million', '5jt', '4 juta', '2,500,000'
    - Japanese/Chinese: '500万' (500 * 10,000 = 5,000,000), '250万ルピア', '500万印尼盾'
    """
    # Japanese / Chinese '万' (10,000) unit: e.g. 500万 = 5,000,000
    man_m = re.search(r"(\d+(?:[.,]\d+)?)\s*万", text)
    if man_m:
        val = float(man_m.group(1).replace(",", "."))
        return int(val * 10_000)

    mil_m = re.search(
        r"(\d+(?:[.,]\d+)?)\s*(?:million|mil|m|mio|juta|jt|jtan|jutaan|百万)\b",
        text,
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


def _select_room_for_hotel(
    hotel: Dict[str, Any],
    segment_text: str,
    target_budget: Optional[int] = None,
    min_budget: Optional[int] = None,
) -> Dict[str, Any]:
    """Selects the most appropriate room in a hotel based on room keywords (EN/ID/JA/ZH) or budget."""
    seg_lower = segment_text.lower()
    rooms = hotel.get("rooms", [])
    if not rooms:
        return {
            "id": "r1",
            "name": "Deluxe Room",
            "price": hotel.get("price", 2000000),
        }

    for r in rooms:
        r_name = r["name"].lower()
        if r_name in seg_lower:
            return r
    for r in rooms:
        r_name = r["name"].lower()
        if (
            ("presidential" in seg_lower or "プレジデンシャル" in seg_lower or "总统" in seg_lower)
            and "presidential" in r_name
        ) or (
            ("royal" in seg_lower or "ロイヤル" in seg_lower or "皇家" in seg_lower)
            and "royal" in r_name
        ) or (
            ("penthouse" in seg_lower or "ペントハウス" in seg_lower or "顶层" in seg_lower)
            and "penthouse" in r_name
        ) or (
            ("executive" in seg_lower or "executibe" in seg_lower or "eksekutif" in seg_lower or "エグゼクティブ" in seg_lower or "行政" in seg_lower)
            and "executive" in r_name
        ) or (
            ("premier" in seg_lower or "premiere" in seg_lower or "プレミア" in seg_lower)
            and "premier" in r_name
        ) or (
            ("skyline" in seg_lower or "スカイライン" in seg_lower)
            and "skyline" in r_name
        ) or (
            ("sunset" in seg_lower or "サンセット" in seg_lower or "日落" in seg_lower)
            and "sunset" in r_name
        ) or (
            ("valley" in seg_lower or "バレー" in seg_lower or "山谷" in seg_lower)
            and "valley" in r_name
        ) or (
            ("garden" in seg_lower or "ガーデン" in seg_lower or "花园" in seg_lower)
            and "garden" in r_name
        ) or (
            ("bay" in seg_lower and "bay" in r_name)
        ) or (
            ("city" in seg_lower and "city" in r_name)
        ) or (
            ("suite" in seg_lower or "スイート" in seg_lower or "套房" in seg_lower)
            and "suite" in r_name
        ) or (
            ("villa" in seg_lower or "ヴィラ" in seg_lower or "别墅" in seg_lower)
            and "villa" in r_name
        ):
            return r

    if target_budget is not None:
        return min(rooms, key=lambda r: abs(r["price"] - target_budget))
    if min_budget is not None:
        eligible = [r for r in rooms if r["price"] >= min_budget]
        if eligible:
            return eligible[0]

    return rooms[0]


def _find_hotel_mentions_ordered(
    text: str, hotels: List[Dict[str, Any]]
) -> List[Tuple[int, int, Dict[str, Any]]]:
    """
    Finds all hotel or city mentions in the order they appear in `text`
    across Indonesian, English, Japanese, and Chinese.
    Merges adjacent mentions of the same hotel (e.g. 'Grand Azure Bali').
    """
    by_id = {h["id"]: h for h in hotels}
    patterns: List[Tuple[str, str]] = [
        # Hotel 1: The Grand Azure (Bali)
        (r"\bgrand\s+azure\b|グランド・?アズール|蔚蓝大酒店", "h1"),
        (r"\bnusa\s+dua\b|ヌサドゥア|努沙杜瓦", "h1"),
        # Hotel 2: Aurora Sky Palace (Jakarta)
        (r"\baurora(?:\s+sky)?(?:\s+palace)?\b|オーロラ・?スカイ・?パレス|极光天宫", "h2"),
        (r"\bsky\s+palace\b", "h2"),
        (r"\bsovereign(?:\s+palace)?\b", "h2"),
        (r"\bsudirman\b|\bscbd\b|スディルマン|苏迪曼", "h2"),
        # Hotel 3: Villa Serenity (Ubud)
        (r"\bvilla\s+serenity\b|\bserenity\b|ヴィラ・?セレニティ|静谧别墅", "h3"),
        (r"\btegallalang\b|テガララン|德格拉朗", "h3"),
        # Hotel 4: The Marble Crown / Marina Crest Hotel (Singapore)
        (r"\bmarble\s+crown\b|\bmarina\s+crest\b|マーブル・?クラウン|マリーナ・?クレスト|大理石皇冠|滨海之巅", "h4"),
        (r"\bmarina\s+bay\b|マリーナベイ|滨海湾", "h4"),
        # Hotel 5: Lumière Riviera (Maldives)
        (r"\blumi[eè]re(?:\s+riviera)?\b|ルミエール・?リビエラ|卢米埃尔", "h5"),
        (r"\bbaa\s+atoll\b", "h5"),
        # Hotel 6: Obsidian Heights (Dubai)
        (r"\bobsidian(?:\s+heights)?\b|オブシディアン・?ハイツ|黑曜石高地", "h6"),
        (r"\bburj\b|ブルジュ|哈利法塔", "h6"),
        # Cities (EN / ID / JA / ZH)
        (r"\bubud\b|ウブド|乌布", "h3"),
        (r"\bbali\b|バリ島?|巴厘岛?", "h1"),
        (r"\bjakarta\b|\bjkt\b|ジャカルタ|雅加达", "h2"),
        (r"\bsingapore\b|\bsingapura\b|\bsingapur\b|\bsg\b|シンガポール|新加坡", "h4"),
        (r"\bmaldives\b|\bmaladewa\b|\bmaldiv\b|モルディブ|马尔代夫", "h5"),
        (r"\bdubai\b|ドバイ|迪拜", "h6"),
    ]

    raw_matches: List[Tuple[int, int, Dict[str, Any]]] = []
    for pat, hid in patterns:
        hotel_obj = by_id.get(hid)
        if not hotel_obj:
            continue
        for m in re.finditer(pat, text, flags=re.IGNORECASE):
            s, e = m.span()
            if any(not (e <= rs or s >= re_) for rs, re_, _ in raw_matches):
                continue
            raw_matches.append((s, e, hotel_obj))

    raw_matches.sort(key=lambda x: x[0])

    merged: List[Tuple[int, int, Dict[str, Any]]] = []
    for s, e, h in raw_matches:
        if merged and merged[-1][2]["id"] == h["id"]:
            between = text[merged[-1][1] : s]
            if not re.search(r"\d+", between):
                merged[-1] = (merged[-1][0], e, h)
                continue
        merged.append((s, e, h))

    return merged


DURATION_REGEX = r"(\d+)\s*(nights?|days?|malam|malem|mlm|hari|hr|weeks?|minggu|pekan|泊|日間|週間|晚|夜|天|周|星期)(?!\s*(?:sebelum|prior|before))"


def _unit_is_week(unit: str) -> bool:
    u = unit.lower()
    return (
        u.startswith("week")
        or u.startswith("minggu")
        or u.startswith("pekan")
        or u in ("週間", "周", "星期")
    )


def _extract_explicit_duration(text: str) -> Optional[int]:
    """
    Extracts an explicit stay duration (in nights) from normalized text if present.
    Returns None if the text does not mention any duration.
    """
    matches = list(re.finditer(DURATION_REGEX, text, flags=re.IGNORECASE))
    if not matches:
        return None

    parsed: List[Tuple[int, bool]] = []
    for m in matches:
        num = int(m.group(1))
        unit = m.group(2)
        is_wk = _unit_is_week(unit)
        val = num * 7 if is_wk else num
        parsed.append((val, is_wk))

    # Single duration (e.g. "4 hari", "10 hari", "1 minggu")
    if len(parsed) == 1:
        return max(1, min(parsed[0][0], 30))

    # Multi-leg summary header (e.g. "1 minggu: 2 hari di Jakarta, 5 hari di Bali")
    if parsed[0][1] and sum(v for v, _ in parsed[1:]) == parsed[0][0]:
        return max(1, min(parsed[0][0], 30))

    # Common "N hari (N-1) malam" phrasing (e.g. "3 hari 2 malam" / "4 hari 3 malam")
    if len(matches) == 2:
        u1 = matches[0].group(2).lower()
        u2 = matches[1].group(2).lower()
        v1 = int(matches[0].group(1))
        v2 = int(matches[1].group(1))
        if (
            u1 in ("hari", "hr", "day", "days", "日", "日間", "天")
            and u2 in ("malam", "malem", "mlm", "night", "nights", "泊", "晚", "夜")
            and v1 - v2 == 1
        ):
            return max(1, min(v2, 30))

    return max(1, min(parsed[-1][0], 30))


MONTH_WORDS = r"(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|ags|agu|sep|sept|oct|okt|nov|nop|dec|des)"

MONTH_MAP = {
    "januari": 1, "january": 1, "jan": 1,
    "februari": 2, "february": 2, "feb": 2,
    "maret": 3, "march": 3, "mar": 3,
    "april": 4, "apr": 4,
    "mei": 5, "may": 5,
    "juni": 6, "june": 6, "jun": 6,
    "juli": 7, "july": 7, "jul": 7,
    "agustus": 8, "august": 8, "aug": 8, "ags": 8, "agu": 8,
    "september": 9, "sep": 9, "sept": 9,
    "oktober": 10, "october": 10, "oct": 10, "okt": 10,
    "november": 11, "nov": 11, "nopember": 11, "nop": 11,
    "desember": 12, "december": 12, "dec": 12, "des": 12,
}


def _safe_build_date(year: int, month: int, day: int) -> Optional[date]:
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _parse_single_checkin_date(text: str) -> Optional[date]:
    """
    Extracts an explicit check-in date from a single text string (EN / ID / JA / ZH):
    - 'tanggal 5 - 10', 'tangga 5 november sampai 10 november', '5-10 november'
    - 'tanggal 10', 'mulai tanggal 2 november 2026', '5 november'
    - 'November 5', '2026-11-05', '11月8日'
    """
    t = re.sub(r"<[^>]+>", " ", text.lower())
    today = date.today()

    # 1. Explicit ISO date (YYYY-MM-DD)
    iso_m = re.search(r"\b(202\d)-(\d{1,2})-(\d{1,2})\b", t)
    if iso_m:
        dt = _safe_build_date(
            int(iso_m.group(1)), int(iso_m.group(2)), int(iso_m.group(3))
        )
        if dt:
            return dt

    # 2. CJK Date (e.g. 11月8日, 2026年11月5日)
    cjk_m = re.search(
        r"(?:(202\d)\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*[日号號]?", t
    )
    if cjk_m:
        y = int(cjk_m.group(1)) if cjk_m.group(1) else today.year
        m = int(cjk_m.group(2))
        d = int(cjk_m.group(3))
        dt = _safe_build_date(y, m, d)
        if dt:
            return dt

    # 3. Date range (e.g. 'tanggal 5 - 10', 'tangga 5 november sampai 10 november', '5-10 nov')
    range_m = re.search(
        rf"(?:tanggal|tangga|tgl|mulai|dari|periode|check-?in)?\s*(\d{{1,2}})\s*({MONTH_WORDS})?\s*(202\d)?\s*(?:-|–|—|sampai|hingga|s/d|sd|to|until)\s*(?:tanggal|tangga|tgl)?\s*(\d{{1,2}})\s*({MONTH_WORDS})?\s*(202\d)?\b(?!\s*(?:juta|jt|jtan|million|mil|hari|hr|malam|malem|mlm|minggu|pekan|days?|nights?|weeks?|orang|tamu|kamar|rooms?|guests?|%|jam|hours?))",
        t,
    )
    if range_m:
        d1 = int(range_m.group(1))
        d2 = int(range_m.group(4))
        m_str = range_m.group(2) or range_m.group(5)
        y_str = range_m.group(3) or range_m.group(6)
        if 1 <= d1 <= 31 and 1 <= d2 <= 31 and d2 > d1:
            m_num = MONTH_MAP.get(m_str, today.month) if m_str else today.month
            y_num = int(y_str) if y_str else today.year
            dt = _safe_build_date(y_num, m_num, d1)
            if dt:
                return dt

    # 4. Day + Month name (not preceded by checkout keywords)
    for dm in re.finditer(
        rf"\b(\d{{1,2}})\s+({MONTH_WORDS})(?:\s+(202\d))?\b", t
    ):
        prefix = t[max(0, dm.start() - 28) : dm.start()]
        if re.search(
            r"(?:checkout|chechout|check-out|check\s+out|sampai|hingga|until)\s*(?:tanggal|tangga|tgl)?\s*$",
            prefix,
        ):
            continue
        d = int(dm.group(1))
        m_num = MONTH_MAP.get(dm.group(2), today.month)
        y_num = int(dm.group(3)) if dm.group(3) else today.year
        dt = _safe_build_date(y_num, m_num, d)
        if dt:
            return dt

    # 5. Month name + Day (e.g. 'November 5', 'Nov 10, 2026')
    for md in re.finditer(
        rf"\b({MONTH_WORDS})\s+(\d{{1,2}})(?:st|nd|rd|th)?(?:\s*,?\s*(202\d))?\b",
        t,
    ):
        prefix = t[max(0, md.start() - 28) : md.start()]
        if re.search(r"(?:checkout|chechout|check-out|check\s+out|until|to)\s*$", prefix):
            continue
        m_num = MONTH_MAP.get(md.group(1), today.month)
        d = int(md.group(2))
        y_num = int(md.group(3)) if md.group(3) else today.year
        dt = _safe_build_date(y_num, m_num, d)
        if dt:
            return dt

    # 6. 'tanggal X' / 'tgl X' without month name (not preceded by checkout keywords)
    for tm in re.finditer(
        r"\b(?:tanggal|tangga|tgl|checkin|check-in|check\s+in)\s*(\d{1,2})\b(?!\s*(?:juta|jt|hari|malam|orang|kamar))",
        t,
    ):
        prefix = t[max(0, tm.start() - 25) : tm.start()]
        if re.search(
            r"(?:checkout|chechout|check-out|check\s+out|sampai|hingga)\w*\s*$",
            prefix,
        ):
            continue
        d = int(tm.group(1))
        if 1 <= d <= 31:
            dt = _safe_build_date(today.year, today.month, d)
            if dt:
                return dt

    return None


def _extract_checkin_date(
    text: str, messages: Optional[List[Dict[str, str]]] = None
) -> date:
    """
    Resolves the check-in date from the current message or recent conversation history.
    Defaults to tomorrow (date.today() + 1 day) only if no date was mentioned.
    """
    dt = _parse_single_checkin_date(text)
    if dt:
        return dt

    if messages:
        for prev in reversed(messages[:-1]):
            if prev.get("role") == "user":
                p_dt = _parse_single_checkin_date(prev.get("content", ""))
                if p_dt:
                    return p_dt
        for prev in reversed(messages[:-1]):
            if prev.get("role") != "user":
                p_dt = _parse_single_checkin_date(prev.get("content", ""))
                if p_dt:
                    return p_dt

    return date.today() + timedelta(days=1)


def _extract_date_range_nights(
    text: str, messages: Optional[List[Dict[str, str]]] = None
) -> Optional[int]:
    """
    Extracts stay duration from check-in / check-out date numbers in the same message
    (e.g. 'tanggal 5 - 10', 'tangga 5 november sampai 10 november', '2 november hingga 9 november')
    or across turns (e.g. Turn 1: 'tanggal 10', Turn 2: 'checkout tanggal 15').
    """
    t = text.lower()
    range_m = re.search(
        rf"(?:tanggal|tangga|tgl|mulai|dari|periode)?\s*(\d{{1,2}})\s*{MONTH_WORDS}?\s*(?:\d{{4}})?\s*(?:-|–|—|sampai|hingga|s/d|sd|to|until)\s*(?:tanggal|tangga|tgl)?\s*(\d{{1,2}})\b(?!\s*(?:juta|jt|jtan|million|mil|hari|hr|malam|malem|mlm|minggu|pekan|days?|nights?|weeks?|orang|tamu|kamar|rooms?|guests?|%|jam|hours?))",
        t,
    )
    if range_m:
        d1, d2 = int(range_m.group(1)), int(range_m.group(2))
        if 1 <= d1 <= 31 and 1 <= d2 <= 31 and d2 > d1:
            return max(1, min(d2 - d1, 30))

    co_m = re.search(
        r"(?:checkout|chechout|check-out|check\s+out|sampai|hingga)\w*\s*(?:tanggal|tangga|tgl)?\s*(\d{1,2})\b",
        t,
    )
    if co_m and messages:
        d_out = int(co_m.group(1))
        for prev in reversed(messages[:-1]):
            if prev.get("role") == "user":
                prev_t = prev.get("content", "").lower()
                ci_m = re.search(
                    r"(?:tanggal|tangga|tgl|checkin|check-in|check\s+in|mulai|dari)\s*(\d{1,2})\b",
                    prev_t,
                )
                if ci_m:
                    d_in = int(ci_m.group(1))
                    if 1 <= d_in <= 31 and 1 <= d_out <= 31 and d_out > d_in:
                        return max(1, min(d_out - d_in, 30))
    return None


def _extract_nights_near_mention(
    text: str,
    start_idx: int,
    end_idx: int,
    prev_end: int,
    next_start: int,
    default_nights: int = 2,
    total_mentions: int = 1,
) -> int:
    """
    Extracts the number of nights/days associated with a specific destination mention
    across English, Indonesian, Japanese, and Chinese.
    Handles both '2 days in Jakarta' / '2 hari di Jakarta' (before) and
    'di Bali saya mau pesan 4 hari' / 'ジャカルタで2泊' / '雅加达2天' (after).
    """
    # When there is only 1 destination in the request, any explicit duration in `text`
    # (or inherited `default_nights`) applies to this destination regardless of word order.
    if total_mentions <= 1:
        explicit = _extract_explicit_duration(text)
        return explicit if explicit is not None else default_nights

    before_slice = text[prev_end:start_idx]
    after_slice = text[end_idx:next_start]

    # 1. Check duration before the destination if not separated by a clause boundary (, / dan / lalu / and / then)
    before_matches = list(
        re.finditer(
            DURATION_REGEX,
            before_slice,
            flags=re.IGNORECASE,
        )
    )
    if before_matches:
        last_m = before_matches[-1]
        between_dur_and_city = before_slice[last_m.end() :]
        if not re.search(
            r"[,;、，]|\b(?:dan|lalu|kemudian|terus|and|then)\b",
            between_dur_and_city,
            flags=re.IGNORECASE,
        ):
            num = int(last_m.group(1))
            unit = last_m.group(2)
            if _unit_is_week(unit):
                num *= 7
            return max(1, min(num, 30))

    # 2. Check duration after the destination within the same clause (before next city connector)
    after_clause = re.split(
        r"[,;、，]|\b(?:dan|lalu|kemudian|terus|and|then)\b",
        after_slice,
        maxsplit=1,
        flags=re.IGNORECASE,
    )[0]
    after_m = re.search(
        DURATION_REGEX,
        after_clause,
        flags=re.IGNORECASE,
    )
    if after_m:
        num = int(after_m.group(1))
        unit = after_m.group(2)
        if _unit_is_week(unit):
            num *= 7
        return max(1, min(num, 30))

    if before_matches:
        last_m = before_matches[-1]
        num = int(last_m.group(1))
        unit = last_m.group(2)
        if _unit_is_week(unit):
            num *= 7
        return max(1, min(num, 30))

    return default_nights


def build_booking_checkout(
    text: str,
    messages: Optional[List[Dict[str, str]]],
    hotels: List[Dict[str, Any]],
    default_nights: int,
    target_budget: Optional[int],
    min_budget: Optional[int],
    matched_hotels: Optional[List[Dict[str, Any]]] = None,
) -> Optional[Dict[str, Any]]:
    """
    Builds a single-stay or multi-stay (itinerary/bulk) checkout structure with sequential
    check-in/check-out dates, per-stay tax/service breakdown, and combined grand total.
    Supports EN, ID, JA, and ZH across both single-turn and multi-turn conversations.
    """
    t_lower = _normalize_cjk_numbers(text.lower().strip())
    current_explicit_nights = _extract_explicit_duration(
        t_lower
    ) or _extract_date_range_nights(t_lower, messages)

    is_confirm = any(
        kw in t_lower
        for kw in [
            "confirm",
            "proceed",
            "checkout",
            "chechout",
            "check out",
            "check-out",
            "pay now",
            "payment link",
            "link pembayaran",
            "lanjut bayar",
            "lanjut pembayaran",
            "bayar sekarang",
            "konfirmasi",
            "oke pesan",
            "ok pesan",
            "oke boleh",
            "ok boleh",
            "boleh",
            "yes book",
            "deal",
            "setuju",
            "lanjut ke pembayaran",
            "buatkan pemesanan",
            "buatkan pesanan",
            "bill",
            "billnya",
            "tagihan",
            "invoice",
            "tombol",
            "tautan",
            "link",
            # Japanese confirmation keywords
            "予約を確定",
            "支払いへ",
            "支払いに進む",
            "決済",
            "確認",
            # Chinese confirmation keywords
            "确认预订",
            "去付款",
            "立即付款",
            "继续付款",
            "结账",
        ]
    )

    booking_keywords = [
        "book",
        "booking",
        "reserve",
        "reservation",
        "pesan",
        "pesen",
        "pemesanan",
        "stay",
        "menginap",
        "nginep",
        "calculate",
        "quote",
        "hitung",
        "itung",
        "total",
        "biaya",
        "simulasi",
        "bill",
        "tagihan",
        "invoice",
        "checkout",
        "chechout",
        "check-out",
        "checkin",
        "check-in",
        "tanggal",
        "tgl",
        "tombol",
        "tautan",
        "link",
        "week",
        "minggu",
        "pekan",
        "seminggu",
        "night",
        "nights",
        "day",
        "days",
        "malam",
        "malem",
        "mlm",
        "hari",
        # Japanese booking/quote keywords
        "予約",
        "泊",
        "日間",
        "週間",
        "料金",
        "計算",
        "いくら",
        "見積",
        # Chinese booking/quote keywords
        "预订",
        "预定",
        "订房",
        "晚",
        "天",
        "周",
        "星期",
        "多少钱",
        "计算",
        "费用",
        "总价",
    ]

    is_booking_or_quote = (
        is_confirm
        or current_explicit_nights is not None
        or any(kw in t_lower for kw in booking_keywords)
    )

    mentions = _find_hotel_mentions_ordered(t_lower, hotels)
    source_text = t_lower
    mentions_from_history = False

    # If the user just named a city/hotel in this turn (e.g. "di bali") after asking to book N days in a previous turn,
    # check if recent user history had a booking/duration intent.
    if not is_booking_or_quote and mentions and messages:
        for prev in reversed(messages[:-1]):
            if prev.get("role") == "user":
                prev_norm = _normalize_cjk_numbers(prev.get("content", "").lower())
                if _extract_explicit_duration(prev_norm) is not None or any(
                    kw in prev_norm for kw in booking_keywords
                ):
                    is_booking_or_quote = True
                    break

    if not is_booking_or_quote:
        return None

    if not mentions and messages:
        # 1. Check previous user messages first
        for prev in reversed(messages[:-1]):
            if prev.get("role") == "user":
                prev_text = _normalize_cjk_numbers(prev.get("content", "").lower())
                prev_mentions = _find_hotel_mentions_ordered(prev_text, hotels)
                if prev_mentions:
                    mentions = prev_mentions
                    source_text = prev_text
                    mentions_from_history = True
                    break
        # 2. Fall back to assistant messages only if no user message mentioned a city/hotel
        if not mentions:
            for prev in reversed(messages[:-1]):
                if prev.get("role") != "user":
                    prev_text = _normalize_cjk_numbers(prev.get("content", "").lower())
                    prev_mentions = _find_hotel_mentions_ordered(prev_text, hotels)
                    if prev_mentions:
                        mentions = [prev_mentions[0]]
                        source_text = prev_text
                        mentions_from_history = True
                        break

    # If the user explicitly asked to book or specified a duration (e.g. "saya mau pesan 4 hari", "pesan 1 minggu")
    # without naming a city yet, default to the top matched hotel (or flagship property) so the checkout card has the exact duration.
    if not mentions and (current_explicit_nights is not None or is_confirm):
        fallback_h = (
            matched_hotels[0]
            if (matched_hotels and len(matched_hotels) > 0)
            else hotels[0]
        )
        mentions = [(0, len(t_lower), fallback_h)]
        source_text = t_lower

    if not mentions:
        return None

    guests_m = re.search(
        r"(\d+)\s*(?:guests?|adults?|people|pax|orang|tamu|dewasa|名|人)\b",
        t_lower,
    ) or re.search(
        r"(\d+)\s*(?:guests?|adults?|people|pax|orang|tamu|dewasa|名|人)\b",
        source_text,
    )
    guests = int(guests_m.group(1)) if guests_m else 2
    guests = max(1, min(guests, 6))

    rooms_count_m = re.search(
        r"(\d+)\s*(?:rooms?|kamar|室|部屋|间|間)\b", t_lower
    ) or re.search(
        r"(\d+)\s*(?:rooms?|kamar|室|部屋|间|間)\b", source_text
    )
    rooms_count = int(rooms_count_m.group(1)) if rooms_count_m else 1
    rooms_count = max(1, min(rooms_count, 5))

    legs: List[Dict[str, Any]] = []
    cur_date = _extract_checkin_date(t_lower, messages)

    for idx, (s_pos, e_pos, hotel_obj) in enumerate(mentions):
        prev_end = mentions[idx - 1][1] if idx > 0 else 0
        next_start = (
            mentions[idx + 1][0] if idx + 1 < len(mentions) else len(source_text)
        )
        if len(mentions) == 1:
            # For a single destination, always use `default_nights` (which already resolves
            # the current message's duration first, then the most recent duration in history).
            leg_nights = default_nights
        elif mentions_from_history and current_explicit_nights is not None:
            leg_nights = current_explicit_nights
        else:
            leg_nights = _extract_nights_near_mention(
                source_text,
                s_pos,
                e_pos,
                prev_end,
                next_start,
                default_nights=default_nights,
                total_mentions=len(mentions),
            )
        if mentions_from_history:
            chosen_room = _select_room_for_hotel(
                hotel_obj, t_lower, target_budget, min_budget
            )
            if chosen_room["id"] == hotel_obj["rooms"][0]["id"] and not any(
                w in t_lower
                for w in [
                    hotel_obj["rooms"][0]["name"].lower(),
                    "deluxe",
                    "city view",
                    "bay view",
                    "garden",
                ]
            ):
                chosen_room = _select_room_for_hotel(
                    hotel_obj, source_text[prev_end:next_start], target_budget, min_budget
                )
        else:
            chosen_room = _select_room_for_hotel(
                hotel_obj, source_text[prev_end:next_start], target_budget, min_budget
            )

        check_in_str = cur_date.isoformat()
        check_out_date = cur_date + timedelta(days=leg_nights)
        check_out_str = check_out_date.isoformat()
        cur_date = check_out_date

        for rm_idx in range(rooms_count):
            subtotal = chosen_room["price"] * leg_nights
            tax = round(subtotal * 0.11)
            service = round(subtotal * 0.05)
            total = subtotal + tax + service

            legs.append(
                {
                    "hotelId": hotel_obj["id"],
                    "hotelName": hotel_obj["name"],
                    "hotelCity": hotel_obj["city"],
                    "hotelLocation": hotel_obj["location"],
                    "hotelImage": hotel_obj["image"],
                    "roomId": chosen_room["id"],
                    "roomName": chosen_room["name"]
                    + (f" (Room #{rm_idx + 1})" if rooms_count > 1 else ""),
                    "roomPrice": chosen_room["price"],
                    "checkIn": check_in_str,
                    "checkOut": check_out_str,
                    "nights": leg_nights,
                    "guests": guests,
                    "subtotal": subtotal,
                    "tax": tax,
                    "service": service,
                    "total": total,
                }
            )

    total_nights = sum(item["nights"] for item in legs)
    grand_subtotal = sum(item["subtotal"] for item in legs)
    grand_tax = sum(item["tax"] for item in legs)
    grand_service = sum(item["service"] for item in legs)
    grand_total = sum(item["total"] for item in legs)

    return {
        "isMultiStay": len(legs) > 1,
        "isConfirmed": is_confirm
        or any(
            k in t_lower
            for k in [
                "book",
                "booking",
                "reserve",
                "pesan",
                "pesen",
                "mau pesan",
                "want to book",
                "予約",
                "预订",
                "预定",
                "订房",
            ]
        ),
        "totalNights": total_nights,
        "totalStays": len(legs),
        "grandSubtotal": grand_subtotal,
        "grandTax": grand_tax,
        "grandService": grand_service,
        "grandTotal": grand_total,
        "items": legs,
    }


def build_rag_analysis(
    message: str,
    user_email: str = "demo@aurelia.com",
    messages: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """
    Analyzes user message across 4 languages (Indonesian, English, Japanese, Chinese),
    detects user language, budget filters, single & multi-destination booking itineraries,
    and computes full checkout breakdowns.
    """
    lang = detect_user_language(message, messages)
    text = _normalize_cjk_numbers(message.lower().strip())
    hotels = get_all_hotels()
    user_bookings = get_user_bookings_db(user_email)

    # 1. Detect nights (EN / ID / JA / ZH), looking back at recent turns (including date ranges) if not in current turn
    explicit_nights = _extract_explicit_duration(text) or _extract_date_range_nights(
        text, messages
    )
    if explicit_nights is not None:
        nights = explicit_nights
    else:
        inherited_nights: Optional[int] = None
        if messages:
            for idx_p in range(len(messages) - 2, -1, -1):
                prev = messages[idx_p]
                prev_norm = _normalize_cjk_numbers(prev.get("content", "").lower())
                if prev.get("role") == "user":
                    prev_dur = _extract_explicit_duration(
                        prev_norm
                    ) or _extract_date_range_nights(prev_norm, messages[: idx_p + 1])
                    if prev_dur is not None:
                        inherited_nights = prev_dur
                        break
                else:
                    # Also check assistant message if it computed N nights from user's date range
                    prev_dur = _extract_explicit_duration(prev_norm)
                    if prev_dur is not None:
                        inherited_nights = prev_dur
                        break
        nights = inherited_nights if inherited_nights is not None else 2
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
                "以上",
                "超",
                "超過",
                "超过",
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
                "以下",
                "以内",
                "未満",
                "低于",
                "不超过",
            ]
        ):
            max_budget = amount
            budget_mode = "below"
        else:
            target_budget = amount
            budget_mode = "around"

    # 3. Match hotels by ordered mentions or city/name
    ordered_mentions = _find_hotel_mentions_ordered(text, hotels)
    matched_hotels: List[Dict[str, Any]] = []
    for _, _, h_obj in ordered_mentions:
        if h_obj not in matched_hotels:
            matched_hotels.append(h_obj)

    if not matched_hotels:
        for h in hotels:
            h_name = h["name"].lower()
            h_city = h["city"].lower()
            if (
                h_name in text
                or any(
                    part in text
                    for part in h_name.split()
                    if len(part) >= 4 and part not in ("the", "villa")
                )
                or h_city in text
            ):
                matched_hotels.append(h)

    # 4. Filter by Budget Mode
    if budget_mode == "above" and min_budget is not None:
        pool = matched_hotels if matched_hotels else hotels
        above_base = [h for h in pool if h["price"] >= min_budget]
        above_rooms = [
            h
            for h in pool
            if h not in above_base
            and any(r["price"] >= min_budget for r in h["rooms"])
        ]
        above_base.sort(key=lambda x: x["price"])
        above_rooms.sort(
            key=lambda x: max(r["price"] for r in x["rooms"]), reverse=True
        )
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

    # 5. Amenity & slang keywords if no hotel matched yet (EN / ID / JA / ZH)
    if not matched_hotels and budget_mode is None:
        if any(
            k in text
            for k in [
                "overwater",
                "lagoon",
                "laguna",
                "seaplane",
                "chef",
                "ocean",
                "水上",
                "ラグーン",
            ]
        ):
            matched_hotels = [h for h in hotels if h["id"] == "h5"]
        elif any(
            k in text for k in ["burj", "dubai", "middle east", "arab", "ドバイ", "迪拜"]
        ):
            matched_hotels = [h for h in hotels if h["id"] == "h6"]
        elif any(
            k in text
            for k in [
                "rice",
                "sawah",
                "yoga",
                "tegallalang",
                "retreat",
                "healing",
                "quiet",
                "nature",
                "jungle",
                "ヨガ",
                "棚田",
                "梯田",
                "瑜伽",
            ]
        ):
            matched_hotels = [h for h in hotels if h["id"] == "h3"]
        elif any(
            k in text
            for k in [
                "sudirman",
                "scbd",
                "business",
                "work",
                "office",
                "meeting",
                "ビジネス",
                "商务",
            ]
        ):
            matched_hotels = [h for h in hotels if h["id"] == "h2"]
        elif any(
            k in text
            for k in [
                "honeymoon",
                "romantic",
                "romantis",
                "couple",
                "pasangan",
                "beach",
                "pantai",
                "private pool",
                "ハネムーン",
                "ビーチ",
                "蜜月",
                "海滩",
            ]
        ):
            matched_hotels = [h for h in hotels if h["id"] in ("h1", "h3", "h5")]
        elif any(
            k in text
            for k in [
                "cheapest",
                "cheap",
                "affordable",
                "termurah",
                "murah",
                "hemat",
                "low budget",
                "安い",
                "最安",
                "便宜",
                "实惠",
            ]
        ):
            matched_hotels = sorted(hotels, key=lambda x: x["price"])[:3]
        elif any(
            k in text
            for k in [
                "most expensive",
                "expensive",
                "termahal",
                "mahal",
                "paling mewah",
                "sultan",
                "最高級",
                "最贵",
                "奢华",
            ]
        ):
            matched_hotels = sorted(hotels, key=lambda x: x["price"], reverse=True)[:3]
        elif any(
            k in text
            for k in [
                "best",
                "recommend",
                "recommendation",
                "terbaik",
                "rekomendasi",
                "rekom",
                "spill",
                "all hotels",
                "list",
                "おすすめ",
                "人気",
                "ホテル",
                "推荐",
                "酒店",
            ]
        ):
            matched_hotels = hotels[:4]

    # 6. Build Multi-Stay or Single-Stay Booking Checkout
    booking_checkout = build_booking_checkout(
        text=text,
        messages=messages,
        hotels=hotels,
        default_nights=nights,
        target_budget=target_budget,
        min_budget=min_budget,
        matched_hotels=matched_hotels,
    )

    if booking_checkout:
        nights = booking_checkout["totalNights"]
        if not matched_hotels:
            by_id = {h["id"]: h for h in hotels}
            for item in booking_checkout["items"]:
                h_obj = by_id.get(item["hotelId"])
                if h_obj and h_obj not in matched_hotels:
                    matched_hotels.append(h_obj)

    # 7. Detect Intent (EN / ID / JA / ZH)
    intent = "general_concierge"
    if any(
        k in text
        for k in [
            "my booking",
            "my reservation",
            "check booking",
            "check reservation",
            "booking code",
            "booking status",
            "aur-",
            "reservasi saya",
            "booking saya",
            "cek booking",
            "pesanan saya",
            "予約確認",
            "予約状況",
            "予約コード",
            "我的预订",
            "查询预订",
            "预订状态",
            "订单状态",
        ]
    ):
        intent = "booking_check"
    elif booking_checkout and (
        booking_checkout["isMultiStay"] or booking_checkout["isConfirmed"]
    ):
        intent = "direct_booking_checkout"
    elif (
        booking_checkout is not None
        or any(
            k in text
            for k in [
                "calculate",
                "total cost",
                "quote",
                "price quote",
                "how much for",
                "estimate",
                "hitung",
                "itung",
                "total biaya",
                "simulasi",
                "berapa total",
                "brp total",
                "rincian biaya",
                "計算",
                "見積",
                "いくら",
                "计算",
                "多少钱",
                "费用",
                "总价",
            ]
        )
        or (explicit_nights is not None and matched_hotels)
    ):
        intent = "price_calculation"
    elif any(
        k in text
        for k in [
            "promo",
            "promotion",
            "discount",
            "diskon",
            "voucher",
            "member",
            "points",
            "reward",
            "perks",
            "プロモ",
            "割引",
            "特典",
            "优惠",
            "促销",
            "折扣",
            "会员",
        ]
    ):
        intent = "promo_inquiry"
    elif any(
        k in text
        for k in [
            "cancel",
            "refund",
            "cancellation",
            "reschedule",
            "policy",
            "batal",
            "pembatalan",
            "kebijakan",
            "キャンセル",
            "返金",
            "取消",
            "退款",
            "退订",
        ]
    ):
        intent = "cancellation_policy"
    elif any(
        k in text
        for k in [
            "payment method",
            "credit card",
            "virtual account",
            "va",
            "ewallet",
            "wallet",
            "gopay",
            "ovo",
            "dana",
            "bca",
            "mandiri",
            "metode pembayaran",
            "支払い方法",
            "クレジットカード",
            "支付方式",
            "付款方式",
            "信用卡",
        ]
    ):
        intent = "payment_policy"
    elif any(
        k in text
        for k in [
            "how to book",
            "booking steps",
            "how do i book",
            "cara pesan",
            "cara booking",
            "langkah",
            "予約方法",
            "怎么预订",
            "如何预订",
        ]
    ):
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
                "ホテル",
                "おすすめ",
                "部屋",
                "酒店",
                "推荐",
                "房间",
            ]
        )
    ):
        intent = "hotel_recommendation"
        if not matched_hotels and budget_mode is None:
            matched_hotels = hotels[:2]

    # 8. Price Quote Simulation (for single-hotel quote backward compatibility)
    price_quote: Optional[Dict[str, Any]] = None
    if booking_checkout and len(booking_checkout["items"]) == 1:
        item = booking_checkout["items"][0]
        price_quote = {
            "hotelId": item["hotelId"],
            "hotelName": item["hotelName"],
            "hotelCity": item["hotelCity"],
            "roomId": item["roomId"],
            "roomName": item["roomName"],
            "roomPrice": item["roomPrice"],
            "checkIn": item["checkIn"],
            "checkOut": item["checkOut"],
            "nights": item["nights"],
            "subtotal": item["subtotal"],
            "tax": item["tax"],
            "service": item["service"],
            "total": item["total"],
        }

    # 9. Build formatted text context for LLM prompt
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

    checkout_context_str = ""
    if booking_checkout:
        leg_strs = []
        for idx, item in enumerate(booking_checkout["items"], start=1):
            leg_strs.append(
                f"  Leg #{idx}: {item['hotelName']} ({item['hotelCity']}) — Room: {item['roomName']} ({fmt_rp(item['roomPrice'])}/night)\n"
                f"    Check-in: {item['checkIn']} → Check-out: {item['checkOut']} ({item['nights']} nights, {item['guests']} guests)\n"
                f"    Subtotal: {fmt_rp(item['subtotal'])} | VAT 11%: {fmt_rp(item['tax'])} | Service 5%: {fmt_rp(item['service'])} | Stay Total: {fmt_rp(item['total'])}"
            )
        checkout_context_str = (
            "\n\n=== COMPUTED ITINERARY & CHECKOUT BREAKDOWN FOR CURRENT REQUEST ===\n"
            + "\n".join(leg_strs)
            + f"\n  COMBINED SUMMARY ({booking_checkout['totalStays']} Stay(s), {booking_checkout['totalNights']} Total Nights):\n"
            + f"  Combined Subtotal: {fmt_rp(booking_checkout['grandSubtotal'])}\n"
            + f"  Combined VAT Tax (11%): {fmt_rp(booking_checkout['grandTax'])}\n"
            + f"  Combined Service Charge (5%): {fmt_rp(booking_checkout['grandService'])}\n"
            + f"  GRAND TOTAL AT CHECKOUT: {fmt_rp(booking_checkout['grandTotal'])}\n"
            + "  NOTE: An interactive Direct Payment Card ('Proceed Directly to Payment') is attached right below your response so the guest can pay and save all stays to the database in 1 click."
        )

    promo_lines = [f"- {p['title']} ({p['code']}): {p['desc']}" for p in PROMOS_DATA]

    knowledge_text = (
        f"=== DETECTED GUEST LANGUAGE: {LANGUAGE_NAMES.get(lang, 'English')} (code: {lang}) ===\n"
        f"YOU MUST RESPOND ENTIRELY IN {LANGUAGE_NAMES.get(lang, 'English').upper()}!\n\n"
        + "=== OFFICIAL AURELIA COLLECTION HOTEL CATALOG ===\n"
        + "\n".join(hotel_lines)
        + "\n\n=== CURRENT GUEST RESERVATIONS ("
        + user_email
        + ") ===\n"
        + "\n".join(booking_lines)
        + checkout_context_str
        + "\n\n=== ACTIVE PROMOTIONS ===\n"
        + "\n".join(promo_lines)
        + "\n\n=== POLICIES & PAYMENT METHODS ===\n"
        + "Payment Methods: "
        + " | ".join(POLICIES_DATA["payment_methods"])
        + "\nCancellation Policy: "
        + " | ".join(POLICIES_DATA["cancellation"])
    )

    return {
        "language": lang,
        "language_name": LANGUAGE_NAMES.get(lang, "English"),
        "intent": intent,
        "nights": nights,
        "min_budget": min_budget,
        "max_budget": max_budget,
        "target_budget": target_budget,
        "budget_mode": budget_mode,
        "matched_hotels": matched_hotels[:4],
        "all_hotels": hotels,
        "user_bookings": user_bookings,
        "price_quote": price_quote,
        "booking_checkout": booking_checkout,
        "knowledge_text": knowledge_text,
    }
