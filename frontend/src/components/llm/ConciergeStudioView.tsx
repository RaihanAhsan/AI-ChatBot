"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ChatTurn,
  LLMBookingCheckout,
  LLMConfigState,
  LLMPriceQuote,
  LLMRecommendedHotel,
} from "@/types";
import { fmtDate, fmtRp } from "@/lib/hotelApi";
import {
  fetchLLMConfig,
  formatInteractiveChatHtml,
  resolveCheckoutFromMessage,
} from "@/lib/llmApi";

interface ConciergeStudioViewProps {
  messages: ChatTurn[];
  quickReplies: string[];
  isTyping: boolean;
  onSendMessage: (text: string) => void;
  onResetChat: () => void;
  onSelectHotel: (hotelId: string, nights?: number) => void;
  onQuickBookHotel: (hotelId: string, nights?: number) => void;
  onStartQuoteBooking: (quote: LLMPriceQuote) => void;
  onDirectCheckoutPayment: (checkout: LLMBookingCheckout) => void;
  onReviewCheckoutBooking: (checkout: LLMBookingCheckout) => void;
}

export default function ConciergeStudioView({
  messages,
  quickReplies,
  isTyping,
  onSendMessage,
  onResetChat,
  onSelectHotel,
  onQuickBookHotel,
  onStartQuoteBooking,
  onDirectCheckoutPayment,
  onReviewCheckoutBooking,
}: ConciergeStudioViewProps) {
  const [input, setInput] = useState("");
  const [activeLang, setActiveLang] = useState<"id" | "en" | "ja" | "zh">("en");
  const [llmState, setLlmState] = useState<LLMConfigState | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const LANG_OPTIONS: {
    code: "id" | "en" | "ja" | "zh";
    label: string;
    placeholder: string;
    quickReplies: string[];
  }[] = [
    {
      code: "id",
      label: "🇮🇩 Bahasa Indonesia",
      placeholder:
        "Ketik dalam Bahasa Indonesia (cth: Pesan 1 minggu: 2 hari di Jakarta dan 5 hari di Bali)…",
      quickReplies: [
        "Pesan 1 minggu: 2 hari di Jakarta, 5 hari di Bali",
        "Rekomendasi hotel di Bali",
        "Hitung biaya 3 malam di Maldives",
        "Hotel dengan budget sekitar 5 juta",
        "Cek status reservasi saya",
      ],
    },
    {
      code: "en",
      label: "🇬🇧 English",
      placeholder:
        "Type in English (e.g., Book 1 week: 2 days in Jakarta and 5 days in Bali)…",
      quickReplies: [
        "Book 1 week: 2 days in Jakarta, 5 days in Bali",
        "Recommended hotels in Bali",
        "Calculate 3 nights in Maldives",
        "Hotels around Rp 5,000,000",
        "Check my reservation status",
      ],
    },
    {
      code: "ja",
      label: "🇯🇵 日本語 (Japanese)",
      placeholder:
        "日本語で入力してください（例：1週間予約：ジャカルタで2泊、バリ島で5泊）…",
      quickReplies: [
        "1週間予約：ジャカルタ2泊、バリ島5泊",
        "バリ島のおすすめホテルを教えて",
        "モルディブ3泊の料金を計算して",
        "予算500万ルピア前後のホテル",
        "予約状況を確認する",
      ],
    },
    {
      code: "zh",
      label: "🇨🇳 中文 (Chinese)",
      placeholder:
        "请用中文输入（例如：预订1周行程：在雅加达住2晚，在巴厘岛住5晚）…",
      quickReplies: [
        "预订1周：雅加达2晚，巴厘岛5晚",
        "推荐巴厘岛的五星级奢华酒店",
        "计算马尔代夫3晚总费用",
        "预算500万印尼盾左右的酒店",
        "查询我的预订状态",
      ],
    },
  ];
  const currentLangObj =
    LANG_OPTIONS.find((l) => l.code === activeLang) || LANG_OPTIONS[1];

  useEffect(() => {
    fetchLLMConfig().then(setLlmState).catch(() => {});
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = () => {
    const t = input.trim();
    if (!t || isTyping) return;
    onSendMessage(t);
    setInput("");
  };

  return (
    <section className="mx-auto max-w-5xl px-5 pb-24 pt-28 lg:px-8 animate-page-in">
      {/* Header Banner */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2 text-[11px] tracking-[.4em] text-gold-400">
            <span className="h-px w-8 bg-gold-400/60"></span> PERSONAL CONCIERGE 24/7
          </p>
          <h1 className="font-serif text-4xl text-white sm:text-5xl">
            Aurelia <span className="gold-shimmer">Concierge</span>
          </h1>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-white/45">
            Book single or multi-city itineraries directly via chat, calculate room rates & taxes, or check your reservation status. Your personal chat history is saved automatically to your account.
          </p>
        </div>

        <button
          type="button"
          onClick={onResetChat}
          className="rounded-xl border border-white/15 px-4 py-2.5 text-xs text-white/60 transition hover:border-gold-400/50 hover:text-gold-300"
        >
          Clear Conversation
        </button>
      </div>

      {/* MAIN CONVERSATION WORKSPACE */}
      <div className="card-glass flex flex-col overflow-hidden border-white/10">
        {/* Status bar + 4-Language Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[.02] px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
            <span className="text-xs font-medium text-white/80">
              Aurelia Personal Butler • Multilingual AI (ID • EN • JP • ZH)
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {LANG_OPTIONS.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setActiveLang(l.code)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                  activeLang === l.code
                    ? "border-gold-400 bg-gold-400 text-ink-900 font-bold"
                    : "border-white/10 bg-white/5 text-white/65 hover:border-gold-400/50 hover:text-gold-300"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Preset Questions */}
        <div className="border-b border-white/5 bg-ink-900/40 px-6 py-3">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-white/35">
            Popular Topics & Multi-City Booking:
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {(llmState?.presets || []).map((preset) => (
              <button
                type="button"
                key={preset.id}
                onClick={() => onSendMessage(preset.prompt)}
                className="shrink-0 rounded-xl border border-white/10 bg-white/[.03] px-3.5 py-2 text-left transition hover:border-gold-400/50 hover:bg-gold-400/10"
              >
                <p className="text-[9px] uppercase tracking-wider text-gold-400">
                  {preset.category}
                </p>
                <p className="mt-0.5 text-xs font-medium text-white/85">
                  {preset.title}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Messages Stream */}
        <div className="h-[480px] space-y-5 overflow-y-auto p-6">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {m.role === "assistant" ? (
                <div className="flex max-w-[88%] gap-3.5">
                  <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600 shadow-glow">
                    <svg
                      className="h-4 w-4 text-ink-900"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" />
                    </svg>
                  </div>
                  <div className="space-y-3 min-w-0 flex-1">
                    <div
                      onClick={(e) => {
                        const target = (e.target as HTMLElement)?.closest(
                          '[data-chat-action="direct-payment"]'
                        );
                        if (target) {
                          e.preventDefault();
                          const resolved = resolveCheckoutFromMessage(
                            m,
                            messages
                          );
                          onDirectCheckoutPayment(resolved);
                        }
                      }}
                      className="rounded-2xl rounded-tl-sm border border-white/10 bg-white/[.05] px-5 py-4 text-sm leading-relaxed text-white/85"
                      dangerouslySetInnerHTML={{
                        __html: formatInteractiveChatHtml(m.content),
                      }}
                    />

                    {/* Interactive Multi-Stay or Direct Booking Checkout Card */}
                    {m.bookingCheckout && m.bookingCheckout.items.length > 0 ? (
                      <div className="rounded-2xl border border-gold-400/45 bg-gradient-to-br from-gold-400/12 via-ink-800 to-ink-900 p-5 shadow-card">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gold-400">
                              {m.bookingCheckout.isMultiStay
                                ? `✦ MULTI-DESTINATION ITINERARY CHECKOUT (${m.bookingCheckout.totalStays} STAYS • ${m.bookingCheckout.totalNights} NIGHTS)`
                                : `✦ DIRECT RESERVATION CHECKOUT (${m.bookingCheckout.totalNights} NIGHTS)`}
                            </span>
                            <h4 className="mt-0.5 font-serif text-xl text-white">
                              {m.bookingCheckout.isMultiStay
                                ? m.bookingCheckout.items
                                    .map((i) => `${i.hotelCity} (${i.nights}N)`)
                                    .join(" → ")
                                : `${m.bookingCheckout.items[0].hotelName} — ${m.bookingCheckout.items[0].roomName}`}
                            </h4>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase tracking-wider text-white/40">
                              Grand Total
                            </p>
                            <span className="font-serif text-2xl text-gold-300">
                              {fmtRp(m.bookingCheckout.grandTotal)}
                            </span>
                          </div>
                        </div>

                        {/* Itemized Legs */}
                        <div className="mt-4 space-y-2.5">
                          {m.bookingCheckout.items.map((leg, idx) => (
                            <div
                              key={`${leg.hotelId}-${idx}`}
                              className="flex flex-col justify-between gap-3 rounded-xl border border-white/10 bg-ink-900/75 p-3.5 sm:flex-row sm:items-center"
                            >
                              <div className="flex items-center gap-3">
                                <img
                                  src={leg.hotelImage}
                                  alt={leg.hotelName}
                                  className="h-14 w-16 shrink-0 rounded-lg object-cover"
                                />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="rounded bg-gold-400/20 px-1.5 py-0.5 text-[9px] font-bold text-gold-300">
                                      STAY #{idx + 1} • {leg.hotelCity.toUpperCase()}
                                    </span>
                                    <span className="text-[11px] text-white/50">
                                      {leg.nights} night(s) • {leg.guests} guests
                                    </span>
                                  </div>
                                  <p className="mt-0.5 font-serif text-base text-white">
                                    {leg.hotelName} —{" "}
                                    <span className="text-gold-300">
                                      {leg.roomName}
                                    </span>
                                  </p>
                                  <p className="text-[11px] text-white/45">
                                    📅 {fmtDate(leg.checkIn)} →{" "}
                                    {fmtDate(leg.checkOut)} ({fmtRp(leg.roomPrice)}
                                    /night)
                                  </p>
                                </div>
                              </div>
                              <div className="border-t border-white/10 pt-2 text-right sm:border-0 sm:pt-0">
                                <p className="text-[10px] text-white/40">
                                  Incl. 11% Tax & 5% Service
                                </p>
                                <p className="font-serif text-base font-semibold text-gold-300">
                                  {fmtRp(leg.total)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Combined Totals Breakdown */}
                        <div className="my-4 grid grid-cols-3 gap-2 rounded-xl bg-white/[.04] p-3 text-xs">
                          <div>
                            <p className="text-[10px] text-white/40">
                              Combined Subtotal ({m.bookingCheckout.totalNights}{" "}
                              nights)
                            </p>
                            <p className="font-medium text-white/85">
                              {fmtRp(m.bookingCheckout.grandSubtotal)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-white/40">
                              VAT Tax (11%)
                            </p>
                            <p className="font-medium text-white/85">
                              {fmtRp(m.bookingCheckout.grandTax)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-white/40">
                              Service Charge (5%)
                            </p>
                            <p className="font-medium text-white/85">
                              {fmtRp(m.bookingCheckout.grandService)}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2.5 sm:flex-row">
                          <button
                            type="button"
                            onClick={() =>
                              onDirectCheckoutPayment(m.bookingCheckout!)
                            }
                            className="btn-gold flex-1 py-3 text-xs font-bold"
                          >
                            🔒 Proceed Directly to Payment (
                            {fmtRp(m.bookingCheckout.grandTotal)}) →
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onReviewCheckoutBooking(m.bookingCheckout!)
                            }
                            className="btn-ghost px-4 py-3 text-xs"
                          >
                            Review Guest Details
                          </button>
                        </div>
                      </div>
                    ) : (
                      m.priceQuote && (
                        <div className="rounded-2xl border border-gold-400/40 bg-gradient-to-br from-gold-400/10 via-ink-800 to-ink-900 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span className="text-[10px] uppercase tracking-widest text-gold-400">
                                ✦ ESTIMATED BOOKING BREAKDOWN
                              </span>
                              <h4 className="font-serif text-lg text-white">
                                {m.priceQuote.hotelName} —{" "}
                                {m.priceQuote.roomName}
                              </h4>
                            </div>
                            <span className="font-serif text-2xl text-gold-300">
                              {fmtRp(m.priceQuote.total)}
                            </span>
                          </div>
                          <div className="my-3 grid grid-cols-3 gap-2 rounded-xl bg-white/[.04] p-3 text-xs">
                            <div>
                              <p className="text-[10px] text-white/40">
                                Subtotal ({m.priceQuote.nights} nights)
                              </p>
                              <p className="font-medium text-white/85">
                                {fmtRp(m.priceQuote.subtotal)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-white/40">
                                VAT Tax (11%)
                              </p>
                              <p className="font-medium text-white/85">
                                {fmtRp(m.priceQuote.tax)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-white/40">
                                Service (5%)
                              </p>
                              <p className="font-medium text-white/85">
                                {fmtRp(m.priceQuote.service)}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onStartQuoteBooking(m.priceQuote!)}
                            className="btn-gold w-full py-2.5 text-xs"
                          >
                            Proceed to Book This Room →
                          </button>
                        </div>
                      )
                    )}

                    {/* Recommended Hotels Grid inside Chat */}
                    {m.recommendedHotels && m.recommendedHotels.length > 0 && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {m.recommendedHotels.map((h: LLMRecommendedHotel) => {
                          const cardNights =
                            m.bookingCheckout?.items?.find(
                              (it) => it.hotelId === h.id
                            )?.nights ||
                            m.priceQuote?.nights ||
                            m.bookingCheckout?.totalNights ||
                            h.nights;
                          return (
                            <div
                              key={h.id}
                              className="group overflow-hidden rounded-2xl border border-white/10 bg-ink-900/80 transition hover:border-gold-400/50"
                            >
                              <div
                                onClick={() => onSelectHotel(h.id, cardNights)}
                                className="relative h-28 cursor-pointer overflow-hidden"
                              >
                                <img
                                  src={h.image}
                                  alt={h.name}
                                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                />
                                <span className="absolute right-2.5 top-2.5 rounded-md bg-gold-400 px-2 py-0.5 text-[10px] font-bold text-ink-900">
                                  ★ {h.rating}
                                </span>
                              </div>
                              <div className="p-3.5">
                                <p className="text-[10px] uppercase tracking-widest text-gold-400">
                                  {h.city}
                                </p>
                                <h5
                                  onClick={() =>
                                    onSelectHotel(h.id, cardNights)
                                  }
                                  className="cursor-pointer font-serif text-base text-white group-hover:text-gold-300"
                                >
                                  {h.name}
                                </h5>
                                <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
                                  <span className="font-serif text-sm text-gold-300">
                                    {fmtRp(h.price)}
                                    <span className="font-sans text-[10px] text-white/35">
                                      /night
                                    </span>
                                  </span>
                                </div>
                                <div className="mt-2.5 flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onSelectHotel(h.id, cardNights)
                                    }
                                    className="flex-1 rounded-xl border border-white/15 py-1.5 text-[11px] text-white/75 transition hover:border-gold-400/50 hover:text-gold-300"
                                  >
                                    View Rooms
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onQuickBookHotel(h.id, cardNights)
                                    }
                                    className="flex-1 rounded-xl bg-gradient-to-r from-gold-400 to-gold-600 py-1.5 text-[11px] font-semibold text-ink-900 transition hover:opacity-95"
                                  >
                                    Book Now
                                    {cardNights && cardNights > 0
                                      ? ` (${cardNights}n)`
                                      : ""}{" "}
                                    →
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="max-w-[78%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-gold-400 to-gold-600 px-5 py-3.5 text-sm font-medium leading-relaxed text-ink-900">
                  {m.content}
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600">
                <svg
                  className="h-4 w-4 text-ink-900"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" />
                </svg>
              </div>
              <div className="dot-typing rounded-2xl border border-white/10 bg-white/[.06] px-4 py-3">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Quick Replies + Input */}
        <div className="border-t border-white/10 bg-ink-900/60 p-4">
          <div className="mb-3 flex gap-2 overflow-x-auto no-scrollbar">
            {currentLangObj.quickReplies.map((q) => (
              <button
                type="button"
                key={q}
                onClick={() => onSendMessage(q)}
                className="shrink-0 rounded-full border border-gold-400/30 bg-gold-400/10 px-3.5 py-1.5 text-xs text-gold-300 transition hover:bg-gold-400/20"
              >
                {q}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-3">
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={currentLangObj.placeholder}
              className="input-field resize-none text-sm"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={isTyping}
              className="btn-gold h-12 shrink-0 px-6 text-sm"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
