from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from routers import auth, bookings, hotels, profile
from llm.router import router as llm_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Aurelia Collection API & Modular LLM Concierge",
    description="Backend FastAPI untuk Luxury Hotel Booking dengan modul Chatbot LLM terpisah (/api/llm).",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core Hotel & Booking Routers
app.include_router(auth.router)
app.include_router(hotels.router)
app.include_router(bookings.router)
app.include_router(profile.router)

# Separated Chatbot LLM Router
app.include_router(llm_router)


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "Aurelia Collection Backend",
        "llmModule": "active (/api/llm)",
    }
