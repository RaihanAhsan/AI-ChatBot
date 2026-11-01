/**
 * ============================================================================
 * DEDICATED CHATBOT LLM API CLIENT MODULE
 * Connects Next.js Frontend to `/api/llm/*` endpoints on FastAPI Backend
 * ============================================================================
 */
import {
  LLMConfigState,
  LLMMetadata,
  LLMPriceQuote,
  LLMRecommendedHotel,
} from "@/types";
import { API_BASE, FALLBACK_HOTELS, fmtRp } from "./hotelApi";

export interface LLMChatApiResponse {
  reply: string;
  intent: string;
  recommendedHotels: LLMRecommendedHotel[];
  priceQuote: LLMPriceQuote | null;
  quickReplies: string[];
  metadata: LLMMetadata;
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
          id: "bali-compare",
          category: "Recommendations",
          title: "Compare Bali & Ubud Resorts",
          prompt:
            "Compare your luxury resorts in Bali and Ubud including room types and best honeymoon amenities.",
        },
        {
          id: "quote-calc",
          category: "Price Quote",
          title: "3-Night Stay Quote in Maldives",
          prompt:
            "Calculate the total cost for a 3-night stay at Lumière Riviera Maldives including 11% tax and 5% service charge.",
        },
        {
          id: "budget-filter",
          category: "Budget Filter",
          title: "Luxury Hotels Under Rp 2,500,000",
          prompt:
            "Recommend five-star hotels with room rates starting under Rp 2,500,000 per night.",
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

function localSmartFallback(text: string): LLMChatApiResponse {
  const t = text.toLowerCase();
  const milMatch = t.match(
    /(\d+(?:[.,]\d+)?)\s*(?:million|mil|m|mio|juta|jt|jtan|jutaan)\b/
  );
  const amount = milMatch
    ? Math.round(parseFloat(milMatch[1].replace(",", ".")) * 1_000_000)
    : null;
  const isAbove =
    /above|over|more\s*than|minimum|at\s*least|di\s*atas|diatas|lebih\s*dari|minimal|>/.test(
      t
    );
  const isBelow =
    /under|below|less\s*than|maximum|up\s*to|di\s*bawah|dibawah|kurang\s*dari|maksimal|max|<|mentok/.test(
      t
    );

  let matched = FALLBACK_HOTELS.filter(
    (h) =>
      t.includes(h.city.toLowerCase()) ||
      t.includes(h.name.toLowerCase()) ||
      (h.city === "Ubud" && t.includes("bali")) ||
      (h.city === "Maldives" && t.includes("maladewa"))
  );

  if (amount !== null) {
    const pool = matched.length > 0 ? matched : FALLBACK_HOTELS;
    if (isAbove) {
      matched = pool.filter(
        (h) => h.price >= amount || h.rooms.some((r) => r.price >= amount)
      );
    } else if (isBelow) {
      matched = pool
        .filter((h) => h.price <= amount)
        .sort((a, b) => b.price - a.price);
    } else {
      const low = amount * 0.72;
      const high = amount * 1.35;
      matched = pool
        .filter(
          (h) =>
            (h.price >= low && h.price <= high) ||
            h.rooms.some((r) => r.price >= low && r.price <= high)
        )
        .sort((a, b) => Math.abs(a.price - amount) - Math.abs(b.price - amount));
    }
  }

  if (matched.length === 0) {
    matched = FALLBACK_HOTELS.slice(0, 2);
  }

  const nightsMatch = t.match(/(\d+)\s*(nights?|days?|malam|malem|mlm|hari)/);
  const nights = nightsMatch ? Math.max(1, parseInt(nightsMatch[1], 10)) : 2;
  const targetHotel = matched[0] || FALLBACK_HOTELS[0];
  const targetRoom =
    amount !== null
      ? [...targetHotel.rooms].sort(
          (a, b) => Math.abs(a.price - amount) - Math.abs(b.price - amount)
        )[0]
      : targetHotel.rooms[0];
  const subtotal = targetRoom.price * nights;
  const tax = Math.round(subtotal * 0.11);
  const service = Math.round(subtotal * 0.05);
  const total = subtotal + tax + service;

  const showQuote =
    /calculate|quote|cost|hitung|itung|biaya|simulasi|book|pesan|maldives|bali/.test(
      t
    ) || Boolean(nightsMatch);

  let reply =
    'Welcome to <b class="text-gold-300">Aurelia Collection</b> ✦<br><br>I am your Aurelia AI Concierge. I can help you find five-star hotels tailored to your budget, calculate full stay quotes (including 11% tax & 5% service), or assist with your reservations.';

  if (amount !== null) {
    const label = isAbove
      ? `above ${fmtRp(amount)}`
      : isBelow
      ? `under ${fmtRp(amount)}`
      : `around ${fmtRp(amount)}`;
    const listHtml = matched
      .slice(0, 3)
      .map((h) => {
        const bestR = [...h.rooms].sort(
          (a, b) => Math.abs(a.price - amount) - Math.abs(b.price - amount)
        )[0];
        return `✦ <b class="text-gold-300">${h.name}</b> — ${h.location} (★ ${h.rating})<br>  • Recommended Room: <b>${bestR.name}</b> (<b class="text-gold-300">${fmtRp(bestR.price)}</b>/night)`;
      })
      .join("<br><br>");
    reply = `Here are our recommended properties & suites for a budget <b class="text-gold-300">${label}</b>/night ✦<br><br>${listHtml}<br><br>Click <b class="text-gold-300">Book Now →</b> on any card below to reserve your room.`;
  } else if (/bali|ubud/.test(t)) {
    reply =
      'For Bali, I highly recommend:<br><br>✦ <b class="text-gold-300">The Grand Azure</b> — Nusa Dua, from Rp 2.450.000/night (beachfront + infinity pool)<br>✦ <b class="text-gold-300">Villa Serenity</b> — Ubud, from Rp 2.100.000/night (private pool villa)<br><br>Click <b class="text-gold-300">Book Now →</b> on any card below to proceed to booking.';
  } else if (/maldives|maladewa|calculate|hitung/.test(t)) {
    reply = `Here is your <b class="text-gold-300">${nights}-night</b> quote at <b class="text-gold-300">${targetHotel.name}</b> (${targetRoom.name}):<br><br>• Subtotal: ${fmtRp(subtotal)}<br>• VAT Tax (11%): ${fmtRp(tax)}<br>• Service (5%): ${fmtRp(service)}<br>✦ <b class="text-gold-300">Total: ${fmtRp(total)}</b><br><br>Click the button below to proceed directly to guest details.`;
  } else if (/pay|payment|bayar|pembayaran/.test(t)) {
    reply =
      "We accept:<br>• Credit / Debit Cards (Visa, Mastercard, JCB)<br>• Instant Virtual Account (BCA, Mandiri, BNI, BRI)<br>• Digital Wallets (OVO, GoPay, DANA, ShopeePay)<br><br>All transactions are secured with 256-bit SSL encryption 🔒";
  } else if (/cancel|refund|batal/.test(t)) {
    reply =
      "Our cancellation policy:<br>• 100% Free Cancellation up to 24 hours before check-in<br>• Cancellations <24 hours prior incur a 1-night charge<br>• Refunds are processed within 3–7 business days.";
  }

  return {
    reply,
    intent: showQuote ? "price_calculation" : "hotel_recommendation",
    recommendedHotels: matched.slice(0, 3).map((h) => {
      const bestR =
        amount !== null
          ? [...h.rooms].sort(
              (a, b) => Math.abs(a.price - amount) - Math.abs(b.price - amount)
            )[0]
          : h.rooms[0];
      return {
        id: h.id,
        name: h.name,
        city: h.city,
        location: h.location,
        rating: h.rating,
        price: bestR.price,
        image: h.image,
        topRoom: bestR.name,
      };
    }),
    priceQuote: showQuote
      ? {
          hotelId: targetHotel.id,
          hotelName: targetHotel.name,
          hotelCity: targetHotel.city,
          roomId: targetRoom.id,
          roomName: targetRoom.name,
          roomPrice: targetRoom.price,
          nights,
          subtotal,
          tax,
          service,
          total,
        }
      : null,
    quickReplies: [
      "Recommended hotels in Bali",
      "Calculate 3 nights in Maldives",
      "Hotels under Rp 2,500,000",
      "Check my reservation status",
    ],
    metadata: {
      provider: "smart_fallback",
      model: "aurelia-rag-concierge-v2",
      latencyMs: 12,
      matchedHotelsCount: matched.length,
      activeBookingsCount: 0,
      temperature: 0.4,
    },
  };
}
