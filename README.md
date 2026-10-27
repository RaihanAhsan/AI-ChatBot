# Aurelia Collection — Full-Stack Luxury Hotel Booking & Modular AI Concierge

Aplikasi pemesanan hotel mewah bintang lima berbasis **Next.js (Frontend)** dan **FastAPI (Backend)** yang dikembangkan dari `prototype.html`, dengan **pemisahan arsitektur khusus untuk modul Chatbot LLM**.

---

## 📂 Struktur Folder Proyek

```text
HOTEL/
├── prototype.html                         # File prototype asli
├── backend/                               # FastAPI Backend + SQLite Database
│   ├── main.py                            # Entrypoint FastAPI & registrasi router
│   ├── database.py                        # Koneksi SQLite & auto-seed data hotel/user
│   ├── schemas.py                         # Pydantic schemas untuk Hotel, Booking, Auth
│   ├── requirements.txt                   # Dependensi Python
│   ├── .env.example                       # Konfigurasi environment & API Keys LLM
│   ├── routers/                           # Modul Bisnis Utama (Non-LLM)
│   │   ├── auth.py                        # Endpoint Login & Sesi User (/api/auth)
│   │   ├── hotels.py                      # Endpoint Katalog Hotel & Wishlist (/api/hotels)
│   │   ├── bookings.py                    # Endpoint Reservasi & Pembayaran (/api/bookings)
│   │   └── profile.py                     # Endpoint Profil & Statistik Member (/api/profile)
│   └── llm/                               # 🤖 MODUL KHUSUS CHATBOT LLM TERPISAH
│       ├── __init__.py
│       ├── config.py                      # Multi-provider config (Gemini, OpenAI, Groq, Ollama, Smart RAG)
│       ├── prompts.py                     # System Prompt Persona "Aurelia Concierge" & Preset Skenario
│       ├── knowledge_base.py              # Real-time RAG Builder (Katalog Hotel, Kalkulator Pajak/Service, Reservasi User)
│       ├── providers.py                   # Konektor API LLM eksternal + Built-in Smart RAG Fallback Engine
│       ├── service.py                     # Orchestrator percakapan, ekstraksi kartu hotel & quick replies
│       └── router.py                      # Endpoint khusus LLM (/api/llm/chat, /api/llm/config, /api/llm/context-preview)
│
└── frontend/                              # Next.js 15 (App Router, TypeScript, Tailwind CSS)
    ├── package.json
    ├── tailwind.config.ts
    └── src/
        ├── types/index.ts                 # Definisi tipe data Hotel, Booking, dan LLM
        ├── lib/
        │   ├── hotelApi.ts                # Client API untuk bisnis utama (Auth, Hotel, Booking)
        │   └── llmApi.ts                  # 🤖 Client API khusus Chatbot LLM (/api/llm/*)
        ├── middleware.ts                  # Route Guard otomatis (/dashboard <-> /login)
        ├── components/
        │   └── llm/                       # 🤖 KOMPONEN UI KHUSUS CHATBOT LLM TERPISAH
        │       ├── FloatingConcierge.tsx  # Floating Chat Widget murni tanpa label model LLM
        │       └── ConciergeStudioView.tsx# Halaman Concierge (Mode User Murni vs Mode Admin Konfigurasi LLM)
        └── app/
            ├── globals.css
            ├── layout.tsx
            ├── page.tsx                   # Auto-redirect berdasarkan sesi login
            ├── login/page.tsx             # Halaman Login & Registrasi Akun Baru (/login)
            └── dashboard/page.tsx         # Halaman Dashboard Terproteksi (/dashboard)
```

---

## 🚀 Cara Menjalankan Aplikasi

### 1. Menjalankan Backend (FastAPI)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Opsional: salin .env.example ke .env jika ingin menambahkan API Key Gemini / OpenAI / Groq
cp .env.example .env

uvicorn main:app --reload --port 8000
```

- **Swagger UI Dokumentasi API**: `http://localhost:8000/docs`
- **Database**: Otomatis membuat dan mengisi `backend/aurelia.db` saat pertama kali dijalankan.

### 2. Menjalankan Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

- Buka `http://localhost:3000` di browser:
  - Jika belum login, otomatis dialihkan ke `http://localhost:3000/login` (termasuk jika memaksa akses `/dashboard`).
  - Jika sudah login (atau menutup lalu membuka kembali tab browser), otomatis dialihkan langsung ke `http://localhost:3000/dashboard`.
- **Akun Tersedia**:
  - **User Tamu (`role: user`)**: `demo@aurelia.com` / `123456` *(atau daftar akun baru langsung di tab **Daftar Akun Baru**)* — Hanya tampilan pemesanan hotel & pure chatbot concierge tanpa informasi model LLM.
  - **Admin (`role: admin`)**: `admin@aurelia.com` / `admin123` — Memiliki akses ke **⚙ Pengaturan Model LLM** untuk mengganti provider/model LLM (`Gemini`, `OpenAI`, `Groq`, `Ollama`, atau `Smart Engine`).

---

## 🤖 Keunggulan Modul Chatbot LLM (`backend/llm/` & `components/llm/`)

1. **Arsitektur Terisolasi**: Seluruh logika AI, prompt engineering, RAG context builder, dan provider switching dipisahkan di dalam `backend/llm/` dan `frontend/src/components/llm/`.
2. **Multi-Provider Fleksibel + Zero-Setup Fallback**:
   - Mendukung **Google Gemini**, **OpenAI**, **Groq**, dan **Ollama (Local)**.
   - Dilengkapi **Aurelia Smart RAG Engine (Built-in)** sehingga langsung dapat menjawab pertanyaan rekomendasi hotel, menghitung simulasi harga kamar (termasuk PPN 11% + Service 5%), dan mengecek kode booking aktif user **tanpa wajib mengisi API Key terlebih dahulu**.
3. **Dua Antarmuka Chatbot**:
   - **Floating Chat Widget**: Selalu tampil di pojok kanan bawah di setiap halaman.
   - **Halaman Khusus `✦ AI Concierge LLM`**: Memiliki panel **Pengaturan Provider LLM** (ganti model, API key, temperature, dan custom prompt secara live) serta fitur **Inspeksi Konteks RAG**.
