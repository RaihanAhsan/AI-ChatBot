export interface Room {
  id: string;
  name: string;
  price: number;
  size: string;
  bed: string;
  max: number;
  image: string;
  perks: string[];
}

export interface Hotel {
  id: string;
  name: string;
  city: string;
  location: string;
  rating: number;
  reviews: number;
  stars: number;
  price: number;
  image: string;
  gallery: string[];
  description: string;
  amenities: string[];
  rooms: Room[];
}

export interface UserProfile {
  email: string;
  name: string;
  phone?: string;
  city?: string;
  member_since?: string;
  tier?: string;
  role: "user" | "admin";
}

export interface BookingDraft {
  hotelId: string;
  hotelName: string;
  hotelImage: string;
  hotelLocation: string;
  roomId: string;
  roomName: string;
  roomPrice: number;
  checkIn: string;
  checkOut: string;
  guests: number;
  nights: number;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  guestCountry?: string;
  requests?: string;
}

export interface BookingItem {
  id: string;
  code: string;
  userEmail?: string;
  hotelId: string;
  hotelName: string;
  hotelImage: string;
  hotelLocation: string;
  roomId?: string;
  roomName: string;
  roomPrice: number;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestCountry?: string;
  requests: string;
  paymentMethod?: string;
  subtotal?: number;
  tax?: number;
  service?: number;
  total: number;
  status: "upcoming" | "completed";
  createdAt: string;
}

/* =========================================================
   SEPARATED CHATBOT LLM TYPES
   ========================================================= */
export interface LLMRecommendedHotel {
  id: string;
  name: string;
  city: string;
  location: string;
  rating: number;
  price: number;
  image: string;
  topRoom: string;
}

export interface LLMPriceQuote {
  hotelId: string;
  hotelName: string;
  hotelCity: string;
  roomId: string;
  roomName: string;
  roomPrice: number;
  nights: number;
  subtotal: number;
  tax: number;
  service: number;
  total: number;
}

export interface LLMMetadata {
  provider: string;
  model: string;
  latencyMs: number;
  matchedHotelsCount: number;
  activeBookingsCount: number;
  temperature: number;
}

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent?: string;
  recommendedHotels?: LLMRecommendedHotel[];
  priceQuote?: LLMPriceQuote | null;
  metadata?: LLMMetadata;
  timestamp: string;
}

export interface LLMPresetPrompt {
  id: string;
  category: string;
  title: string;
  prompt: string;
}

export interface LLMConfigState {
  active: {
    provider: string;
    model: string;
    has_key: boolean;
    label: string;
  };
  config: {
    provider: string;
    temperature: number;
    geminiModel: string;
    hasGeminiKey: boolean;
    openaiModel: string;
    openaiBaseUrl: string;
    hasOpenaiKey: boolean;
    groqModel: string;
    hasGroqKey: boolean;
    ollamaModel: string;
    ollamaBaseUrl: string;
    customSystemNote: string;
  };
  presets: LLMPresetPrompt[];
}
