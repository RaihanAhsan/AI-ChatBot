"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookingDraft,
  BookingItem,
  ChatTurn,
  Hotel,
  LLMPriceQuote,
  Room,
  UserProfile,
} from "@/types";
import {
  FALLBACK_HOTELS,
  apiCreateBooking,
  apiGetBookings,
  apiGetHotels,
  calcTotals,
  clearAuthSession,
  fmtDate,
  fmtRp,
  getSavedUser,
  nightsBetween,
  saveAuthSession,
  todayISO,
} from "@/lib/hotelApi";
import { sendLLMChatMessage } from "@/lib/llmApi";
import FloatingConcierge from "@/components/llm/FloatingConcierge";
import ConciergeStudioView from "@/components/llm/ConciergeStudioView";

type PageName =
  | "home"
  | "detail"
  | "booking"
  | "payment"
  | "success"
  | "profile"
  | "concierge";

interface ToastMsg {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

const INITIAL_BOT_WELCOME =
  'Selamat datang di <b class="text-gold-300">Aurelia Collection</b> ✦<br><br>Saya Aurelia Concierge, siap membantu Anda menemukan penginapan terbaik, menghitung rincian biaya kamar, atau memeriksa status reservasi Anda. Ada yang bisa saya bantu?';

const DEFAULT_QUICK_REPLIES = [
  "Hotel rekomendasi di Bali",
  "Hitung biaya 3 malam di Maldives",
  "Cara pesan kamar?",
  "Metode pembayaran",
  "Kebijakan pembatalan",
];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [currentPage, setCurrentPage] = useState<PageName>("home");
  const [scrolled, setScrolled] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Hotels & Filters
  const [hotels, setHotels] = useState<Hotel[]>(FALLBACK_HOTELS);
  const [activeCity, setActiveCity] = useState("");
  const [searchCity, setSearchCity] = useState("");
  const [searchCheckIn, setSearchCheckIn] = useState(todayISO(1));
  const [searchCheckOut, setSearchCheckOut] = useState(todayISO(3));
  const [wishlist, setWishlist] = useState<string[]>([]);

  // Detail & Selection
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [detailCheckIn, setDetailCheckIn] = useState(todayISO(1));
  const [detailCheckOut, setDetailCheckOut] = useState(todayISO(3));
  const [detailGuests, setDetailGuests] = useState(2);

  // Booking Draft & Guest Form
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("+62 812 3456 7890");
  const [guestCountry, setGuestCountry] = useState("Indonesia");
  const [guestRequests, setGuestRequests] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [bookingErr, setBookingErr] = useState("");

  // Payment
  const [payMethod, setPayMethod] = useState<"card" | "va" | "ewallet">("card");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [paymentErr, setPaymentErr] = useState("");
  const [processingText, setProcessingText] = useState<string | null>(null);
  const [lastBooking, setLastBooking] = useState<BookingItem | null>(null);

  // Profile & Bookings
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [bookingTab, setBookingTab] = useState<"all" | "upcoming" | "completed">(
    "all"
  );
  const [detailModalBooking, setDetailModalBooking] =
    useState<BookingItem | null>(null);

  // Toast
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  // Chatbot State
  const [chatMessages, setChatMessages] = useState<ChatTurn[]>([
    {
      id: "welcome",
      role: "assistant",
      content: INITIAL_BOT_WELCOME,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [quickReplies, setQuickReplies] = useState<string[]>(
    DEFAULT_QUICK_REPLIES
  );
  const [isChatTyping, setIsChatTyping] = useState(false);

  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "success"
  ) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  };

  // Auth Guard: Redirect unauthenticated users immediately to /login
  useEffect(() => {
    const savedUser = getSavedUser();
    if (!savedUser) {
      clearAuthSession();
      router.replace("/login");
      return;
    }

    saveAuthSession(savedUser);
    setUser(savedUser);
    setGuestName(savedUser.name || "");
    setGuestEmail(savedUser.email || "");
    setGuestPhone(savedUser.phone || "+62 812 3456 7890");
    setAuthChecked(true);

    apiGetHotels().then((list) => {
      if (list && list.length > 0) setHotels(list);
    });
    apiGetBookings(savedUser.email).then(setBookings);

    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [router]);

  const goPage = (page: PageName) => {
    setCurrentPage(page);
    setUserMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (page === "profile" && user) {
      apiGetBookings(user.email).then(setBookings);
    }
  };

  const handleLogout = () => {
    clearAuthSession();
    setUser(null);
    setUserMenuOpen(false);
    router.replace("/login");
  };

  // Hotel Actions
  const openHotel = (hotelId: string) => {
    const h =
      hotels.find((x) => x.id === hotelId) ||
      FALLBACK_HOTELS.find((x) => x.id === hotelId);
    if (!h) return;
    setSelectedHotel(h);
    setSelectedRoom(h.rooms[0]);
    const ci = searchCheckIn || todayISO(1);
    let co = searchCheckOut || todayISO(3);
    if (nightsBetween(ci, co) <= 0) {
      const d = new Date(ci);
      d.setDate(d.getDate() + 2);
      co = d.toISOString().split("T")[0];
    }
    setDetailCheckIn(ci);
    setDetailCheckOut(co);
    goPage("detail");
  };

  const quickBookHotel = (hotelId: string) => {
    const h =
      hotels.find((x) => x.id === hotelId) ||
      FALLBACK_HOTELS.find((x) => x.id === hotelId) ||
      hotels[0];
    if (!h) return;
    const r = h.rooms[0];
    const ci = detailCheckIn || searchCheckIn || todayISO(1);
    let co = detailCheckOut || searchCheckOut || todayISO(3);
    let n = nightsBetween(ci, co);
    if (n <= 0) {
      const d = new Date(ci);
      d.setDate(d.getDate() + 2);
      co = d.toISOString().split("T")[0];
      n = 2;
    }
    setSelectedHotel(h);
    setSelectedRoom(r);
    setDetailCheckIn(ci);
    setDetailCheckOut(co);
    setDraft({
      hotelId: h.id,
      hotelName: h.name,
      hotelImage: h.image,
      hotelLocation: h.location,
      roomId: r.id,
      roomName: r.name,
      roomPrice: r.price,
      checkIn: ci,
      checkOut: co,
      guests: detailGuests || 2,
      nights: n,
    });
    if (user) {
      setGuestName((prev) => prev || user.name);
      setGuestEmail((prev) => prev || user.email);
    }
    goPage("booking");
  };

  const toggleWishlist = (hotelId: string) => {
    setWishlist((prev) => {
      const exists = prev.includes(hotelId);
      showToast(
        exists ? "Dihapus dari wishlist" : "Ditambahkan ke wishlist",
        "info"
      );
      return exists ? prev.filter((x) => x !== hotelId) : [...prev, hotelId];
    });
  };

  const handleSearch = () => {
    setActiveCity(searchCity);
    setTimeout(() => {
      document
        .getElementById("hotelsSection")
        ?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    showToast("Menampilkan hasil pencarian", "info");
  };

  // Start Booking from Detail
  const startBooking = (roomOverride?: Room) => {
    const h = selectedHotel || hotels[0];
    const r = roomOverride || selectedRoom || h?.rooms?.[0];
    if (!h || !r) {
      return showToast("Pilih kamar terlebih dahulu", "error");
    }
    const ci = detailCheckIn || todayISO(1);
    let co = detailCheckOut || todayISO(3);
    let n = nightsBetween(ci, co);
    if (n <= 0) {
      const d = new Date(ci);
      d.setDate(d.getDate() + 1);
      co = d.toISOString().split("T")[0];
      setDetailCheckOut(co);
      n = 1;
    }

    setSelectedRoom(r);
    setDraft({
      hotelId: h.id,
      hotelName: h.name,
      hotelImage: h.image,
      hotelLocation: h.location,
      roomId: r.id,
      roomName: r.name,
      roomPrice: r.price,
      checkIn: ci,
      checkOut: co,
      guests: detailGuests || 2,
      nights: n,
    });
    if (user) {
      setGuestName((prev) => prev || user.name);
      setGuestEmail((prev) => prev || user.email);
    }
    goPage("booking");
  };

  // Start Booking directly from Chatbot Quote Card
  const startBookingFromQuote = (quote: LLMPriceQuote) => {
    const h = hotels.find((x) => x.id === quote.hotelId) || hotels[0];
    const r = h.rooms.find((x) => x.id === quote.roomId) || h.rooms[0];
    setSelectedHotel(h);
    setSelectedRoom(r);
    const ci = todayISO(1);
    const co = todayISO(1 + quote.nights);
    setDetailCheckIn(ci);
    setDetailCheckOut(co);
    setDraft({
      hotelId: h.id,
      hotelName: h.name,
      hotelImage: h.image,
      hotelLocation: h.location,
      roomId: r.id,
      roomName: r.name,
      roomPrice: r.price,
      checkIn: ci,
      checkOut: co,
      guests: 2,
      nights: quote.nights,
    });
    if (user) {
      setGuestName((prev) => prev || user.name);
      setGuestEmail((prev) => prev || user.email);
    }
    goPage("booking");
    showToast(
      `Simulasi ${quote.nights} malam di ${h.name} siap dipesan!`,
      "info"
    );
  };

  const handleBookingFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBookingErr("");
    if (!guestName.trim()) {
      setBookingErr("Nama lengkap wajib diisi.");
      return showToast("Nama lengkap wajib diisi.", "error");
    }
    if (!/^\S+@\S+\.\S+$/.test(guestEmail.trim())) {
      setBookingErr("Format email tidak valid.");
      return showToast("Format email tidak valid.", "error");
    }
    if (guestPhone.trim().length < 8) {
      setBookingErr("Nomor telepon tidak valid.");
      return showToast("Nomor telepon tidak valid.", "error");
    }
    if (!agreeTerms) {
      setBookingErr("Anda harus menyetujui syarat & ketentuan.");
      return showToast("Anda harus menyetujui syarat & ketentuan.", "error");
    }
    if (!draft) return;

    setDraft({
      ...draft,
      guestName: guestName.trim(),
      guestEmail: guestEmail.trim(),
      guestPhone: guestPhone.trim(),
      guestCountry,
      requests: guestRequests.trim(),
    });
    goPage("payment");
  };

  const fireConfetti = () => {
    const colors = ["#e6c565", "#dcae3a", "#c9922a", "#fff6d5", "#ffffff"];
    for (let i = 0; i < 85; i++) {
      const el = document.createElement("div");
      el.className = "confetti-piece";
      el.style.left = Math.random() * 100 + "vw";
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
      el.style.animationDuration = 2.2 + Math.random() * 2 + "s";
      el.style.animationDelay = Math.random() * 0.8 + "s";
      el.style.width = el.style.height = 5 + Math.random() * 8 + "px";
      el.style.opacity = "0.9";
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 5000);
    }
  };

  const processPayment = async (methodLabel = "Kartu Kredit") => {
    if (!draft) return;
    setProcessingText("Memproses pembayaran…");
    setTimeout(() => setProcessingText("Mengonfirmasi reservasi…"), 1000);

    setTimeout(async () => {
      const created = await apiCreateBooking({
        userEmail: user?.email || "demo@aurelia.com",
        hotelId: draft.hotelId,
        roomId: draft.roomId,
        checkIn: draft.checkIn,
        checkOut: draft.checkOut,
        guests: draft.guests,
        guestName: draft.guestName || guestName,
        guestEmail: draft.guestEmail || guestEmail,
        guestPhone: draft.guestPhone || guestPhone,
        guestCountry: draft.guestCountry || guestCountry,
        requests: draft.requests || guestRequests,
        paymentMethod: methodLabel,
      });

      const updatedBookings = [created, ...bookings];
      setBookings(updatedBookings);
      localStorage.setItem("aurelia_bookings", JSON.stringify(updatedBookings));
      setLastBooking(created);
      setProcessingText(null);
      goPage("success");
      fireConfetti();
      showToast("Pembayaran berhasil! Reservasi dikonfirmasi.", "success");
    }, 2100);
  };

  const handleCardPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentErr("");
    const num = cardNumber.replace(/\s/g, "");
    if (num.length !== 16) {
      setPaymentErr("Nomor kartu harus 16 digit.");
      return showToast("Nomor kartu harus 16 digit.", "error");
    }
    if (!cardName.trim()) {
      setPaymentErr("Nama pemegang kartu wajib diisi.");
      return showToast("Nama pemegang kartu wajib diisi.", "error");
    }
    if (!/^\d{2}\/\d{2}$/.test(cardExp)) {
      setPaymentErr("Format masa berlaku MM/YY.");
      return showToast("Format masa berlaku MM/YY.", "error");
    }
    if (cardCvv.length < 3) {
      setPaymentErr("CVV tidak valid.");
      return showToast("CVV tidak valid.", "error");
    }
    processPayment("Kartu Kredit");
  };

  // Chatbot Handler
  const handleSendChatMessage = async (text: string) => {
    const userTurn: ChatTurn = {
      id: "u-" + Date.now(),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    const nextHistory = [...chatMessages, userTurn];
    setChatMessages(nextHistory);
    setIsChatTyping(true);

    try {
      const apiMessages = nextHistory.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const res = await sendLLMChatMessage(
        apiMessages,
        user?.email || "demo@aurelia.com"
      );

      const botTurn: ChatTurn = {
        id: "b-" + Date.now(),
        role: "assistant",
        content: res.reply,
        intent: res.intent,
        recommendedHotels: res.recommendedHotels,
        priceQuote: res.priceQuote,
        metadata: res.metadata,
        timestamp: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, botTurn]);
      if (res.quickReplies && res.quickReplies.length > 0) {
        setQuickReplies(res.quickReplies);
      }
    } finally {
      setIsChatTyping(false);
    }
  };

  const handleResetChat = () => {
    setChatMessages([
      {
        id: "welcome-" + Date.now(),
        role: "assistant",
        content: INITIAL_BOT_WELCOME,
        timestamp: new Date().toISOString(),
      },
    ]);
    setQuickReplies(DEFAULT_QUICK_REPLIES);
    showToast("Percakapan baru dimulai.", "info");
  };

  if (!authChecked || !user) {
    return (
      <div className="min-h-screen grid place-items-center bg-ink-900">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold-400/20 border-t-gold-400"></div>
      </div>
    );
  }

  const isAdmin = user.role === "admin";
  const userInitial = user.name.charAt(0).toUpperCase();

  const filteredHotels = activeCity
    ? hotels.filter((h) => h.city.toLowerCase() === activeCity.toLowerCase())
    : hotels;

  const filteredBookings =
    bookingTab === "all"
      ? bookings
      : bookings.filter((b) => b.status === bookingTab);

  const totalNights = bookings.reduce((s, b) => s + b.nights, 0);
  const totalSpent = bookings.reduce((s, b) => s + b.total, 0);
  const rewardPoints = Math.floor(totalSpent / 100000);

  const detailNights = nightsBetween(detailCheckIn, detailCheckOut);
  const draftTotals = draft
    ? calcTotals(draft.roomPrice, draft.nights)
    : { subtotal: 0, tax: 0, service: 0, total: 0 };

  return (
    <div className="min-h-screen">
      {/* TOAST CONTAINER */}
      <div className="fixed right-5 top-5 z-[80] flex flex-col gap-3">
        {toasts.map((t) => {
          const styles = {
            success: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
            error: "border-red-400/30 bg-red-500/10 text-red-200",
            info: "border-gold-400/30 bg-gold-500/10 text-gold-200",
          }[t.type];
          return (
            <div
              key={t.id}
              className={`animate-slide-up flex items-center gap-3 rounded-xl border px-4 py-3 text-xs shadow-card backdrop-blur-xl ${styles}`}
            >
              <span>✦</span>
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>

      {/* LOADING OVERLAY */}
      {processingText && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-ink-900/90 backdrop-blur-md">
          <div className="flex flex-col items-center gap-6">
            <div className="relative h-20 w-20">
              <div className="absolute inset-0 rounded-full border-2 border-gold-400/20"></div>
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-gold-400"></div>
              <div className="absolute inset-0 grid place-items-center">
                <svg
                  className="h-6 w-6 text-gold-300"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" />
                </svg>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-white/80">
                {processingText}
              </p>
              <p className="mt-1.5 text-[11px] tracking-wider text-white/30">
                Mohon jangan tutup halaman ini
              </p>
            </div>
          </div>
        </div>
      )}

      {/* BOOKING DETAIL MODAL */}
      {detailModalBooking && (
        <div
          onClick={() => setDetailModalBooking(null)}
          className="fixed inset-0 z-[75] grid place-items-center bg-ink-900/80 p-4 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card-glass w-full max-w-md p-6 border-gold-400/30 animate-pop"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-[.3em] text-gold-400">
                DETAIL RESERVASI
              </span>
              <button
                onClick={() => setDetailModalBooking(null)}
                className="text-xs text-white/40 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="mt-2 font-mono text-2xl tracking-widest text-gold-300">
              {detailModalBooking.code}
            </p>
            <p className="mt-1 font-serif text-xl text-white">
              {detailModalBooking.hotelName}
            </p>
            <p className="text-xs text-white/40">
              {detailModalBooking.hotelLocation}
            </p>
            <div className="my-4 h-px bg-white/10"></div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-white/40">Kamar</span>
                <span className="text-white/85">
                  {detailModalBooking.roomName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Check-in</span>
                <span className="text-white/85">
                  {fmtDate(detailModalBooking.checkIn)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Check-out</span>
                <span className="text-white/85">
                  {fmtDate(detailModalBooking.checkOut)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Durasi & Tamu</span>
                <span className="text-white/85">
                  {detailModalBooking.nights} malam •{" "}
                  {detailModalBooking.guests} dewasa
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Nama Tamu</span>
                <span className="text-white/85">
                  {detailModalBooking.guestName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Telepon</span>
                <span className="text-white/85">
                  {detailModalBooking.guestPhone}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Permintaan</span>
                <span className="text-white/85">
                  {detailModalBooking.requests || "—"}
                </span>
              </div>
              <div className="my-2 h-px bg-white/10"></div>
              <div className="flex justify-between font-semibold">
                <span className="text-white/60">Total Dibayar</span>
                <span className="text-gold-300">
                  {fmtRp(detailModalBooking.total)}
                </span>
              </div>
            </div>
            <button
              onClick={() => setDetailModalBooking(null)}
              className="btn-gold mt-5 w-full py-2.5 text-xs"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <header
        className={`fixed inset-x-0 top-0 z-40 transition-all duration-500 ${
          scrolled
            ? "bg-ink-900/85 backdrop-blur-xl border-b border-white/5 shadow-lg"
            : ""
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <button
            onClick={() => goPage("home")}
            className="flex items-center gap-3 text-left"
          >
            <div className="grid h-10 w-10 place-items-center rounded-full border border-gold-400/50 bg-gold-400/10">
              <svg
                className="h-4 w-4 text-gold-300"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" />
              </svg>
            </div>
            <div className="leading-none">
              <p className="font-serif text-lg tracking-wide">Aurelia</p>
              <p className="mt-0.5 text-[9px] tracking-[.3em] text-gold-400/70">
                COLLECTION
              </p>
            </div>
          </button>

          <nav className="hidden items-center gap-7 text-[13px] font-medium text-white/60 md:flex">
            <button
              onClick={() => goPage("home")}
              className={`transition hover:text-gold-300 ${
                currentPage === "home" ? "text-gold-300" : ""
              }`}
            >
              Beranda
            </button>
            <button
              onClick={() => {
                goPage("home");
                setTimeout(
                  () =>
                    document
                      .getElementById("hotelsSection")
                      ?.scrollIntoView({ behavior: "smooth" }),
                  120
                );
              }}
              className="transition hover:text-gold-300"
            >
              Hotel
            </button>
            <button
              onClick={() => goPage("profile")}
              className={`transition hover:text-gold-300 ${
                currentPage === "profile" ? "text-gold-300" : ""
              }`}
            >
              Reservasi Saya
            </button>
            <button
              onClick={() => goPage("concierge")}
              className={`transition hover:text-gold-300 ${
                currentPage === "concierge" ? "text-gold-300" : ""
              }`}
            >
              Tanya Concierge
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-4 transition hover:border-gold-400/50"
              >
                <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-gold-400 to-gold-700 text-xs font-bold text-ink-900">
                  {userInitial}
                </div>
                <span className="hidden text-xs font-medium text-white/80 sm:block">
                  {user.name.split(" ")[0]}
                </span>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-3 w-60 overflow-hidden rounded-2xl border border-white/10 bg-ink-800/95 p-2 shadow-card backdrop-blur-xl">
                  <div className="px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">
                        {user.name}
                      </p>
                      <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] uppercase text-gold-300">
                        {user.tier}
                      </span>
                    </div>
                    <p className="truncate text-[11px] text-white/40">
                      {user.email}
                    </p>
                  </div>
                  <div className="my-1 h-px bg-white/10"></div>
                  <button
                    onClick={() => goPage("profile")}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs text-white/70 transition hover:bg-white/5 hover:text-gold-300"
                  >
                    Profil & Reservasi
                  </button>
                  <button
                    onClick={() => goPage("concierge")}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs text-gold-300 transition hover:bg-white/5"
                  >
                    ✦ Tanya Concierge
                  </button>
                  <div className="my-1 h-px bg-white/10"></div>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs text-red-300/80 transition hover:bg-red-500/10 hover:text-red-300"
                  >
                    Keluar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ======================= PAGE: HOME ======================= */}
      {currentPage === "home" && (
        <section className="animate-page-in">
          {/* HERO */}
          <div className="relative h-[92vh] min-h-[620px] w-full overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=2000&q=80"
              className="absolute inset-0 h-full w-full object-cover ken-burns"
              alt="Hero"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-ink-900/85 via-ink-900/55 to-ink-900"></div>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(220,174,58,.16),transparent_60%)]"></div>

            <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-center px-5 lg:px-8">
              <p className="mb-5 flex items-center gap-3 text-[11px] tracking-[.5em] text-gold-300 animate-fade-up">
                <span className="h-px w-10 bg-gold-400/60"></span> LUXURY
                COLLECTION
              </p>
              <h1 className="max-w-3xl font-serif text-5xl leading-[1.08] text-white sm:text-6xl lg:text-7xl animate-fade-up">
                Temukan penginapan
                <br />
                <span className="gold-shimmer">luar biasa</span> Anda
              </h1>
              <p className="mt-6 max-w-lg text-sm leading-relaxed text-white/55 animate-fade-up">
                Lebih dari 120 properti bintang lima di destinasi terbaik dunia.
                Pesan dalam hitungan detik, nikmati layanan tanpa kompromi.
              </p>

              {/* SEARCH BAR */}
              <div className="mt-12 w-full max-w-4xl animate-fade-up">
                <div className="card-glass grid grid-cols-1 gap-1 p-2 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
                  <div className="rounded-2xl px-5 py-3.5 transition hover:bg-white/5">
                    <label className="label-xs">Destinasi</label>
                    <select
                      value={searchCity}
                      onChange={(e) => setSearchCity(e.target.value)}
                      className="w-full bg-transparent text-sm font-medium text-white outline-none [&>option]:bg-ink-800"
                    >
                      <option value="">Semua destinasi</option>
                      <option value="Bali">Bali</option>
                      <option value="Jakarta">Jakarta</option>
                      <option value="Ubud">Ubud</option>
                      <option value="Singapore">Singapore</option>
                      <option value="Maldives">Maldives</option>
                      <option value="Dubai">Dubai</option>
                    </select>
                  </div>
                  <div className="rounded-2xl px-5 py-3.5 transition hover:bg-white/5">
                    <label className="label-xs">Check-in</label>
                    <input
                      type="date"
                      value={searchCheckIn}
                      min={todayISO(0)}
                      onChange={(e) => {
                        const nextCi = e.target.value;
                        setSearchCheckIn(nextCi);
                        if (nightsBetween(nextCi, searchCheckOut) <= 0) {
                          const d = new Date(nextCi);
                          d.setDate(d.getDate() + 1);
                          setSearchCheckOut(d.toISOString().split("T")[0]);
                        }
                      }}
                      className="w-full bg-transparent text-sm font-medium text-white outline-none [color-scheme:dark]"
                    />
                  </div>
                  <div className="rounded-2xl px-5 py-3.5 transition hover:bg-white/5">
                    <label className="label-xs">Check-out</label>
                    <input
                      type="date"
                      value={searchCheckOut}
                      min={searchCheckIn || todayISO(1)}
                      onChange={(e) => setSearchCheckOut(e.target.value)}
                      className="w-full bg-transparent text-sm font-medium text-white outline-none [color-scheme:dark]"
                    />
                  </div>
                  <button
                    onClick={handleSearch}
                    className="btn-gold m-1 rounded-2xl px-7"
                  >
                    Cari
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* HOTELS SECTION */}
          <div
            id="hotelsSection"
            className="mx-auto max-w-7xl px-5 pb-28 pt-20 lg:px-8"
          >
            <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="mb-3 text-[11px] tracking-[.4em] text-gold-400">
                  KURASI PILIHAN
                </p>
                <h2 className="font-serif text-4xl text-white sm:text-5xl">
                  Hotel <span className="gold-shimmer">Terbaik</span>
                </h2>
                <p className="mt-3 text-sm text-white/40">
                  Dipilih oleh tim kurator kami dari ribuan properti.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  "",
                  "Bali",
                  "Jakarta",
                  "Ubud",
                  "Singapore",
                  "Maldives",
                  "Dubai",
                ].map((city) => {
                  const active = activeCity === city;
                  return (
                    <button
                      key={city || "all"}
                      onClick={() => setActiveCity(city)}
                      className={`rounded-full border px-5 py-2 text-xs font-medium transition ${
                        active
                          ? "border-gold-400/60 bg-gold-400/10 text-gold-300"
                          : "border-white/10 text-white/50 hover:border-gold-400/40 hover:text-gold-300"
                      }`}
                    >
                      {city || "Semua"}
                    </button>
                  );
                })}
              </div>
            </div>

            {filteredHotels.length === 0 ? (
              <div className="py-24 text-center">
                <p className="font-serif text-2xl text-white/50">
                  Tidak ada hotel ditemukan
                </p>
                <p className="mt-2 text-sm text-white/30">
                  Coba ubah filter destinasi Anda.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-3">
                {filteredHotels.map((h) => (
                  <article
                    key={h.id}
                    onClick={() => openHotel(h.id)}
                    className="hotel-card group relative cursor-pointer overflow-hidden rounded-3xl border border-white/10 bg-ink-800/60"
                  >
                    <div className="relative h-60 overflow-hidden">
                      <img
                        src={h.image}
                        alt={h.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/20 to-transparent"></div>

                      <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full border border-white/20 bg-ink-900/60 px-3 py-1 backdrop-blur-md">
                        <span className="text-[10px] tracking-widest text-gold-300">
                          ★ {h.stars}
                        </span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWishlist(h.id);
                        }}
                        className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-ink-900/50 backdrop-blur-md transition hover:border-gold-400 hover:bg-gold-400/20"
                      >
                        <svg
                          className={`h-4 w-4 transition ${
                            wishlist.includes(h.id)
                              ? "text-gold-400 fill-current"
                              : "text-white/70"
                          }`}
                          fill={
                            wishlist.includes(h.id) ? "currentColor" : "none"
                          }
                          stroke="currentColor"
                          strokeWidth="1.8"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                          />
                        </svg>
                      </button>

                      <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                        <div>
                          <p className="text-[10px] tracking-[.25em] text-gold-300/90">
                            {h.city.toUpperCase()}
                          </p>
                          <h3 className="mt-1 font-serif text-xl leading-tight text-white">
                            {h.name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-1 rounded-lg bg-gold-400 px-2 py-1">
                          <span className="text-[11px] font-bold text-ink-900">
                            {h.rating}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-5">
                      <p className="flex items-center gap-1.5 text-[11px] text-white/35">
                        📍 {h.location}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {h.amenities.slice(0, 3).map((a) => (
                          <span
                            key={a}
                            className="rounded-md border border-white/10 bg-white/[.04] px-2 py-1 text-[10px] text-white/45"
                          >
                            {a}
                          </span>
                        ))}
                        {h.amenities.length > 3 && (
                          <span className="rounded-md border border-white/10 bg-white/[.04] px-2 py-1 text-[10px] text-white/45">
                            +{h.amenities.length - 3}
                          </span>
                        )}
                      </div>

                      <div className="mt-5 flex items-end justify-between border-t border-white/10 pt-4">
                        <div>
                          <p className="text-[10px] tracking-wider text-white/30">
                            MULAI DARI
                          </p>
                          <p className="font-serif text-xl text-gold-300">
                            {fmtRp(h.price)}
                            <span className="text-[10px] font-sans text-white/30">
                              {" "}
                              /malam
                            </span>
                          </p>
                        </div>
                        <span className="flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2 text-[11px] font-medium text-white/70 transition group-hover:border-gold-400/60 group-hover:text-gold-300">
                          Lihat →
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          {/* WHY US */}
          <div className="relative overflow-hidden border-y border-white/5 bg-ink-800/40 py-24">
            <div className="mx-auto max-w-7xl px-5 lg:px-8">
              <div className="mb-16 text-center">
                <p className="mb-3 text-[11px] tracking-[.4em] text-gold-400">
                  MENGAPA AURELIA
                </p>
                <h2 className="font-serif text-4xl text-white sm:text-5xl">
                  Standar <span className="gold-shimmer">Tanpa Tanding</span>
                </h2>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    title: "Harga Terjamin",
                    desc: "Harga terbaik tanpa biaya tersembunyi. Jaminan refund 24 jam.",
                  },
                  {
                    title: "Check-in Instan",
                    desc: "Langsung ke kamar tanpa antre. Konfirmasi dalam 60 detik.",
                  },
                  {
                    title: "Butler 24/7",
                    desc: "Asisten pribadi siap membantu kapan pun Anda membutuhkan.",
                  },
                  {
                    title: "Reward Eksklusif",
                    desc: "Kumpulkan poin setiap menginap dan tukar dengan malam gratis.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="card-glass p-7 transition hover:border-gold-400/30 hover:bg-white/[.06]"
                  >
                    <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-gold-400/10 text-gold-300">
                      ✦
                    </div>
                    <h3 className="mb-2 font-serif text-xl">{item.title}</h3>
                    <p className="text-xs leading-relaxed text-white/40">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <footer className="border-t border-white/5 bg-ink-900 py-14">
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-5 sm:flex-row lg:px-8">
              <span className="font-serif text-base text-white/80">
                Aurelia Collection
              </span>
              <p className="text-[11px] tracking-wider text-white/25">
                © 2025 Aurelia Collection
              </p>
            </div>
          </footer>
        </section>
      )}

      {/* ======================= PAGE: DETAIL ======================= */}
      {currentPage === "detail" && selectedHotel && (
        <section className="mx-auto max-w-7xl px-5 pb-24 pt-28 lg:px-8 animate-page-in">
          <button
            onClick={() => goPage("home")}
            className="mb-7 inline-flex items-center gap-2 text-xs text-white/40 transition hover:text-gold-300"
          >
            ← Kembali ke daftar hotel
          </button>

          {/* Gallery */}
          <div className="grid gap-3 lg:grid-cols-4 lg:grid-rows-2">
            <div className="overflow-hidden rounded-3xl lg:col-span-2 lg:row-span-2">
              <img
                src={selectedHotel.image}
                className="h-64 w-full object-cover transition duration-700 hover:scale-105 lg:h-full"
                alt={selectedHotel.name}
              />
            </div>
            {selectedHotel.gallery.slice(0, 4).map((gUrl, idx) => (
              <div key={idx} className="relative overflow-hidden rounded-3xl">
                <img
                  src={gUrl}
                  className="h-32 w-full object-cover transition duration-700 hover:scale-105 lg:h-full"
                  alt=""
                />
                {idx === 3 && (
                  <div className="absolute inset-0 grid place-items-center bg-ink-900/60 text-xs tracking-widest text-white/80">
                    +12 FOTO
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_380px]">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-xs text-gold-400">
                      {"★".repeat(selectedHotel.stars)}
                    </span>
                    <span className="rounded-full border border-gold-400/30 bg-gold-400/10 px-3 py-0.5 text-[10px] tracking-widest text-gold-300">
                      LUXURY
                    </span>
                  </div>
                  <h1 className="font-serif text-4xl text-white sm:text-5xl">
                    {selectedHotel.name}
                  </h1>
                  <p className="mt-3 text-sm text-white/40">
                    📍 {selectedHotel.location}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-gold-400 font-serif text-lg font-bold text-ink-900">
                    {selectedHotel.rating}
                  </span>
                  <div className="text-left">
                    <p className="text-xs font-semibold text-white">
                      Sangat Baik
                    </p>
                    <p className="text-[11px] text-white/35">
                      {selectedHotel.reviews.toLocaleString("id-ID")} ulasan
                    </p>
                  </div>
                </div>
              </div>

              <div className="my-8 h-px bg-white/10"></div>

              <h3 className="mb-3 font-serif text-2xl">Tentang properti ini</h3>
              <p className="text-sm leading-relaxed text-white/45">
                {selectedHotel.description}
              </p>

              <h3 className="mb-4 mt-10 font-serif text-2xl">Fasilitas</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {selectedHotel.amenities.map((a) => (
                  <div
                    key={a}
                    className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[.03] px-3.5 py-3"
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-gold-400/10 text-xs text-gold-300">
                      ✓
                    </span>
                    <span className="text-[11px] text-white/60">{a}</span>
                  </div>
                ))}
              </div>

              <h3 className="mb-4 mt-12 font-serif text-2xl">Pilih Kamar</h3>
              <div className="space-y-4">
                {selectedHotel.rooms.map((r) => {
                  const isSel = selectedRoom?.id === r.id;
                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelectedRoom(r)}
                      className={`group cursor-pointer overflow-hidden rounded-2xl border p-4 transition-all duration-300 ${
                        isSel
                          ? "border-gold-400/60 bg-gold-400/[.06]"
                          : "border-white/10 bg-white/[.02] hover:border-gold-400/30"
                      }`}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row">
                        <div className="h-32 w-full shrink-0 overflow-hidden rounded-xl sm:w-44">
                          <img
                            src={r.image}
                            className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                            alt={r.name}
                          />
                        </div>
                        <div className="flex flex-1 flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-3">
                              <h4 className="font-serif text-lg text-white">
                                {r.name}
                              </h4>
                              <span
                                className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] ${
                                  isSel
                                    ? "border-gold-400 bg-gold-400 text-ink-900 font-bold"
                                    : "border-white/20 text-transparent"
                                }`}
                              >
                                ✓
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/40">
                              <span>📐 {r.size}</span>
                              <span>🛏 {r.bed}</span>
                              <span>👤 Maks {r.max}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {r.perks.map((p) => (
                                <span
                                  key={p}
                                  className="rounded-md bg-gold-400/10 px-2 py-0.5 text-[10px] text-gold-300/90"
                                >
                                  {p}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <p className="font-serif text-lg text-gold-300">
                              {fmtRp(r.price)}
                              <span className="text-[10px] font-sans text-white/30">
                                {" "}
                                /malam
                              </span>
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-emerald-300/70">
                                Tersedia
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startBooking(r);
                                }}
                                className="rounded-xl bg-gradient-to-r from-gold-400 to-gold-600 px-3.5 py-1.5 text-[11px] font-semibold text-ink-900 transition hover:shadow-glow active:scale-95"
                              >
                                Pesan Kamar Ini →
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sticky booking card */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="card-glass p-6">
                <p className="text-[11px] tracking-[.25em] text-white/40">
                  MULAI DARI
                </p>
                <div className="mt-1 flex items-end gap-1.5">
                  <span className="font-serif text-3xl text-gold-300">
                    {fmtRp(selectedRoom?.price || selectedHotel.price)}
                  </span>
                  <span className="pb-1 text-xs text-white/35">/ malam</span>
                </div>

                <div className="my-6 h-px bg-white/10"></div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-xs">Check-in</label>
                      <input
                        type="date"
                        value={detailCheckIn}
                        min={todayISO(0)}
                        onChange={(e) => {
                          const nextCi = e.target.value;
                          setDetailCheckIn(nextCi);
                          if (nightsBetween(nextCi, detailCheckOut) <= 0) {
                            const d = new Date(nextCi);
                            d.setDate(d.getDate() + 1);
                            setDetailCheckOut(d.toISOString().split("T")[0]);
                          }
                        }}
                        className="input-field text-xs [color-scheme:dark]"
                      />
                    </div>
                    <div>
                      <label className="label-xs">Check-out</label>
                      <input
                        type="date"
                        value={detailCheckOut}
                        min={detailCheckIn || todayISO(1)}
                        onChange={(e) => setDetailCheckOut(e.target.value)}
                        className="input-field text-xs [color-scheme:dark]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label-xs">Tamu</label>
                    <select
                      value={detailGuests}
                      onChange={(e) => setDetailGuests(Number(e.target.value))}
                      className="input-field text-xs [&>option]:bg-ink-800"
                    >
                      <option value={1}>1 Dewasa</option>
                      <option value={2}>2 Dewasa</option>
                      <option value={3}>3 Dewasa</option>
                      <option value={4}>4 Dewasa</option>
                    </select>
                  </div>
                </div>

                <div className="mt-5 space-y-2 rounded-2xl bg-white/[.04] p-4 text-xs">
                  <div className="flex justify-between text-white/45">
                    <span>Durasi</span>
                    <span className="text-white/80">
                      {detailNights > 0 ? `${detailNights} malam` : "1 malam"}
                    </span>
                  </div>
                  <div className="flex justify-between text-white/45">
                    <span>Kamar dipilih</span>
                    <span className="text-right text-white/80">
                      {selectedRoom
                        ? `${selectedRoom.name} · ${fmtRp(
                            selectedRoom.price * Math.max(detailNights, 1)
                          )}`
                        : "—"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => startBooking()}
                  className="btn-gold mt-5 w-full py-3.5 text-sm"
                >
                  Lanjut ke Pemesanan
                </button>
                <p className="mt-3 text-center text-[10px] text-white/25">
                  Gratis pembatalan hingga 24 jam sebelum check-in
                </p>
              </div>
            </aside>
          </div>
        </section>
      )}

      {/* ======================= PAGE: BOOKING ======================= */}
      {currentPage === "booking" && draft && (
        <section className="mx-auto max-w-6xl px-5 pb-24 pt-28 lg:px-8 animate-page-in">
          <div className="mb-10 flex items-center justify-center gap-3 text-xs">
            <div className="flex items-center gap-2 text-gold-300">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-gold-400 text-[11px] font-bold text-ink-900">
                1
              </span>{" "}
              Data Tamu
            </div>
            <div className="h-px w-10 bg-gold-400/40"></div>
            <div className="flex items-center gap-2 text-white/30">
              <span className="grid h-7 w-7 place-items-center rounded-full border border-white/15 text-[11px]">
                2
              </span>{" "}
              Pembayaran
            </div>
            <div className="h-px w-10 bg-white/10"></div>
            <div className="flex items-center gap-2 text-white/30">
              <span className="grid h-7 w-7 place-items-center rounded-full border border-white/15 text-[11px]">
                3
              </span>{" "}
              Selesai
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
            <div className="card-glass p-7">
              <h2 className="font-serif text-2xl">Detail Tamu</h2>
              <p className="mt-1 text-xs text-white/35">
                Pastikan data sesuai dengan identitas resmi.
              </p>

              <form
                onSubmit={handleBookingFormSubmit}
                className="mt-7 space-y-5"
                noValidate
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label-xs">Nama Lengkap *</label>
                    <input
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="input-field"
                      placeholder="Nama sesuai KTP/Paspor"
                      required
                    />
                  </div>
                  <div>
                    <label className="label-xs">Email *</label>
                    <input
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      className="input-field"
                      placeholder="nama@email.com"
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label-xs">No. Telepon *</label>
                    <input
                      type="tel"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      className="input-field"
                      placeholder="+62 812 3456 7890"
                      required
                    />
                  </div>
                  <div>
                    <label className="label-xs">Kewarganegaraan</label>
                    <select
                      value={guestCountry}
                      onChange={(e) => setGuestCountry(e.target.value)}
                      className="input-field [&>option]:bg-ink-800"
                    >
                      <option>Indonesia</option>
                      <option>Singapore</option>
                      <option>Malaysia</option>
                      <option>Australia</option>
                      <option>United States</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label-xs">
                    Permintaan Khusus (opsional)
                  </label>
                  <textarea
                    rows={3}
                    value={guestRequests}
                    onChange={(e) => setGuestRequests(e.target.value)}
                    className="input-field resize-none"
                    placeholder="Contoh: kamar lantai tinggi, late check-in, dekorasi ulang tahun..."
                  />
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[.03] p-4 text-xs text-white/50">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded accent-gold-400"
                  />
                  <span>
                    Saya menyetujui{" "}
                    <span className="text-gold-400">Syarat & Ketentuan</span>{" "}
                    serta{" "}
                    <span className="text-gold-400">Kebijakan Privasi</span>{" "}
                    Aurelia Collection.
                  </span>
                </label>

                {bookingErr && (
                  <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {bookingErr}
                  </p>
                )}

                <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => goPage("detail")}
                    className="btn-ghost flex-1 py-3 text-sm"
                  >
                    Kembali
                  </button>
                  <button
                    type="submit"
                    className="btn-gold flex-1 py-3 text-sm"
                  >
                    Lanjut ke Pembayaran
                  </button>
                </div>
              </form>
            </div>

            {/* Summary */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="card-glass overflow-hidden">
                <img
                  src={draft.hotelImage}
                  className="h-40 w-full object-cover"
                  alt=""
                />
                <div className="p-6">
                  <h3 className="font-serif text-xl">{draft.hotelName}</h3>
                  <p className="mt-1 text-[11px] text-white/40">
                    {draft.hotelLocation}
                  </p>
                  <div className="my-5 h-px bg-white/10"></div>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between text-white/45">
                      <span>Kamar</span>
                      <span className="text-white/80">{draft.roomName}</span>
                    </div>
                    <div className="flex justify-between text-white/45">
                      <span>Check-in</span>
                      <span className="text-white/80">
                        {fmtDate(draft.checkIn)}
                      </span>
                    </div>
                    <div className="flex justify-between text-white/45">
                      <span>Check-out</span>
                      <span className="text-white/80">
                        {fmtDate(draft.checkOut)}
                      </span>
                    </div>
                    <div className="flex justify-between text-white/45">
                      <span>Durasi</span>
                      <span className="text-white/80">
                        {draft.nights} malam
                      </span>
                    </div>
                    <div className="my-2 h-px bg-white/10"></div>
                    <div className="flex justify-between text-white/45">
                      <span>
                        {fmtRp(draft.roomPrice)} × {draft.nights}
                      </span>
                      <span className="text-white/80">
                        {fmtRp(draftTotals.subtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-white/45">
                      <span>Pajak (11%)</span>
                      <span className="text-white/80">
                        {fmtRp(draftTotals.tax)}
                      </span>
                    </div>
                    <div className="flex justify-between text-white/45">
                      <span>Service (5%)</span>
                      <span className="text-white/80">
                        {fmtRp(draftTotals.service)}
                      </span>
                    </div>
                    <div className="my-2 h-px bg-white/10"></div>
                    <div className="flex justify-between font-semibold">
                      <span className="text-white/70">Total</span>
                      <span className="text-gold-300">
                        {fmtRp(draftTotals.total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>
      )}

      {/* ======================= PAGE: PAYMENT ======================= */}
      {currentPage === "payment" && draft && (
        <section className="mx-auto max-w-6xl px-5 pb-24 pt-28 lg:px-8 animate-page-in">
          <div className="mb-10 flex items-center justify-center gap-3 text-xs">
            <div className="flex items-center gap-2 text-gold-300">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-gold-400/20 text-[11px] text-gold-300">
                ✓
              </span>{" "}
              Data Tamu
            </div>
            <div className="h-px w-10 bg-gold-400/40"></div>
            <div className="flex items-center gap-2 text-gold-300">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-gold-400 text-[11px] font-bold text-ink-900">
                2
              </span>{" "}
              Pembayaran
            </div>
            <div className="h-px w-10 bg-white/10"></div>
            <div className="flex items-center gap-2 text-white/30">
              <span className="grid h-7 w-7 place-items-center rounded-full border border-white/15 text-[11px]">
                3
              </span>{" "}
              Selesai
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
            <div className="card-glass p-7">
              <h2 className="font-serif text-2xl">Metode Pembayaran</h2>
              <p className="mt-1 text-xs text-white/35">
                Transaksi dienkripsi dengan standar perbankan.
              </p>

              <div className="mt-6 grid grid-cols-3 gap-2">
                {(
                  [
                    ["card", "Kartu Kredit"],
                    ["va", "Virtual Account"],
                    ["ewallet", "E-Wallet"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setPayMethod(key)}
                    className={`rounded-xl border px-3 py-3 text-xs font-medium transition ${
                      payMethod === key
                        ? "border-gold-400/60 bg-gold-400/10 text-gold-300"
                        : "border-white/10 text-white/50 hover:border-gold-400/40"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {payMethod === "card" && (
                <div className="mt-7">
                  <div className="relative mb-7 overflow-hidden rounded-2xl bg-gradient-to-br from-ink-600 via-ink-700 to-ink-900 p-6 shadow-card">
                    <div className="flex items-start justify-between">
                      <div className="h-8 w-11 rounded-md bg-gradient-to-br from-gold-300 to-gold-600 opacity-90"></div>
                      <div className="flex gap-1.5">
                        <div className="h-6 w-6 rounded-full bg-gold-400/70"></div>
                        <div className="-ml-3 h-6 w-6 rounded-full bg-gold-200/50"></div>
                      </div>
                    </div>
                    <p className="mt-6 font-mono text-lg tracking-[.18em] text-white/90">
                      {cardNumber || "•••• •••• •••• ••••"}
                    </p>
                    <div className="mt-5 flex items-end justify-between">
                      <div>
                        <p className="text-[8px] tracking-widest text-white/30">
                          CARD HOLDER
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-wider text-white/80">
                          {cardName || "NAMA PEMEGANG"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] tracking-widest text-white/30">
                          EXPIRES
                        </p>
                        <p className="mt-1 font-mono text-xs text-white/80">
                          {cardExp || "MM/YY"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <form
                    onSubmit={handleCardPaymentSubmit}
                    className="space-y-4"
                    noValidate
                  >
                    <div>
                      <label className="label-xs">Nomor Kartu *</label>
                      <input
                        type="text"
                        maxLength={19}
                        value={cardNumber}
                        onChange={(e) => {
                          const v = e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 16);
                          setCardNumber(v.replace(/(.{4})/g, "$1 ").trim());
                        }}
                        className="input-field font-mono tracking-widest"
                        placeholder="4242 4242 4242 4242"
                      />
                    </div>
                    <div>
                      <label className="label-xs">Nama pada Kartu *</label>
                      <input
                        type="text"
                        value={cardName}
                        onChange={(e) =>
                          setCardName(e.target.value.toUpperCase())
                        }
                        className="input-field uppercase"
                        placeholder="NAMA LENGKAP"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label-xs">Masa Berlaku *</label>
                        <input
                          type="text"
                          maxLength={5}
                          value={cardExp}
                          onChange={(e) => {
                            let v = e.target.value
                              .replace(/\D/g, "")
                              .slice(0, 4);
                            if (v.length >= 3)
                              v = v.slice(0, 2) + "/" + v.slice(2);
                            setCardExp(v);
                          }}
                          className="input-field font-mono"
                          placeholder="MM/YY"
                        />
                      </div>
                      <div>
                        <label className="label-xs">CVV *</label>
                        <input
                          type="password"
                          maxLength={4}
                          value={cardCvv}
                          onChange={(e) =>
                            setCardCvv(
                              e.target.value.replace(/\D/g, "").slice(0, 4)
                            )
                          }
                          className="input-field font-mono"
                          placeholder="•••"
                        />
                      </div>
                    </div>

                    {paymentErr && (
                      <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                        {paymentErr}
                      </p>
                    )}

                    <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => goPage("booking")}
                        className="btn-ghost flex-1 py-3 text-sm"
                      >
                        Kembali
                      </button>
                      <button
                        type="submit"
                        className="btn-gold flex-1 py-3 text-sm"
                      >
                        🔒 Bayar Sekarang
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {payMethod === "va" && (
                <div className="mt-7 space-y-3">
                  {["BCA", "Mandiri", "BNI", "BRI"].map((bank) => (
                    <button
                      key={bank}
                      onClick={() => processPayment(`Virtual Account ${bank}`)}
                      className="flex w-full items-center justify-between rounded-xl border border-white/10 p-4 transition hover:border-gold-400/50 hover:bg-white/5"
                    >
                      <span className="flex items-center gap-3">
                        <span className="grid h-9 w-12 place-items-center rounded-lg bg-white/5 text-[10px] font-bold text-white/80">
                          {bank}
                        </span>
                        <span className="text-xs text-white/60">
                          Virtual Account {bank}
                        </span>
                      </span>
                      <span className="text-xs text-gold-300">Pilih →</span>
                    </button>
                  ))}
                </div>
              )}

              {payMethod === "ewallet" && (
                <div className="mt-7">
                  <div className="grid grid-cols-2 gap-3">
                    {["OVO", "GoPay", "DANA", "ShopeePay"].map((ew) => (
                      <button
                        key={ew}
                        onClick={() => processPayment(`E-Wallet ${ew}`)}
                        className="flex items-center gap-3 rounded-xl border border-white/10 p-4 text-left transition hover:border-gold-400/50 hover:bg-white/5"
                      >
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-gold-400/15 text-xs font-bold text-gold-300">
                          {ew.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="text-xs">{ew}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="card-glass p-6">
                <h3 className="font-serif text-xl">Ringkasan Pesanan</h3>
                <div className="my-5 h-px bg-white/10"></div>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between text-white/45">
                    <span>Hotel</span>
                    <span className="text-white/80">{draft.hotelName}</span>
                  </div>
                  <div className="flex justify-between text-white/45">
                    <span>Kamar</span>
                    <span className="text-white/80">{draft.roomName}</span>
                  </div>
                  <div className="flex justify-between text-white/45">
                    <span>Durasi</span>
                    <span className="text-white/80">{draft.nights} malam</span>
                  </div>
                  <div className="my-2 h-px bg-white/10"></div>
                  <div className="flex justify-between text-white/45">
                    <span>Subtotal</span>
                    <span className="text-white/80">
                      {fmtRp(draftTotals.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-white/45">
                    <span>Pajak & Service</span>
                    <span className="text-white/80">
                      {fmtRp(draftTotals.tax + draftTotals.service)}
                    </span>
                  </div>
                </div>
                <div className="my-5 h-px bg-white/10"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/45">Total Bayar</span>
                  <span className="font-serif text-2xl text-gold-300">
                    {fmtRp(draftTotals.total)}
                  </span>
                </div>
              </div>
            </aside>
          </div>
        </section>
      )}

      {/* ======================= PAGE: SUCCESS ======================= */}
      {currentPage === "success" && lastBooking && (
        <section className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-5 py-24 text-center animate-page-in">
          <div className="animate-pop relative mb-8">
            <div className="pulse-ring absolute inset-0 rounded-full bg-gold-400/30"></div>
            <div className="relative grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600 shadow-glow text-3xl text-ink-900 font-bold">
              ✓
            </div>
          </div>

          <p className="text-[11px] tracking-[.4em] text-gold-400">
            RESERVASI TERKONFIRMASI
          </p>
          <h1 className="mt-4 font-serif text-4xl text-white sm:text-5xl">
            Terima kasih,{" "}
            <span className="gold-shimmer">
              {lastBooking.guestName.split(" ")[0]}
            </span>
            !
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/45">
            Email konfirmasi telah dikirim. Tunjukkan kode booking di bawah saat
            check-in.
          </p>

          <div className="mt-10 w-full max-w-md">
            <div className="card-glass p-7">
              <p className="text-[10px] tracking-[.3em] text-white/35">
                KODE BOOKING
              </p>
              <p className="mt-2 font-mono text-3xl tracking-[.25em] text-gold-300">
                {lastBooking.code}
              </p>
              <div className="my-6 h-px bg-white/10"></div>
              <div className="space-y-3 text-left text-xs">
                <div className="flex justify-between">
                  <span className="text-white/40">Hotel</span>
                  <span className="text-white/85">{lastBooking.hotelName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Kamar</span>
                  <span className="text-white/85">{lastBooking.roomName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Tanggal</span>
                  <span className="text-white/85">
                    {fmtDate(lastBooking.checkIn)} →{" "}
                    {fmtDate(lastBooking.checkOut)}
                  </span>
                </div>
                <div className="my-2 h-px bg-white/10"></div>
                <div className="flex justify-between font-semibold">
                  <span className="text-white/60">Total Dibayar</span>
                  <span className="text-gold-300">
                    {fmtRp(lastBooking.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row">
            <button
              onClick={() => goPage("profile")}
              className="btn-gold flex-1 py-3 text-sm"
            >
              Lihat Reservasi Saya
            </button>
            <button
              onClick={() => goPage("home")}
              className="btn-ghost flex-1 py-3 text-sm"
            >
              Kembali ke Beranda
            </button>
          </div>
        </section>
      )}

      {/* ======================= PAGE: PROFILE ======================= */}
      {currentPage === "profile" && (
        <section className="mx-auto max-w-7xl px-5 pb-24 pt-28 lg:px-8 animate-page-in">
          <div className="card-glass relative overflow-hidden p-8">
            <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center">
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-gold-300 to-gold-700 font-serif text-3xl font-bold text-ink-900 shadow-glow">
                {userInitial}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="font-serif text-3xl text-white">
                    {user.name}
                  </h1>
                  <span className="rounded-full border border-gold-400/40 bg-gold-400/10 px-3 py-1 text-[10px] font-semibold tracking-widest text-gold-300">
                    ✦ {user.tier || "GOLD MEMBER"}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-white/40">{user.email}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="card-glass p-5">
              <p className="text-[10px] tracking-[.2em] text-white/35">
                TOTAL MENGINAP
              </p>
              <p className="mt-2 font-serif text-3xl text-white">
                {totalNights}
              </p>
              <p className="mt-1 text-[11px] text-white/30">malam</p>
            </div>
            <div className="card-glass p-5">
              <p className="text-[10px] tracking-[.2em] text-white/35">
                RESERVASI
              </p>
              <p className="mt-2 font-serif text-3xl text-white">
                {bookings.length}
              </p>
              <p className="mt-1 text-[11px] text-white/30">total pesanan</p>
            </div>
            <div className="card-glass p-5">
              <p className="text-[10px] tracking-[.2em] text-white/35">
                POIN REWARD
              </p>
              <p className="mt-2 font-serif text-3xl text-gold-300">
                {rewardPoints.toLocaleString("id-ID")}
              </p>
              <p className="mt-1 text-[11px] text-white/30">poin terkumpul</p>
            </div>
            <div className="card-glass p-5">
              <p className="text-[10px] tracking-[.2em] text-white/35">
                TOTAL BELANJA
              </p>
              <p className="mt-2 font-serif text-2xl text-white">
                {fmtRp(totalSpent)}
              </p>
              <p className="mt-1 text-[11px] text-white/30">sepanjang waktu</p>
            </div>
          </div>

          <div className="mt-12">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <h2 className="font-serif text-3xl">Reservasi Saya</h2>
              <div className="flex gap-2">
                {(
                  [
                    ["all", "Semua"],
                    ["upcoming", "Akan Datang"],
                    ["completed", "Selesai"],
                  ] as const
                ).map(([tabKey, label]) => (
                  <button
                    key={tabKey}
                    onClick={() => setBookingTab(tabKey)}
                    className={`rounded-full border px-5 py-2 text-xs font-medium transition ${
                      bookingTab === tabKey
                        ? "border-gold-400/60 bg-gold-400/10 text-gold-300"
                        : "border-white/10 text-white/50 hover:border-gold-400/40"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {filteredBookings.length === 0 ? (
              <div className="py-20 text-center">
                <p className="font-serif text-xl text-white/50">
                  Belum ada reservasi
                </p>
                <button
                  onClick={() => goPage("home")}
                  className="btn-gold mt-6 px-6 py-2.5 text-xs"
                >
                  Cari Hotel
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredBookings.map((b) => (
                  <div
                    key={b.id}
                    className="card-glass overflow-hidden transition hover:border-gold-400/30"
                  >
                    <div className="flex flex-col gap-5 p-4 sm:flex-row sm:items-center sm:p-5">
                      <div className="h-36 w-full shrink-0 overflow-hidden rounded-2xl sm:h-24 sm:w-36">
                        <img
                          src={b.hotelImage}
                          className="h-full w-full object-cover"
                          alt=""
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className="font-serif text-lg text-white">
                            {b.hotelName}
                          </h3>
                          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold tracking-wider text-emerald-300">
                            {b.status === "upcoming"
                              ? "AKAN DATANG"
                              : "SELESAI"}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-white/35">
                          📍 {b.hotelLocation}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-[11px] text-white/45">
                          <span>🛏 {b.roomName}</span>
                          <span>
                            📅 {fmtDate(b.checkIn)} → {fmtDate(b.checkOut)}
                          </span>
                          <span>🌙 {b.nights} malam</span>
                          <span>👤 {b.guests} tamu</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center justify-between gap-4 border-t border-white/10 pt-4 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                        <div className="text-right">
                          <p className="text-[9px] tracking-widest text-white/25">
                            KODE
                          </p>
                          <p className="font-mono text-xs text-gold-300">
                            {b.code}
                          </p>
                          <p className="mt-1.5 font-serif text-base text-white">
                            {fmtRp(b.total)}
                          </p>
                        </div>
                        <button
                          onClick={() => setDetailModalBooking(b)}
                          className="rounded-lg border border-white/15 px-3.5 py-2 text-[10px] font-medium text-white/60 transition hover:border-gold-400/50 hover:text-gold-300"
                        >
                          Detail
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ======================= PAGE: CONCIERGE (PURE CHATBOT) ======================= */}
      {currentPage === "concierge" && (
        <ConciergeStudioView
          messages={chatMessages}
          quickReplies={quickReplies}
          isTyping={isChatTyping}
          onSendMessage={handleSendChatMessage}
          onResetChat={handleResetChat}
          onSelectHotel={openHotel}
          onQuickBookHotel={quickBookHotel}
          onStartQuoteBooking={startBookingFromQuote}
        />
      )}

      {/* FLOATING CHATBOT WIDGET (Pure Chatbot) */}
      <FloatingConcierge
        messages={chatMessages}
        quickReplies={quickReplies}
        isTyping={isChatTyping}
        onSendMessage={handleSendChatMessage}
        onSelectHotel={openHotel}
        onQuickBookHotel={quickBookHotel}
        onStartQuoteBooking={startBookingFromQuote}
      />
    </div>
  );
}
