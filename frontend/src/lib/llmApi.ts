/**
 * ============================================================================
 * MODUL CLIENT API KHUSUS CHATBOT LLM (Terpisah dari Bisnis Utama)
 * Menghubungkan Frontend Next.js ke Endpoint `/api/llm/*` pada FastAPI Backend
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
    // Offline fallback if backend server is not yet running
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
        geminiModel: "gemini-2.5-flash",
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
          category: "Rekomendasi & Perbandingan",
          title: "Bandingkan Hotel di Bali & Ubud",
          prompt:
            "Bandingkan hotel di Bali dan Ubud beserta tipe kamar dan fasilitas unggulannya untuk honeymoon.",
        },
        {
          id: "quote-calc",
          category: "Simulasi Biaya",
          title: "Simulasi Menginap 3 Malam di Maldives",
          prompt:
            "Hitung rincian total biaya menginap 3 malam di Lumière Riviera Maldives termasuk pajak 11% dan service 5%.",
        },
        {
          id: "budget-filter",
          category: "Filter Budget",
          title: "Hotel Mewah di Bawah Rp 2.500.000",
          prompt:
            "Rekomendasikan hotel dengan harga kamar mulai di bawah Rp 2.500.000 per malam.",
        },
        {
          id: "my-bookings",
          category: "Reservasi Saya",
          title: "Cek Status Reservasi Saya",
          prompt:
            "Tolong cek daftar reservasi aktif saya beserta kode booking dan total biayanya.",
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
    throw new Error(err.detail || "Gagal memperbarui konfigurasi LLM");
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
        "=== KATALOG HOTEL RESMI AURELIA COLLECTION ===\n" +
        FALLBACK_HOTELS.map(
          (h) => `- [${h.id}] ${h.name} (${h.location}) | Mulai ${fmtRp(h.price)}/malam`
        ).join("\n"),
    };
  }
}

function localSmartFallback(text: string): LLMChatApiResponse {
  const t = text.toLowerCase();
  const jutaMatch = t.match(/(\d+(?:[.,]\d+)?)\s*(?:juta|jt|jtan|jutaan)\b/);
  const amount = jutaMatch
    ? Math.round(parseFloat(jutaMatch[1].replace(",", ".")) * 1_000_000)
    : null;
  const isAbove = /di\s*atas|diatas|lebih\s*dari|minimal|ke\s*atas|>/.test(t);
  const isBelow = /di\s*bawah|dibawah|kurang\s*dari|maksimal|max|<|mentok/.test(t);

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

  const nightsMatch = t.match(/(\d+)\s*(malam|malem|mlm|hari|night)/);
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
    /hitung|itung|biaya|simulasi|pesan|pesen|booking|maldives|bali/.test(t) ||
    Boolean(nightsMatch);

  let reply =
    'Selamat datang di <b class="text-gold-300">Aurelia Collection</b> ✦<br><br>Saya Aurelia AI Concierge. Saya siap membantu merekomendasikan properti bintang lima sesuai budget Anda, menghitung simulasi biaya kamar (termasuk pajak 11% & service 5%), atau melanjutkan pemesanan Anda.';

  if (amount !== null) {
    const label = isAbove
      ? `di atas ${fmtRp(amount)}`
      : isBelow
      ? `di bawah ${fmtRp(amount)}`
      : `kisaran ${fmtRp(amount)}`;
    const listHtml = matched
      .slice(0, 3)
      .map((h) => {
        const bestR = [...h.rooms].sort(
          (a, b) => Math.abs(a.price - amount) - Math.abs(b.price - amount)
        )[0];
        return `✦ <b class="text-gold-300">${h.name}</b> — ${h.location} (★ ${h.rating})<br>  • Kamar Rekomendasi: <b>${bestR.name}</b> (<b class="text-gold-300">${fmtRp(bestR.price)}</b>/malam)`;
      })
      .join("<br><br>");
    reply = `Berikut rekomendasi properti & kamar untuk budget <b class="text-gold-300">${label}</b>/malam ✦<br><br>${listHtml}<br><br>Klik tombol <b class="text-gold-300">Lanjut Pemesanan →</b> pada kartu di bawah untuk langsung memesan.`;
  } else if (/bali|ubud/.test(t)) {
    reply =
      'Untuk Bali, saya merekomendasikan:<br><br>✦ <b class="text-gold-300">The Grand Azure</b> — Nusa Dua, mulai Rp 2.450.000/malam (beachfront + infinity pool)<br>✦ <b class="text-gold-300">Villa Serenity</b> — Ubud, mulai Rp 2.100.000/malam (private pool villa)<br><br>Klik tombol <b class="text-gold-300">Lanjut ke Pemesanan →</b> pada kartu di bawah untuk langsung memesan kamar.';
  } else if (/maldives|maladewa|hitung/.test(t)) {
    reply = `Berikut simulasi menginap <b class="text-gold-300">${nights} malam</b> di <b class="text-gold-300">${targetHotel.name}</b> (${targetRoom.name}):<br><br>• Subtotal: ${fmtRp(subtotal)}<br>• Pajak PPN (11%): ${fmtRp(tax)}<br>• Service (5%): ${fmtRp(service)}<br>✦ <b class="text-gold-300">Total: ${fmtRp(total)}</b><br><br>Klik tombol di bawah untuk langsung melanjutkan ke pengisian data tamu.`;
  } else if (/bayar|payment|pembayaran/.test(t)) {
    reply =
      "Kami menerima:<br>• Kartu Kredit/Debit (Visa, Mastercard, JCB)<br>• Virtual Account (BCA, Mandiri, BNI, BRI)<br>• E-Wallet (OVO, GoPay, DANA, ShopeePay)<br><br>Semua transaksi dienkripsi SSL 256-bit 🔒";
  } else if (/batal|refund|cancel/.test(t)) {
    reply =
      "Kebijakan pembatalan kami:<br>• Gratis pembatalan hingga 24 jam sebelum check-in<br>• Pembatalan <24 jam: dikenakan 1 malam<br>• Refund diproses 3–7 hari kerja.";
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
      "Hotel rekomendasi di Bali",
      "Hitung biaya 3 malam di Maldives",
      "Hotel di bawah Rp 2.500.000",
      "Cek status reservasi saya",
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
