"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ChatTurn,
  LLMConfigState,
  LLMPriceQuote,
  LLMRecommendedHotel,
} from "@/types";
import { fmtRp } from "@/lib/hotelApi";
import { fetchLLMConfig } from "@/lib/llmApi";

interface ConciergeStudioViewProps {
  messages: ChatTurn[];
  quickReplies: string[];
  isTyping: boolean;
  onSendMessage: (text: string) => void;
  onResetChat: () => void;
  onSelectHotel: (hotelId: string) => void;
  onQuickBookHotel: (hotelId: string) => void;
  onStartQuoteBooking: (quote: LLMPriceQuote) => void;
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
}: ConciergeStudioViewProps) {
  const [input, setInput] = useState("");
  const [llmState, setLlmState] = useState<LLMConfigState | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
            Ask for luxury destination recommendations, room rate calculations, active promotions, or your reservation status.
          </p>
        </div>

        <button
          type="button"
          onClick={onResetChat}
          className="rounded-xl border border-white/15 px-4 py-2.5 text-xs text-white/60 transition hover:border-gold-400/50 hover:text-gold-300"
        >
          New Conversation
        </button>
      </div>

      {/* MAIN CONVERSATION WORKSPACE */}
      <div className="card-glass flex flex-col overflow-hidden border-white/10">
        {/* Status bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-white/[.02] px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
            <span className="text-xs font-medium text-white/80">
              Aurelia Personal Butler • Online 24/7
            </span>
          </div>
        </div>

        {/* Preset Questions */}
        <div className="border-b border-white/5 bg-ink-900/40 px-6 py-3">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-white/35">
            Popular Topics:
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
        <div className="h-[460px] space-y-5 overflow-y-auto p-6">
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
                      className="rounded-2xl rounded-tl-sm border border-white/10 bg-white/[.05] px-5 py-4 text-sm leading-relaxed text-white/85"
                      dangerouslySetInnerHTML={{ __html: m.content }}
                    />

                    {/* Interactive Quote Simulation Card */}
                    {m.priceQuote && (
                      <div className="rounded-2xl border border-gold-400/40 bg-gradient-to-br from-gold-400/10 via-ink-800 to-ink-900 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-[10px] uppercase tracking-widest text-gold-400">
                              ✦ ESTIMATED BOOKING BREAKDOWN
                            </span>
                            <h4 className="font-serif text-lg text-white">
                              {m.priceQuote.hotelName} — {m.priceQuote.roomName}
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
                    )}

                    {/* Recommended Hotels Grid inside Chat */}
                    {m.recommendedHotels && m.recommendedHotels.length > 0 && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {m.recommendedHotels.map((h: LLMRecommendedHotel) => (
                          <div
                            key={h.id}
                            className="group overflow-hidden rounded-2xl border border-white/10 bg-ink-900/80 transition hover:border-gold-400/50"
                          >
                            <div
                              onClick={() => onSelectHotel(h.id)}
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
                                onClick={() => onSelectHotel(h.id)}
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
                                  onClick={() => onSelectHotel(h.id)}
                                  className="flex-1 rounded-xl border border-white/15 py-1.5 text-[11px] text-white/75 transition hover:border-gold-400/50 hover:text-gold-300"
                                >
                                  View Rooms
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onQuickBookHotel(h.id)}
                                  className="flex-1 rounded-xl bg-gradient-to-r from-gold-400 to-gold-600 py-1.5 text-[11px] font-semibold text-ink-900 transition hover:opacity-95"
                                >
                                  Book Now →
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
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
            {quickReplies.map((q) => (
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
              placeholder="Ask for hotel recommendations, room types, or stay price quotes…"
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
