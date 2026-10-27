"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChatTurn, LLMPriceQuote, LLMRecommendedHotel } from "@/types";
import { fmtRp } from "@/lib/hotelApi";

interface FloatingConciergeProps {
  messages: ChatTurn[];
  quickReplies: string[];
  isTyping: boolean;
  onSendMessage: (text: string) => void;
  onSelectHotel: (hotelId: string) => void;
  onQuickBookHotel: (hotelId: string) => void;
  onStartQuoteBooking: (quote: LLMPriceQuote) => void;
}

export default function FloatingConcierge({
  messages,
  quickReplies,
  isTyping,
  onSendMessage,
  onSelectHotel,
  onQuickBookHotel,
  onStartQuoteBooking,
}: FloatingConciergeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
        className={`w-[calc(100vw-3rem)] max-w-[400px] overflow-hidden rounded-3xl border border-white/10 bg-ink-800/95 shadow-[0_30px_80px_-20px_rgba(0,0,0,.9)] backdrop-blur-2xl transition-all duration-300 origin-bottom-right ${
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
        </div>

        {/* Messages */}
        <div className="no-scrollbar h-[360px] space-y-3 overflow-y-auto p-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex animate-slide-up ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {m.role === "assistant" ? (
                <div className="flex max-w-[90%] gap-2">
                  <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600">
                    <svg
                      className="h-3.5 w-3.5 text-ink-900"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" />
                    </svg>
                  </div>
                  <div className="space-y-2.5 min-w-0">
                    <div
                      className="rounded-2xl rounded-tl-sm border border-white/10 bg-white/[.06] px-3.5 py-2.5 text-[12px] leading-relaxed text-white/80"
                      dangerouslySetInnerHTML={{ __html: m.content }}
                    />

                    {/* Price Quote Card inside Chat */}
                    {m.priceQuote && (
                      <div className="rounded-2xl border border-gold-400/35 bg-gold-400/[.07] p-3 text-[11px]">
                        <div className="flex items-center justify-between text-gold-300 font-semibold">
                          <span>
                            ✦ Estimasi Biaya ({m.priceQuote.nights} Malam)
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
                          Lanjut ke Pemesanan →
                        </button>
                      </div>
                    )}

                    {/* Recommended Hotel Mini Cards */}
                    {m.recommendedHotels && m.recommendedHotels.length > 0 && (
                      <div className="space-y-2">
                        {m.recommendedHotels.map((h: LLMRecommendedHotel) => (
                          <div
                            key={h.id}
                            className="rounded-2xl border border-white/10 bg-ink-900/75 p-2.5 transition hover:border-gold-400/50"
                          >
                            <div
                              onClick={() => {
                                setIsOpen(false);
                                onSelectHotel(h.id);
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
                                    /malam
                                  </span>
                                </p>
                              </div>
                            </div>
                            <div className="mt-2 flex gap-1.5 border-t border-white/10 pt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsOpen(false);
                                  onSelectHotel(h.id);
                                }}
                                className="flex-1 rounded-lg border border-white/15 py-1 text-[10px] text-white/70 transition hover:border-gold-400/50 hover:text-gold-300"
                              >
                                Detail Hotel
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsOpen(false);
                                  onQuickBookHotel(h.id);
                                }}
                                className="flex-1 rounded-lg bg-gradient-to-r from-gold-400 to-gold-600 py-1 text-[10px] font-semibold text-ink-900 transition hover:opacity-95"
                              >
                                Lanjut Pemesanan →
                              </button>
                            </div>
                          </div>
                        ))}
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
          {quickReplies.map((q) => (
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
              placeholder="Tanyakan rekomendasi hotel atau pemesanan…"
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
