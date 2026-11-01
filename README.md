# Aurelia Collection — Full-Stack Luxury Hotel Booking & Modular AI Concierge

A five-star luxury hotel reservation platform built with **Next.js (Frontend)** and **FastAPI (Backend)**, evolved from `prototype.html` with a **cleanly isolated AI Concierge LLM module**.

---

## 📂 Project Structure

```text
HOTEL/
├── prototype.html                         # Original HTML prototype
├── backend/                               # FastAPI Backend + SQLite Database
│   ├── main.py                            # FastAPI entrypoint & router registration
│   ├── database.py                        # SQLite connection & auto-seeded hotel/user data
│   ├── schemas.py                         # Pydantic schemas for Hotel, Booking, and Auth
│   ├── requirements.txt                   # Python dependencies
│   ├── .env.example                       # Environment variable template for LLM API Keys
│   ├── routers/                           # Core Business Modules (Non-LLM)
│   │   ├── auth.py                        # Login, Registration & Session endpoints (/api/auth)
│   │   ├── hotels.py                      # Hotel Catalog & Wishlist endpoints (/api/hotels)
│   │   ├── bookings.py                    # Reservation & Payment endpoints (/api/bookings)
│   │   └── profile.py                     # Member Profile & Statistics endpoints (/api/profile)
│   └── llm/                               # 🤖 DEDICATED ISOLATED LLM CHATBOT MODULE
│       ├── __init__.py
│       ├── config.py                      # Backend-only LLM configuration loaded from .env
│       ├── prompts.py                     # "Aurelia Concierge" system prompt & quick-topic presets
│       ├── knowledge_base.py              # Real-time RAG Builder (Hotel Catalog, Budget Filter, Tax/Service Calculator, User Bookings)
│       ├── providers.py                   # External LLM API connectors (Gemini, OpenAI, Groq, Ollama) + Smart RAG Fallback Engine
│       ├── service.py                     # Conversation orchestrator, interactive hotel cards & quick replies
│       └── router.py                      # Dedicated LLM endpoints (/api/llm/chat, /api/llm/config, /api/llm/context-preview)
│
└── frontend/                              # Next.js 15 (App Router, TypeScript, Tailwind CSS)
    ├── package.json
    ├── tailwind.config.ts
    └── src/
        ├── types/index.ts                 # TypeScript interfaces for Hotel, Booking, and LLM
        ├── lib/
        │   ├── hotelApi.ts                # API client for core hotel booking & authentication
        │   └── llmApi.ts                  # 🤖 Dedicated API client for the AI Concierge (/api/llm/*)
        ├── middleware.ts                  # Automatic route guard (/dashboard <-> /login)
        ├── components/
        │   └── llm/                       # 🤖 ISOLATED LLM CHATBOT UI COMPONENTS
        │       ├── FloatingConcierge.tsx  # Pure floating chat widget on all pages
        │       └── ConciergeStudioView.tsx# Full-page Aurelia Concierge chat interface
        └── app/
            ├── globals.css
            ├── layout.tsx
            ├── page.tsx                   # Session-aware root redirect
            ├── login/page.tsx             # Sign In & Create Account page (/login)
            └── dashboard/page.tsx         # Protected luxury hotel booking dashboard (/dashboard)
```

---

## 🚀 Getting Started

### 1. Run the Backend (FastAPI)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Copy .env.example to .env and add your GEMINI_API_KEY
cp .env.example .env

uvicorn main:app --reload --port 8000
```

- **Swagger UI API Documentation**: `http://localhost:8000/docs`
- **Database**: Automatically initializes and seeds `backend/aurelia.db` on startup.

### 2. Run the Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

- Open `http://localhost:3000` in your browser:
  - Unauthenticated users are automatically redirected to `http://localhost:3000/login` (including direct visits to `/dashboard`).
  - Authenticated users (including after closing and reopening the browser tab) are automatically directed to `http://localhost:3000/dashboard`.
- **Demo Accounts**:
  - **Guest Account**: `demo@aurelia.com` / `123456` *(or register a new account directly on the **Create Account** tab)*
  - **Admin Account**: `admin@aurelia.com` / `admin123`

---

## 🤖 AI Concierge LLM Module Highlights (`backend/llm/` & `components/llm/`)

1. **Isolated Architecture**: All AI prompt engineering, real-time RAG context building, budget/price calculations, and LLM provider calls are encapsulated inside `backend/llm/` and `frontend/src/components/llm/`.
2. **Backend-Managed `.env` Configuration**:
   - All LLM provider credentials (`GEMINI_API_KEY`, `GEMINI_MODEL=gemini-3.5-flash`) live strictly in `backend/.env` so guests enjoy a clean, pure luxury concierge chat experience without technical model labels.
   - Includes a built-in **Aurelia Smart RAG Fallback Engine** that accurately answers hotel recommendations, budget filters, multi-night price simulations (including 11% VAT + 5% service charge), and booking lookups even if the external API is offline.
3. **Interactive Chat Surfaces**:
   - **Floating Concierge Widget**: Accessible from the bottom-right corner across every page.
   - **Dedicated `Ask Concierge` Page**: Full-screen conversational concierge with quick-topic starters, interactive hotel cards, and one-click price quote booking.
