/**
 * ============================================================================
 * DEDICATED CHATBOT LLM API CLIENT MODULE
 * Connects Next.js Frontend to `/api/llm/*` endpoints on FastAPI Backend
 * ============================================================================
 */
import {
  ChatTurn,
  LLMBookingCheckout,
  LLMBookingLeg,
  LLMConfigState,
  LLMMetadata,
  LLMPriceQuote,
  LLMRecommendedHotel,
} from "@/types";
import { API_BASE, FALLBACK_HOTELS, fmtRp, todayISO } from "./hotelApi";

export interface LLMChatApiResponse {
  reply: string;
  intent: string;
  recommendedHotels: LLMRecommendedHotel[];
  priceQuote: LLMPriceQuote | null;
  bookingCheckout?: LLMBookingCheckout | null;
  quickReplies: string[];
  metadata: LLMMetadata;
}

function getChatStorageKey(userEmail: string): string {
  const clean = (userEmail || "guest").trim().toLowerCase();
  return `aurelia_chat_history_${clean}`;
}

function getQuickRepliesStorageKey(userEmail: string): string {
  const clean = (userEmail || "guest").trim().toLowerCase();
  return `aurelia_quick_replies_${clean}`;
}

function enrichMessagesWithCheckout(msgs: ChatTurn[] | null): ChatTurn[] | null {
  if (!msgs || msgs.length === 0) return msgs;
  return msgs.map((m) => {
    if (
      m.role === "assistant" &&
      !m.bookingCheckout &&
      /Proceed\s+Directly\s+to\s+Payment/i.test(m.content || "")
    ) {
      return {
        ...m,
        bookingCheckout: resolveCheckoutFromMessage(m, msgs),
      };
    }
    return m;
  });
}

export async function fetchUserChatHistory(
  userEmail: string
): Promise<{ messages: ChatTurn[] | null; quickReplies: string[] | null }> {
  const cleanEmail = (userEmail || "").trim().toLowerCase();
  if (!cleanEmail) return { messages: null, quickReplies: null };

  // 1. Read local per-user storage first for instant load
  let localMessages: ChatTurn[] | null = null;
  let localQuickReplies: string[] | null = null;
  if (typeof window !== "undefined") {
    try {
      const rawMsgs = localStorage.getItem(getChatStorageKey(cleanEmail));
      if (rawMsgs) {
        const parsed = JSON.parse(rawMsgs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          localMessages = enrichMessagesWithCheckout(parsed);
        }
      }
      const rawQr = localStorage.getItem(getQuickRepliesStorageKey(cleanEmail));
      if (rawQr) {
        const parsedQr = JSON.parse(rawQr);
        if (Array.isArray(parsedQr) && parsedQr.length > 0) {
          localQuickReplies = parsedQr;
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  // 2. Also check backend database for this user's chat history
  try {
    const res = await fetch(
      `${API_BASE}/api/llm/history?user_email=${encodeURIComponent(cleanEmail)}`
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.messages) && data.messages.length > 0) {
        const enrichedServerMsgs =
          enrichMessagesWithCheckout(data.messages) || data.messages;
        // Choose whichever history has more messages (or backend if local is empty)
        if (
          !localMessages ||
          enrichedServerMsgs.length >= localMessages.length
        ) {
          if (typeof window !== "undefined") {
            localStorage.setItem(
              getChatStorageKey(cleanEmail),
              JSON.stringify(enrichedServerMsgs)
            );
            if (Array.isArray(data.quickReplies) && data.quickReplies.length > 0) {
              localStorage.setItem(
                getQuickRepliesStorageKey(cleanEmail),
                JSON.stringify(data.quickReplies)
              );
            }
          }
          return {
            messages: enrichedServerMsgs,
            quickReplies: data.quickReplies || localQuickReplies,
          };
        } else if (localMessages) {
          // Sync local history back to backend
          saveUserChatHistory(cleanEmail, localMessages, localQuickReplies || []);
        }
      } else if (localMessages) {
        saveUserChatHistory(cleanEmail, localMessages, localQuickReplies || []);
      }
    }
  } catch {
    // Fallback to local per-user storage if backend is unreachable
  }

  return { messages: localMessages, quickReplies: localQuickReplies };
}

export async function saveUserChatHistory(
  userEmail: string,
  messages: ChatTurn[],
  quickReplies: string[]
): Promise<void> {
  const cleanEmail = (userEmail || "").trim().toLowerCase();
  if (!cleanEmail) return;

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(
        getChatStorageKey(cleanEmail),
        JSON.stringify(messages)
      );
      if (quickReplies && quickReplies.length > 0) {
        localStorage.setItem(
          getQuickRepliesStorageKey(cleanEmail),
          JSON.stringify(quickReplies)
        );
      }
    } catch {
      // ignore storage quota errors
    }
  }

  try {
    await fetch(`${API_BASE}/api/llm/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userEmail: cleanEmail,
        messages,
        quickReplies,
      }),
    });
  } catch {
    // Saved locally already
  }
}

export async function clearUserChatHistory(userEmail: string): Promise<void> {
  const cleanEmail = (userEmail || "").trim().toLowerCase();
  if (!cleanEmail) return;

  if (typeof window !== "undefined") {
    localStorage.removeItem(getChatStorageKey(cleanEmail));
    localStorage.removeItem(getQuickRepliesStorageKey(cleanEmail));
  }

  try {
    await fetch(
      `${API_BASE}/api/llm/history?user_email=${encodeURIComponent(cleanEmail)}`,
      { method: "DELETE" }
    );
  } catch {
    // ignore
  }
}

export async function sendLLMChatMessage(
  messages: { role: string; content: string }[],
  userEmail = "demo@aurelia.com"
): Promise<LLMChatApiResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/llm/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, userEmail }),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } catch {
    const lastMsg = messages[messages.length - 1]?.content || "";
    return localSmartFallback(lastMsg);
  }
}

export async function fetchLLMConfig(): Promise<LLMConfigState> {
  try {
    const res = await fetch(`${API_BASE}/api/llm/config`);
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch {
    return {
      active: {
        provider: "smart_fallback",
        model: "aurelia-rag-concierge-v2",
        has_key: true,
        label: "Aurelia Smart RAG Engine (Built-in)",
      },
      config: {
        provider: "auto",
        temperature: 0.4,
        geminiModel: "gemini-3.5-flash",
        hasGeminiKey: false,
        openaiModel: "gpt-4o-mini",
        openaiBaseUrl: "https://api.openai.com/v1",
        hasOpenaiKey: false,
        groqModel: "llama-3.3-70b-versatile",
        hasGroqKey: false,
        ollamaModel: "llama3.2",
        ollamaBaseUrl: "http://localhost:11434",
        customSystemNote: "",
      },
      presets: [
        {
          id: "multi-city-itinerary",
          category: "Multi-City Booking",
          title: "1 Week: 2 Days Jakarta + 5 Days Bali",
          prompt:
            "I want to book a 1-week itinerary: 2 days in Jakarta and 5 days in Bali. Please calculate the full breakdown for each hotel and the combined total at checkout.",
        },
        {
          id: "bali-compare",
          category: "Recommendations",
          title: "Compare Bali & Ubud Resorts",
          prompt:
            "Compare your luxury resorts in Bali and Ubud including room types and best honeymoon amenities.",
        },
        {
          id: "quote-calc",
          category: "Direct Chat Booking",
          title: "Book 3 Nights in Maldives",
          prompt:
            "I want to book a 3-night stay at Lumière Riviera Maldives. Please show the total breakdown and payment link.",
        },
        {
          id: "budget-filter",
          category: "Budget Filter",
          title: "Luxury Hotels Around Rp 5,000,000",
          prompt:
            "Recommend five-star hotels or suites with rates around Rp 5,000,000 per night.",
        },
        {
          id: "my-bookings",
          category: "My Bookings",
          title: "Check My Reservation Status",
          prompt:
            "Please check my active reservations including booking codes and total amount paid.",
        },
      ],
    };
  }
}

export async function updateLLMConfig(
  payload: {
    provider?: string;
    temperature?: number;
    api_key?: string;
    model?: string;
    base_url?: string;
    custom_system_note?: string;
  },
  role = "admin"
) {
  const res = await fetch(
    `${API_BASE}/api/llm/config?role=${encodeURIComponent(role)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update LLM configuration");
  }
  return await res.json();
}

export async function fetchRAGContextPreview(userEmail = "demo@aurelia.com") {
  try {
    const res = await fetch(
      `${API_BASE}/api/llm/context-preview?user_email=${encodeURIComponent(
        userEmail
      )}`
    );
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch {
    return {
      hotelsCount: FALLBACK_HOTELS.length,
      userBookingsCount: 0,
      knowledgeText:
        "=== OFFICIAL AURELIA COLLECTION HOTEL CATALOG ===\n" +
        FALLBACK_HOTELS.map(
          (h) => `- [${h.id}] ${h.name} (${h.location}) | From ${fmtRp(h.price)}/night`
        ).join("\n"),
    };
  }
}

/**
 * Converts bracketed payment links like `[ 🔒 Proceed Directly to Payment ]`
 * or inline `🔒 Proceed Directly to Payment` inside assistant HTML into clickable buttons.
 */
export function formatInteractiveChatHtml(html: string): string {
  if (!html) return "";

  const btnHtml =
    '<button type="button" data-chat-action="direct-payment" class="my-1.5 inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-gold-300/60 bg-gradient-to-r from-gold-400 to-gold-600 px-3.5 py-2 text-xs font-bold text-ink-900 shadow-md transition hover:opacity-95 active:scale-95">🔒 Proceed Directly to Payment →</button>';

  // 1. Replace bracketed links: [ ... Proceed Directly to Payment / Pembayaran / Payment ... ]
  let out = html.replace(
    /\[\s*(?:🔒\s*)?(?:<[^>]+>\s*)*(?:Proceed\s+Directly\s+to\s+Payment|Proceed\s+to\s+Payment|Lanjut\s+ke\s+Pembayaran|Konfirmasi\s*(?:&|dan)?\s*Bayar|Bayar\s+Sekarang|支払いに進む|前往付款|立即付款)(?:\s*<\/[^>]+>)*\s*\]/gi,
    btnHtml
  );

  // 2. Also replace any remaining unbracketed `<b ...>🔒 Proceed Directly to Payment</b>`
  out = out.replace(
    /<b[^>]*>\s*🔒\s*Proceed\s+Directly\s+to\s+Payment\s*<\/b>/gi,
    '<button type="button" data-chat-action="direct-payment" class="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-gold-400/20 border border-gold-400/50 px-2 py-0.5 text-gold-300 font-semibold underline decoration-gold-400 transition hover:bg-gold-400 hover:text-ink-900">🔒 Proceed Directly to Payment →</button>'
  );

  return out;
}

/**
 * Resolves a complete LLMBookingCheckout object when the user clicks an inline
 * `[ 🔒 Proceed Directly to Payment ]` button inside a chat bubble `turn`,
 * even if `turn.bookingCheckout` was not persisted on that specific turn.
 */
export function resolveCheckoutFromMessage(
  turn: ChatTurn,
  allMessages: ChatTurn[]
): LLMBookingCheckout {
  if (turn.bookingCheckout && turn.bookingCheckout.items.length > 0) {
    return turn.bookingCheckout;
  }

  const turnIdx = allMessages.findIndex((m) => m.id === turn.id);
  const sliceEnd = turnIdx >= 0 ? turnIdx + 1 : allMessages.length;
  const historySlice = allMessages.slice(0, sliceEnd).reverse();

  // Check if any recent message already has a bookingCheckout we can use/adapt
  const plainTurn = (turn.content || "").replace(/<[^>]+>/g, " ").toLowerCase();

  const hotelMatchers: { pattern: RegExp; id: string }[] = [
    { pattern: /\bmarble\s+crown\b|\bmarina\s+crest\b|\bsingapore\b|\bsingapura\b|シンガポール|新加坡/, id: "h4" },
    { pattern: /\bvilla\s+serenity\b|\bserenity\b|\bubud\b|ウブド|乌布/, id: "h3" },
    { pattern: /\bgrand\s+azure\b|\bnusa\s+dua\b|\bbali\b|バリ|巴厘/, id: "h1" },
    { pattern: /\baurora(?:\s+sky)?(?:\s+palace)?\b|\bjakarta\b|\bsudirman\b|ジャカルタ|雅加达/, id: "h2" },
    { pattern: /\blumi[eè]re(?:\s+riviera)?\b|\bmaldives\b|\bmaladewa\b|モルディブ|马尔代夫/, id: "h5" },
    { pattern: /\bobsidian(?:\s+heights)?\b|\bdubai\b|ドバイ|迪拜/, id: "h6" },
  ];

  const extractNightsFromText = (txt: string): number | null => {
    const clean = txt.replace(/<[^>]+>/g, " ").toLowerCase();
    const m = clean.match(
      /(\d+)\s*(?:malam|malem|mlm|nights?|hari|days?|泊|日間|晚|天)\b(?!\s*(?:sebelum|prior|before))/i
    );
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 30) return n;
    }
    const wk = clean.match(/(\d+)\s*(?:minggu|pekan|weeks?|週間|周|星期)\b/i);
    if (wk) {
      return Math.min(30, parseInt(wk[1], 10) * 7);
    }
    if (/\b(?:seminggu|sepekan|a\s+week)\b/i.test(clean)) return 7;
    return null;
  };

  const monthMap: Record<string, number> = {
    januari: 1, january: 1, jan: 1,
    februari: 2, february: 2, feb: 2,
    maret: 3, march: 3, mar: 3,
    april: 4, apr: 4,
    mei: 5, may: 5,
    juni: 6, june: 6, jun: 6,
    juli: 7, july: 7, jul: 7,
    agustus: 8, august: 8, aug: 8, ags: 8, agu: 8,
    september: 9, sep: 9, sept: 9,
    oktober: 10, october: 10, oct: 10, okt: 10,
    november: 11, nov: 11, nopember: 11, nop: 11,
    desember: 12, december: 12, dec: 12, des: 12,
  };

  const extractCheckInFromText = (txt: string): string | null => {
    const clean = txt.replace(/<[^>]+>/g, " ").toLowerCase();
    const now = new Date();
    const isoM = clean.match(/\b(202\d)-(\d{2})-(\d{2})\b/);
    if (isoM) return isoM[0];

    const rangeM = clean.match(
      /(?:tanggal|tangga|tgl|periode|mulai|dari)?\s*(\d{1,2})\s*(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)?\s*(202\d)?\s*(?:-|–|—|sampai|hingga|s\/d|to|until)\s*(?:tanggal|tangga|tgl)?\s*(\d{1,2})\s*(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)?\s*(202\d)?\b(?!\s*(?:juta|jt|hari|malam|minggu|days?|nights?|weeks?|orang|kamar|%))/i
    );
    if (rangeM) {
      const d1 = parseInt(rangeM[1], 10);
      const mStr = rangeM[2] || rangeM[5];
      const yStr = rangeM[3] || rangeM[6];
      if (d1 >= 1 && d1 <= 31) {
        const mNum = mStr ? monthMap[mStr] || now.getMonth() + 1 : now.getMonth() + 1;
        const yNum = yStr ? parseInt(yStr, 10) : now.getFullYear();
        return `${yNum}-${String(mNum).padStart(2, "0")}-${String(d1).padStart(2, "0")}`;
      }
    }

    const dmM = clean.match(
      /\b(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)(?:\s+(202\d))?\b/i
    );
    if (dmM) {
      const d = parseInt(dmM[1], 10);
      const mNum = monthMap[dmM[2]] || now.getMonth() + 1;
      const yNum = dmM[3] ? parseInt(dmM[3], 10) : now.getFullYear();
      if (d >= 1 && d <= 31) {
        return `${yNum}-${String(mNum).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      }
    }
    return null;
  };

  let resolvedHotelId: string | null = null;
  let resolvedNights: number | null = extractNightsFromText(turn.content || "");
  let resolvedCheckIn: string | null = extractCheckInFromText(turn.content || "");

  for (const hm of hotelMatchers) {
    if (hm.pattern.test(plainTurn)) {
      resolvedHotelId = hm.id;
      break;
    }
  }

  for (const prev of historySlice) {
    const pText = (prev.content || "").replace(/<[^>]+>/g, " ").toLowerCase();
    if (!resolvedNights) {
      resolvedNights = extractNightsFromText(pText);
    }
    if (!resolvedCheckIn) {
      resolvedCheckIn = extractCheckInFromText(pText);
    }
    if (!resolvedHotelId) {
      for (const hm of hotelMatchers) {
        if (hm.pattern.test(pText)) {
          resolvedHotelId = hm.id;
          break;
        }
      }
    }
    if (prev.bookingCheckout && prev.bookingCheckout.items.length > 0) {
      if (prev.bookingCheckout.isMultiStay && !resolvedHotelId) {
        return prev.bookingCheckout;
      }
      if (!resolvedHotelId) {
        resolvedHotelId = prev.bookingCheckout.items[0].hotelId;
      }
      if (!resolvedNights) {
        resolvedNights = prev.bookingCheckout.totalNights;
      }
      if (!resolvedCheckIn) {
        resolvedCheckIn = prev.bookingCheckout.items[0].checkIn;
      }
    }
    if (resolvedHotelId && resolvedNights && resolvedCheckIn) break;
  }

  const finalNights = resolvedNights || 2;
  const hotel =
    FALLBACK_HOTELS.find((h) => h.id === resolvedHotelId) || FALLBACK_HOTELS[0];
  const combinedRoomSearch = [turn.content || "", ...historySlice.slice(0, 3).map((x) => x.content || "")]
    .join(" ")
    .toLowerCase();
  const room =
    hotel.rooms.find((r) => combinedRoomSearch.includes(r.name.toLowerCase())) ||
    (combinedRoomSearch.includes("executive") || combinedRoomSearch.includes("executibe")
      ? hotel.rooms.find((r) => r.name.toLowerCase().includes("executive"))
      : undefined) ||
    hotel.rooms[0];
  const ci = resolvedCheckIn || todayISO(1);
  const coDate = new Date(ci);
  coDate.setDate(coDate.getDate() + finalNights);
  const co = coDate.toISOString().split("T")[0];
  const subtotal = room.price * finalNights;
  const tax = Math.round(subtotal * 0.11);
  const service = Math.round(subtotal * 0.05);
  const total = subtotal + tax + service;

  return {
    isMultiStay: false,
    isConfirmed: true,
    totalNights: finalNights,
    totalStays: 1,
    grandSubtotal: subtotal,
    grandTax: tax,
    grandService: service,
    grandTotal: total,
    items: [
      {
        hotelId: hotel.id,
        hotelName: hotel.name,
        hotelCity: hotel.city,
        hotelLocation: hotel.location,
        hotelImage: hotel.image,
        roomId: room.id,
        roomName: room.name,
        roomPrice: room.price,
        checkIn: ci,
        checkOut: co,
        nights: finalNights,
        guests: 2,
        subtotal,
        tax,
        service,
        total,
      },
    ],
  };
}

function localSmartFallback(text: string): LLMChatApiResponse {
  const t = text.toLowerCase();

  // Detect multi-city or single-city legs in offline fallback
  const cityMatchers: { pattern: RegExp; hotelId: string }[] = [
    { pattern: /\bjakarta\b|\bjkt\b|\baurora\b/, hotelId: "h2" },
    { pattern: /\bubud\b|\bserenity\b/, hotelId: "h3" },
    { pattern: /\bbali\b|\bgrand\s+azure\b/, hotelId: "h1" },
    { pattern: /\bsingapore\b|\bsingapura\b|\bmarina\b/, hotelId: "h4" },
    { pattern: /\bmaldives\b|\bmaladewa\b|\blumi[eè]re\b/, hotelId: "h5" },
    { pattern: /\bdubai\b|\bobsidian\b/, hotelId: "h6" },
  ];

  const foundHits: { index: number; end: number; hotelId: string }[] = [];
  for (const cm of cityMatchers) {
    const m = cm.pattern.exec(t);
    if (m && m.index !== undefined) {
      foundHits.push({
        index: m.index,
        end: m.index + m[0].length,
        hotelId: cm.hotelId,
      });
    }
  }
  foundHits.sort((a, b) => a.index - b.index);

  const legs: LLMBookingLeg[] = [];
  let dayOffset = 1;
  for (let i = 0; i < foundHits.length; i++) {
    const prevEnd = i > 0 ? foundHits[i - 1].end : 0;
    const beforeSlice = t.slice(prevEnd, foundHits[i].index);
    const numMatches = [
      ...beforeSlice.matchAll(/(\d+)\s*(nights?|days?|malam|hari)/g),
    ];
    const legNights =
      numMatches.length > 0
        ? Math.max(1, parseInt(numMatches[numMatches.length - 1][1], 10))
        : 2;
    const h =
      FALLBACK_HOTELS.find((x) => x.id === foundHits[i].hotelId) ||
      FALLBACK_HOTELS[0];
    const r = h.rooms[0];
    const ci = todayISO(dayOffset);
    const co = todayISO(dayOffset + legNights);
    dayOffset += legNights;
    const subtotal = r.price * legNights;
    const tax = Math.round(subtotal * 0.11);
    const service = Math.round(subtotal * 0.05);
    const total = subtotal + tax + service;
    legs.push({
      hotelId: h.id,
      hotelName: h.name,
      hotelCity: h.city,
      hotelLocation: h.location,
      hotelImage: h.image,
      roomId: r.id,
      roomName: r.name,
      roomPrice: r.price,
      checkIn: ci,
      checkOut: co,
      nights: legNights,
      guests: 2,
      subtotal,
      tax,
      service,
      total,
    });
  }

  let bookingCheckout: LLMBookingCheckout | null = null;
  if (legs.length > 0) {
    bookingCheckout = {
      isMultiStay: legs.length > 1,
      isConfirmed: true,
      totalNights: legs.reduce((s, x) => s + x.nights, 0),
      totalStays: legs.length,
      grandSubtotal: legs.reduce((s, x) => s + x.subtotal, 0),
      grandTax: legs.reduce((s, x) => s + x.tax, 0),
      grandService: legs.reduce((s, x) => s + x.service, 0),
      grandTotal: legs.reduce((s, x) => s + x.total, 0),
      items: legs,
    };
  }

  const matched =
    legs.length > 0
      ? legs
          .map((l) => FALLBACK_HOTELS.find((h) => h.id === l.hotelId)!)
          .filter(Boolean)
      : FALLBACK_HOTELS.slice(0, 2);

  let reply =
    'Welcome to <b class="text-gold-300">Aurelia Collection</b> ✦<br><br>I am your Aurelia AI Concierge. I can help you book single or multi-city itineraries directly via chat, calculate full stay quotes (including 11% tax & 5% service), or check your reservations.';

  if (bookingCheckout && bookingCheckout.isMultiStay) {
    const legHtml = bookingCheckout.items
      .map(
        (item, idx) =>
          `✦ <b class="text-gold-300">Stay #${idx + 1}: ${item.hotelName} (${item.hotelCity})</b><br>  • ${item.roomName} · ${item.checkIn} → ${item.checkOut} (${item.nights} nights)<br>  • Stay Total (incl. 11% Tax & 5% Service): <b class="text-gold-300">${fmtRp(item.total)}</b>`
      )
      .join("<br><br>");
    reply = `I have prepared your <b class="text-gold-300">${bookingCheckout.totalNights}-Night Multi-Destination Itinerary (${bookingCheckout.totalStays} Stays)</b> ✦<br><br>${legHtml}<br><br>────────────────────────<br>✦ <b class="text-gold-300">Grand Total at Checkout: ${fmtRp(bookingCheckout.grandTotal)}</b><br><br>Click <b class="text-gold-300">🔒 Proceed Directly to Payment</b> below to complete payment and save all reservations directly to the database.`;
  } else if (bookingCheckout && bookingCheckout.items.length === 1) {
    const item = bookingCheckout.items[0];
    reply = `Here is your reservation & checkout summary for <b class="text-gold-300">${item.nights} night(s)</b> at <b class="text-gold-300">${item.hotelName}</b> (${item.roomName}):<br><br>• Check-in / Check-out: ${item.checkIn} → ${item.checkOut}<br>• Subtotal: ${fmtRp(item.subtotal)}<br>• VAT Tax (11%): ${fmtRp(item.tax)}<br>• Service (5%): ${fmtRp(item.service)}<br>✦ <b class="text-gold-300">Total Due: ${fmtRp(item.total)}</b><br><br>Click <b class="text-gold-300">🔒 Proceed Directly to Payment</b> below to pay now.`;
  }

  return {
    reply,
    intent: bookingCheckout ? "direct_booking_checkout" : "general_concierge",
    recommendedHotels: matched.map((h) => ({
      id: h.id,
      name: h.name,
      city: h.city,
      location: h.location,
      rating: h.rating,
      price: h.price,
      image: h.image,
      topRoom: h.rooms[0].name,
    })),
    priceQuote:
      bookingCheckout && bookingCheckout.items.length === 1
        ? {
            hotelId: bookingCheckout.items[0].hotelId,
            hotelName: bookingCheckout.items[0].hotelName,
            hotelCity: bookingCheckout.items[0].hotelCity,
            roomId: bookingCheckout.items[0].roomId,
            roomName: bookingCheckout.items[0].roomName,
            roomPrice: bookingCheckout.items[0].roomPrice,
            nights: bookingCheckout.items[0].nights,
            subtotal: bookingCheckout.items[0].subtotal,
            tax: bookingCheckout.items[0].tax,
            service: bookingCheckout.items[0].service,
            total: bookingCheckout.items[0].total,
          }
        : null,
    bookingCheckout,
    quickReplies: [
      "Book 1 week: 2 days in Jakarta, 5 days in Bali",
      "Recommended hotels in Bali",
      "Calculate 3 nights in Maldives",
      "Check my reservation status",
    ],
    metadata: {
      provider: "smart_fallback",
      model: "aurelia-local-concierge",
      latencyMs: 12,
      matchedHotelsCount: matched.length,
      activeBookingsCount: 0,
      temperature: 0.4,
    },
  };
}
