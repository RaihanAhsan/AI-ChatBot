"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ChatTurn,
  LLMBookingCheckout,
  LLMPriceQuote,
  LLMRecommendedHotel,
} from "@/types";
import { fmtDate, fmtRp } from "@/lib/hotelApi";
import {
  formatInteractiveChatHtml,
  resolveCheckoutFromMessage,
} from "@/lib/llmApi";

interface FloatingConciergeProps {
  messages: ChatTurn[];
  quickReplies: string[];
  isTyping: boolean;
  onSendMessage: (text: string) => void;
  onSelectHotel: (hotelId: string, nights?: number) => void;
  onQuickBookHotel: (hotelId: string, nights?: number) => void;
  onStartQuoteBooking: (quote: LLMPriceQuote) => void;
  onDirectCheckoutPayment: (checkout: LLMBookingCheckout) => void;
  onReviewCheckoutBooking: (checkout: LLMBookingCheckout) => void;
}

export default function FloatingConcierge({
  messages,
  quickReplies,
  isTyping,
  onSendMessage,
  onSelectHotel,
  onQuickBookHotel,
  onStartQuoteBooking,
  onDirectCheckoutPayment,
  onReviewCheckoutBooking,
}: FloatingConciergeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [activeLang, setActiveLang] = useState<"id" | "en" | "ja" | "zh">("en");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const LANG_OPTIONS: {
    code: "id" | "en" | "ja" | "zh";
    label: string;
    placeholder: string;
    sampleQuickReplies: string[];
  }[] = [
    {
      code: "id",
      label: "🇮🇩 ID",
      placeholder: "Tanya hotel atau pesan (cth: 2 hari Jakarta, 5 hari Bali)…",
      sampleQuickReplies: [
        "Pesan 1 minggu: 2 hari di Jakarta, 5 hari di Bali",
        "Rekomendasi hotel di Bali",
        "Hitung biaya 3 malam di Maldives",
        "Hotel budget 5 juta",
      ],
    },
    {
      code: "en",
      label: "🇬🇧 EN",
      placeholder: "Ask to book single or multi-city stays…",
      sampleQuickReplies: [
        "Book 1 week: 2 days in Jakarta, 5 days in Bali",
        "Recommended hotels in Bali",
        "Calculate 3 nights in Maldives",
        "Hotels around Rp 5,000,000",
      ],
    },
    {
      code: "ja",
      label: "🇯🇵 日本語",
      placeholder: "ホテルのご予約・料金見積もり（例：ジャカルタ2泊、バリ5泊）…",
      sampleQuickReplies: [
        "1週間予約：ジャカルタ2泊、バリ島5泊",
        "バリ島のおすすめホテル",
        "モルディブ3泊の料金を計算",
        "予算500万ルピア前後のホテル",
      ],
    },
    {
      code: "zh",
      label: "🇨🇳 中文",
      placeholder: "咨询或预订多城市行程（如：雅加达2晚，巴厘岛5晚）…",
      sampleQuickReplies: [
        "预订1周：雅加达2晚，巴厘岛5晚",
        "推荐巴厘岛的奢华酒店",
        "计算马尔代夫3晚总费用",
        "预算500万印尼盾左右的酒店",
      ],
    },
  ];
  const currentLangObj =
    LANG_OPTIONS.find((l) => l.code === activeLang) || LANG_OPTIONS[1];

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping, isOpen]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isTyping) return;
    onSendMessage(trimmed);
    setInput("");
  };

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-4">
      {/* Chat Panel — pure concierge chat */}
      <div
        className={`w-[calc(100vw-3rem)] max-w-[420px] overflow-hidden rounded-3xl border border-white/10 bg-ink-800/95 shadow-[0_30px_80px_-20px_rgba(0,0,0,.9)] backdrop-blur-2xl transition-all duration-300 origin-bottom-right ${
          isOpen
            ? "pointer-events-auto opacity-100 translate-y-0 scale-100 block"
            : "pointer-events-none opacity-0 translate-y-5 scale-90 hidden"
        }`}
      >
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-ink-700 via-ink-600 to-ink-700 px-5 py-4">
          <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gold-400/15 blur-2xl"></div>
          <div className="relative flex items-center gap-3">
            <div className="relative">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600">
                <svg
                  className="h-5 w-5 text-ink-900"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" />
                </svg>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink-700 bg-emerald-400"></span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">
                Aurelia Concierge
              </p>
              <p className="truncate flex items-center gap-1.5 text-[10px] text-emerald-300/80">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400"></span>
                Online • Personal Butler 24/7
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* 4-Language Switcher Bar */}
          <div className="relative mt-3 flex items-center justify-between gap-1 rounded-xl border border-white/10 bg-ink-900/50 p-1">
            {LANG_OPTIONS.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setActiveLang(l.code)}
                className={`flex-1 rounded-lg py-1 text-[10px] font-medium transition ${
                  activeLang === l.code
                    ? "bg-gold-400 text-ink-900 font-bold"
                    : "text-white/65 hover:bg-white/5 hover:text-gold-300"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="no-scrollbar h-[380px] space-y-3 overflow-y-auto p-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex animate-slide-up ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {m.role === "assistant" ? (
                <div className="flex max-w-[92%] gap-2">
                  <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600">
                    <svg
                      className="h-3.5 w-3.5 text-ink-900"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" />
                    </svg>
                  </div>
                  <div className="space-y-2.5 min-w-0 flex-1">
                    <div
                      onClick={(e) => {
                        const target = (e.target as HTMLElement)?.closest(
                          '[data-chat-action="direct-payment"]'
                        );
                        if (target) {
                          e.preventDefault();
                          setIsOpen(false);
                          const resolved = resolveCheckoutFromMessage(
                            m,
                            messages
                          );
                          onDirectCheckoutPayment(resolved);
                        }
                      }}
                      className="rounded-2xl rounded-tl-sm border border-white/10 bg-white/[.06] px-3.5 py-2.5 text-[12px] leading-relaxed text-white/80"
                      dangerouslySetInnerHTML={{
                        __html: formatInteractiveChatHtml(m.content),
                      }}
                    />

                    {/* Multi-Stay or Direct Booking Checkout Card inside Chat */}
                    {m.bookingCheckout && m.bookingCheckout.items.length > 0 ? (
                      <div className="rounded-2xl border border-gold-400/45 bg-gradient-to-br from-gold-400/15 via-ink-800 to-ink-900 p-3.5 text-[11px] shadow-card">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gold-300">
                            {m.bookingCheckout.isMultiStay
                              ? `✦ Multi-City Checkout (${m.bookingCheckout.totalStays} Stays • ${m.bookingCheckout.totalNights} Nights)`
                              : `✦ Direct Booking Checkout (${m.bookingCheckout.totalNights} Nights)`}
                          </span>
                        </div>

                        <div className="mt-2.5 space-y-2">
                          {m.bookingCheckout.items.map((leg, idx) => (
                            <div
                              key={`${leg.hotelId}-${idx}`}
                              className="rounded-xl border border-white/10 bg-ink-900/70 p-2.5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-serif text-xs font-medium text-white">
                                    {m.bookingCheckout!.isMultiStay
                                      ? `Stay #${idx + 1}: `
                                      : ""}
                                    {leg.hotelName}{" "}
                                    <span className="text-[10px] font-sans text-gold-300">
                                      ({leg.hotelCity})
                                    </span>
                                  </p>
                                  <p className="text-[10px] text-white/55">
                                    {leg.roomName} • {leg.nights} night(s)
                                  </p>
                                  <p className="mt-0.5 text-[10px] text-white/40">
                                    📅 {fmtDate(leg.checkIn)} →{" "}
                                    {fmtDate(leg.checkOut)}
                                  </p>
                                </div>
                                <p className="font-semibold text-gold-300">
                                  {fmtRp(leg.total)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-2.5 space-y-1 border-t border-white/10 pt-2 text-[10px] text-white/55">
                          <div className="flex justify-between">
                            <span>Subtotal ({m.bookingCheckout.totalNights} nights)</span>
                            <span>{fmtRp(m.bookingCheckout.grandSubtotal)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>VAT (11%) + Service (5%)</span>
                            <span>
                              {fmtRp(
                                m.bookingCheckout.grandTax +
                                  m.bookingCheckout.grandService
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between pt-1 text-xs font-semibold text-white">
                            <span>Grand Total</span>
                            <span className="text-gold-300">
                              {fmtRp(m.bookingCheckout.grandTotal)}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-col gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setIsOpen(false);
                              onDirectCheckoutPayment(m.bookingCheckout!);
                            }}
                            className="w-full rounded-xl bg-gradient-to-r from-gold-400 to-gold-600 py-2.5 text-[11px] font-bold text-ink-900 shadow-glow transition hover:opacity-95"
                          >
                            🔒 Proceed Directly to Payment →
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsOpen(false);
                              onReviewCheckoutBooking(m.bookingCheckout!);
                            }}
                            className="w-full rounded-xl border border-white/15 py-1.5 text-[10px] text-white/70 transition hover:border-gold-400/50 hover:text-gold-300"
                          >
                            Review / Edit Guest Details
                          </button>
                        </div>
                      </div>
                    ) : (
                      m.priceQuote && (
                        <div className="rounded-2xl border border-gold-400/35 bg-gold-400/[.07] p-3 text-[11px]">
                          <div className="flex items-center justify-between text-gold-300 font-semibold">
                            <span>
                              ✦ Estimated Quote ({m.priceQuote.nights} Nights)
                            </span>
                            <span>{fmtRp(m.priceQuote.total)}</span>
                          </div>
                          <p className="mt-1 text-white/60">
                            {m.priceQuote.hotelName} • {m.priceQuote.roomName}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setIsOpen(false);
                              onStartQuoteBooking(m.priceQuote!);
                            }}
                            className="mt-2.5 w-full rounded-xl bg-gradient-to-r from-gold-400 to-gold-600 py-2 text-[11px] font-semibold text-ink-900 transition hover:opacity-95"
                          >
                            Proceed to Booking →
                          </button>
                        </div>
                      )
                    )}

                    {/* Recommended Hotel Mini Cards */}
                    {m.recommendedHotels && m.recommendedHotels.length > 0 && (
                      <div className="space-y-2">
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
                              className="rounded-2xl border border-white/10 bg-ink-900/75 p-2.5 transition hover:border-gold-400/50"
                            >
                              <div
                                onClick={() => {
                                  setIsOpen(false);
                                  onSelectHotel(h.id, cardNights);
                                }}
                                className="group flex cursor-pointer items-center gap-3"
                              >
                                <img
                                  src={h.image}
                                  alt={h.name}
                                  className="h-12 w-14 shrink-0 rounded-xl object-cover"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <p className="truncate font-serif text-xs text-white group-hover:text-gold-300">
                                      {h.name}
                                    </p>
                                    <span className="rounded bg-gold-400/20 px-1.5 py-0.5 text-[9px] font-bold text-gold-300">
                                      ★ {h.rating}
                                    </span>
                                  </div>
                                  <p className="truncate text-[10px] text-white/40">
                                    {h.location}
                                  </p>
                                  <p className="mt-0.5 text-[11px] font-medium text-gold-300">
                                    {fmtRp(h.price)}{" "}
                                    <span className="text-[9px] text-white/35">
                                      /night
                                    </span>
                                  </p>
                                </div>
                              </div>
                              <div className="mt-2 flex gap-1.5 border-t border-white/10 pt-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsOpen(false);
                                    onSelectHotel(h.id, cardNights);
                                  }}
                                  className="flex-1 rounded-lg border border-white/15 py-1 text-[10px] text-white/70 transition hover:border-gold-400/50 hover:text-gold-300"
                                >
                                  Hotel Details
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsOpen(false);
                                    onQuickBookHotel(h.id, cardNights);
                                  }}
                                  className="flex-1 rounded-lg bg-gradient-to-r from-gold-400 to-gold-600 py-1 text-[10px] font-semibold text-ink-900 transition hover:opacity-95"
                                >
                                  Book Now
                                  {cardNights && cardNights > 0
                                    ? ` (${cardNights}n)`
                                    : ""}{" "}
                                  →
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-gold-400 to-gold-600 px-3.5 py-2.5 text-[12px] leading-relaxed text-ink-900 font-medium">
                  {m.content}
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="flex gap-2">
                <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600">
                  <svg
                    className="h-3.5 w-3.5 text-ink-900"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" />
                  </svg>
                </div>
                <div className="dot-typing rounded-2xl rounded-tl-sm border border-white/10 bg-white/[.06] px-4 py-3">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick replies */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-2 no-scrollbar">
          {currentLangObj.sampleQuickReplies.map((q) => (
            <button
              type="button"
              key={q}
              onClick={() => onSendMessage(q)}
              className="shrink-0 rounded-full border border-gold-400/25 bg-gold-400/5 px-3 py-1.5 text-[10px] text-gold-300/80 transition hover:border-gold-400/60 hover:bg-gold-400/15"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="border-t border-white/10 p-3">
          <div className="flex items-end gap-2 rounded-2xl bg-white/5 p-1.5">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={currentLangObj.placeholder}
              className="max-h-24 flex-1 resize-none bg-transparent px-3 py-2 text-sm text-white placeholder-white/30 outline-none"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={isTyping}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-gold-300 to-gold-600 text-ink-900 transition hover:shadow-glow active:scale-95 disabled:opacity-40"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* FAB Button */}
      <button
        type="button"
        onClick={() => {
          const next = !isOpen;
          setIsOpen(next);
          if (next) setTimeout(() => inputRef.current?.focus(), 250);
        }}
        className="pointer-events-auto group relative grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-gold-300 via-gold-400 to-gold-600 shadow-[0_10px_40px_-5px_rgba(220,174,58,.6)] transition-all duration-300 hover:scale-110 active:scale-95"
      >
        <span className="pulse-ring pointer-events-none absolute inset-0 rounded-full bg-gold-400/40"></span>
        {!isOpen ? (
          <svg
            className="relative h-7 w-7 text-ink-900"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        ) : (
          <svg
            className="relative h-7 w-7 text-ink-900"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
