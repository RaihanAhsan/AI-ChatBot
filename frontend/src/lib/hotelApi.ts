import { BookingItem, Hotel, UserProfile } from "@/types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const IMG = (id: string, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

export const FALLBACK_HOTELS: Hotel[] = [
  {
    id: "h1",
    name: "The Grand Azure",
    city: "Bali",
    location: "Nusa Dua, Bali, Indonesia",
    rating: 4.9,
    reviews: 1284,
    stars: 5,
    price: 2450000,
    image: IMG("photo-1566073771259-6a8506099945"),
    gallery: [
      IMG("photo-1582719478250-c89cae4dc85b", 900),
      IMG("photo-1571896349842-33c89424de2d", 900),
      IMG("photo-1520250497591-112f2f40a3f4", 900),
      IMG("photo-1611892440504-42a792e24d32", 900),
    ],
    description:
      "Set along the pristine white-sand beaches of Nusa Dua, The Grand Azure features 88 private suites and villas with infinity pools overlooking the Indian Ocean. Enjoy authentic Balinese spa rituals, world-class fine dining, and 24-hour personal butler service tailored to your every wish.",
    amenities: [
      "Infinity Pool",
      "Spa & Wellness",
      "Private Beach",
      "Fine Dining",
      "24/7 Butler",
      "High-Speed Wi-Fi",
      "Fitness Center",
      "Airport Transfer",
    ],
    rooms: [
      {
        id: "r1",
        name: "Deluxe Ocean View",
        price: 2450000,
        size: "52 m²",
        bed: "King Bed",
        max: 2,
        image: IMG("photo-1611892440504-42a792e24d32", 800),
        perks: ["Breakfast", "Ocean View"],
      },
      {
        id: "r2",
        name: "Premier Suite",
        price: 3900000,
        size: "78 m²",
        bed: "King Bed",
        max: 3,
        image: IMG("photo-1590490360182-c33d57733427", 800),
        perks: ["Breakfast", "Lounge Access", "Bathtub"],
      },
      {
        id: "r3",
        name: "Private Pool Villa",
        price: 6800000,
        size: "140 m²",
        bed: "2 King Beds",
        max: 4,
        image: IMG("photo-1631049307264-da0ec9d70304", 800),
        perks: ["Breakfast", "Private Pool", "Butler"],
      },
    ],
  },
  {
    id: "h2",
    name: "Aurora Sky Palace",
    city: "Jakarta",
    location: "Sudirman, Jakarta, Indonesia",
    rating: 4.8,
    reviews: 962,
    stars: 5,
    price: 1850000,
    image: IMG("photo-1582719478250-c89cae4dc85b"),
    gallery: [
      IMG("photo-1566073771259-6a8506099945", 900),
      IMG("photo-1445019980597-93fa8acb246c", 900),
      IMG("photo-1611892440504-42a792e24d32", 900),
      IMG("photo-1590490360182-c33d57733427", 900),
    ],
    description:
      "An iconic architectural tower in the heart of Sudirman offering sweeping Jakarta skyline panoramas from the 42nd floor. Aurora Sky Palace delivers floor-to-ceiling windows, an acclaimed rooftop bar, and direct access to the SCBD financial district.",
    amenities: [
      "Rooftop Bar",
      "Indoor Pool",
      "Business Center",
      "Luxury Spa",
      "Signature Restaurant",
      "High-Speed Wi-Fi",
      "Valet Parking",
      "Boardrooms",
    ],
    rooms: [
      {
        id: "r1",
        name: "City View Room",
        price: 1850000,
        size: "42 m²",
        bed: "Queen Bed",
        max: 2,
        image: IMG("photo-1590490360182-c33d57733427", 800),
        perks: ["Breakfast", "City View"],
      },
      {
        id: "r2",
        name: "Executive Suite",
        price: 3200000,
        size: "68 m²",
        bed: "King Bed",
        max: 3,
        image: IMG("photo-1611892440504-42a792e24d32", 800),
        perks: ["Breakfast", "Lounge Access", "Work Desk"],
      },
    ],
  },
  {
    id: "h3",
    name: "Villa Serenity",
    city: "Ubud",
    location: "Tegallalang, Ubud, Bali",
    rating: 4.9,
    reviews: 743,
    stars: 5,
    price: 2100000,
    image: IMG("photo-1571896349842-33c89424de2d"),
    gallery: [
      IMG("photo-1520250497591-112f2f40a3f4", 900),
      IMG("photo-1631049307264-da0ec9d70304", 900),
      IMG("photo-1566073771259-6a8506099945", 900),
      IMG("photo-1445019980597-93fa8acb246c", 900),
    ],
    description:
      "Tucked away amidst the emerald rice terraces of Tegallalang, Villa Serenity is a tranquil sanctuary of 24 private villas. Each villa boasts a heated plunge pool overlooking lush jungle valleys and sunrise decks.",
    amenities: [
      "Private Pool",
      "Yoga Pavilion",
      "Organic Restaurant",
      "Holistic Spa",
      "Trekking Guide",
      "High-Speed Wi-Fi",
      "Private Parking",
      "Shuttle Service",
    ],
    rooms: [
      {
        id: "r1",
        name: "Garden Villa",
        price: 2100000,
        size: "65 m²",
        bed: "King Bed",
        max: 2,
        image: IMG("photo-1631049307264-da0ec9d70304", 800),
        perks: ["Breakfast", "Garden View"],
      },
      {
        id: "r2",
        name: "Valley Pool Villa",
        price: 4200000,
        size: "120 m²",
        bed: "King Bed",
        max: 3,
        image: IMG("photo-1571896349842-33c89424de2d", 800),
        perks: ["Breakfast", "Private Pool", "Valley View"],
      },
    ],
  },
  {
    id: "h4",
    name: "The Marble Crown",
    city: "Singapore",
    location: "Marina Bay, Singapore",
    rating: 4.8,
    reviews: 2103,
    stars: 5,
    price: 3300000,
    image: IMG("photo-1520250497591-112f2f40a3f4"),
    gallery: [
      IMG("photo-1566073771259-6a8506099945", 900),
      IMG("photo-1582719478250-c89cae4dc85b", 900),
      IMG("photo-1611892440504-42a792e24d32", 900),
      IMG("photo-1590490360182-c33d57733427", 900),
    ],
    description:
      "A Marina Bay landmark crafted from Italian marble and glass. The Marble Crown offers breathtaking bay views, a 57th-floor sky infinity pool, and a curated museum-grade contemporary art collection.",
    amenities: [
      "Infinity Pool",
      "Sky Bar",
      "Michelin Dining",
      "Luxury Spa",
      "24-Hour Gym",
      "High-Speed Wi-Fi",
      "24/7 Concierge",
      "Business Center",
    ],
    rooms: [
      {
        id: "r1",
        name: "Bay View Room",
        price: 3300000,
        size: "48 m²",
        bed: "King Bed",
        max: 2,
        image: IMG("photo-1590490360182-c33d57733427", 800),
        perks: ["Breakfast", "Bay View"],
      },
      {
        id: "r2",
        name: "Skyline Suite",
        price: 5600000,
        size: "85 m²",
        bed: "King Bed",
        max: 3,
        image: IMG("photo-1611892440504-42a792e24d32", 800),
        perks: ["Breakfast", "Skyline View", "Club Access"],
      },
    ],
  },
  {
    id: "h5",
    name: "Lumière Riviera",
    city: "Maldives",
    location: "North Malé Atoll, Maldives",
    rating: 5.0,
    reviews: 512,
    stars: 5,
    price: 7800000,
    image: IMG("photo-1590523277543-a94d2e4eb00b"),
    gallery: [
      IMG("photo-1571896349842-33c89424de2d", 900),
      IMG("photo-1445019980597-93fa8acb246c", 900),
      IMG("photo-1631049307264-da0ec9d70304", 900),
      IMG("photo-1566073771259-6a8506099945", 900),
    ],
    description:
      "The Maldives' most iconic overwater sanctuary. 42 villas suspended above a crystal lagoon featuring glass floor panels, private sundecks, and direct coral reef access. Includes private seaplane transfers and a personal chef.",
    amenities: [
      "Overwater Villa",
      "Private Chef",
      "House Reef",
      "Seaplane Transfer",
      "Overwater Spa",
      "Diving Center",
      "High-Speed Wi-Fi",
      "All-Inclusive",
    ],
    rooms: [
      {
        id: "r1",
        name: "Overwater Villa",
        price: 7800000,
        size: "110 m²",
        bed: "King Bed",
        max: 2,
        image: IMG("photo-1590523277543-a94d2e4eb00b", 800),
        perks: ["All-Inclusive", "Ocean Deck", "Snorkeling"],
      },
      {
        id: "r2",
        name: "Sunset Grand Villa",
        price: 12500000,
        size: "180 m²",
        bed: "King Bed",
        max: 4,
        image: IMG("photo-1571896349842-33c89424de2d", 800),
        perks: ["All-Inclusive", "Private Pool", "Butler", "Sunset View"],
      },
    ],
  },
  {
    id: "h6",
    name: "Obsidian Heights",
    city: "Dubai",
    location: "Downtown, Dubai, UAE",
    rating: 4.9,
    reviews: 1876,
    stars: 5,
    price: 4500000,
    image: IMG("photo-1512453979798-5ea266f8880c"),
    gallery: [
      IMG("photo-1566073771259-6a8506099945", 900),
      IMG("photo-1582719478250-c89cae4dc85b", 900),
      IMG("photo-1611892440504-42a792e24d32", 900),
      IMG("photo-1520250497591-112f2f40a3f4", 900),
    ],
    description:
      "Directly facing the Burj Khalifa, Obsidian Heights is a masterpiece of modern Dubai luxury. Experience our sky-high rooftop infinity pool, private members' lounge, and Michelin-starred culinary destinations.",
    amenities: [
      "Rooftop Pool",
      "Burj View",
      "Michelin Dining",
      "Royal Spa",
      "Luxury Shopping",
      "High-Speed Wi-Fi",
      "Valet Service",
      "Kids Club",
    ],
    rooms: [
      {
        id: "r1",
        name: "Burj View Room",
        price: 4500000,
        size: "55 m²",
        bed: "King Bed",
        max: 2,
        image: IMG("photo-1611892440504-42a792e24d32", 800),
        perks: ["Breakfast", "Burj View"],
      },
      {
        id: "r2",
        name: "Royal Suite",
        price: 8900000,
        size: "130 m²",
        bed: "King Bed",
        max: 4,
        image: IMG("photo-1590490360182-c33d57733427", 800),
        perks: ["Breakfast", "Lounge Access", "Butler", "Panoramic"],
      },
    ],
  },
];

export const fmtRp = (n: number) =>
  "Rp " + Number(n || 0).toLocaleString("id-ID");

export const todayISO = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
};

export const nightsBetween = (a?: string, b?: string) => {
  if (!a || !b) return 0;
  const diff = (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
  return diff > 0 ? Math.round(diff) : 0;
};

export const fmtDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

export const calcTotals = (roomPrice: number, nights: number) => {
  const subtotal = roomPrice * nights;
  const tax = Math.round(subtotal * 0.11);
  const service = Math.round(subtotal * 0.05);
  const total = subtotal + tax + service;
  return { subtotal, tax, service, total };
};

export function saveAuthSession(user: UserProfile) {
  if (typeof window === "undefined") return;
  localStorage.setItem("aurelia_user", JSON.stringify(user));
  document.cookie = `aurelia_session=1; path=/; max-age=2592000; SameSite=Lax`;
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("aurelia_user");
  document.cookie =
    "aurelia_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
}

export function getSavedUser(): UserProfile | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("aurelia_user");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.email) return null;
    return {
      ...parsed,
      role: parsed.role || (parsed.email === "admin@aurelia.com" ? "admin" : "user"),
    };
  } catch {
    return null;
  }
}

export async function apiLogin(
  email: string,
  password: string
): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err.detail || "Invalid email or password. Please try again."
    );
  }
  return await res.json();
}

export async function apiRegister(payload: {
  name: string;
  email: string;
  phone: string;
  city: string;
  password: string;
}): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to register account.");
  }
  return await res.json();
}

export async function apiGetHotels(): Promise<Hotel[]> {
  try {
    const res = await fetch(`${API_BASE}/api/hotels`);
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch {
    return FALLBACK_HOTELS;
  }
}

export async function apiGetBookings(userEmail: string): Promise<BookingItem[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/bookings?user_email=${encodeURIComponent(userEmail)}`
    );
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch {
    const raw =
      typeof window !== "undefined"
        ? localStorage.getItem("aurelia_bookings")
        : null;
    return raw ? JSON.parse(raw) : [];
  }
}

export async function apiCreateBooking(payload: {
  userEmail: string;
  hotelId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestCountry: string;
  requests: string;
  paymentMethod: string;
}): Promise<BookingItem> {
  try {
    const res = await fetch(`${API_BASE}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed");
    return await res.json();
  } catch {
    const h =
      FALLBACK_HOTELS.find((x) => x.id === payload.hotelId) ||
      FALLBACK_HOTELS[0];
    const r =
      h.rooms.find((x) => x.id === payload.roomId) || h.rooms[0];
    const nights = Math.max(1, nightsBetween(payload.checkIn, payload.checkOut));
    const totals = calcTotals(r.price, nights);
    const code =
      "AUR-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    return {
      id: "b" + Date.now(),
      code,
      userEmail: payload.userEmail,
      hotelId: h.id,
      hotelName: h.name,
      hotelImage: h.image,
      hotelLocation: h.location,
      roomId: r.id,
      roomName: r.name,
      roomPrice: r.price,
      checkIn: payload.checkIn,
      checkOut: payload.checkOut,
      nights,
      guests: payload.guests,
      guestName: payload.guestName,
      guestEmail: payload.guestEmail,
      guestPhone: payload.guestPhone,
      guestCountry: payload.guestCountry,
      requests: payload.requests,
      paymentMethod: payload.paymentMethod,
      ...totals,
      status: "upcoming",
      createdAt: new Date().toISOString(),
    };
  }
}
