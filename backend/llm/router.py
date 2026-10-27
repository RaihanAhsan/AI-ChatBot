from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from llm.config import (
    LLMConfigUpdate,
    get_active_provider_info,
    runtime_config,
    update_runtime_config,
)
from llm.knowledge_base import PROMOS_DATA, POLICIES_DATA, build_rag_analysis
from llm.prompts import PRESET_PROMPTS
from llm.service import process_chat_message

router = APIRouter(prefix="/api/llm", tags=["Chatbot LLM (Aurelia Concierge)"])


class ChatMessageItem(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessageItem]
    userEmail: Optional[str] = "demo@aurelia.com"


@router.post("/chat")
async def chat_endpoint(payload: ChatRequest):
    raw_msgs = [{"role": m.role, "content": m.content} for m in payload.messages]
    result = await process_chat_message(
        messages=raw_msgs,
        user_email=payload.userEmail or "demo@aurelia.com",
    )
    return result


@router.get("/config")
def get_llm_config():
    active = get_active_provider_info()
    return {
        "active": active,
        "config": {
            "provider": runtime_config.provider,
            "temperature": runtime_config.temperature,
            "geminiModel": runtime_config.gemini_model,
            "hasGeminiKey": bool(runtime_config.gemini_api_key),
            "openaiModel": runtime_config.openai_model,
            "openaiBaseUrl": runtime_config.openai_base_url,
            "hasOpenaiKey": bool(runtime_config.openai_api_key),
            "groqModel": runtime_config.groq_model,
            "hasGroqKey": bool(runtime_config.groq_api_key),
            "ollamaModel": runtime_config.ollama_model,
            "ollamaBaseUrl": runtime_config.ollama_base_url,
            "customSystemNote": runtime_config.custom_system_note,
        },
        "presets": PRESET_PROMPTS,
    }


@router.post("/config")
def set_llm_config(
    payload: LLMConfigUpdate,
    role: str = Query(default="admin"),
):
    if role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Akses ditolak: Hanya Admin yang dapat mengubah konfigurasi model LLM.",
        )
    active = update_runtime_config(payload)
    return {
        "status": "updated",
        "active": active,
        "provider": runtime_config.provider,
        "temperature": runtime_config.temperature,
    }


@router.get("/context-preview")
def preview_rag_context(user_email: str = Query(default="demo@aurelia.com")):
    rag = build_rag_analysis("preview", user_email=user_email)
    return {
        "hotelsCount": len(rag["all_hotels"]),
        "userBookingsCount": len(rag["user_bookings"]),
        "promos": PROMOS_DATA,
        "policies": POLICIES_DATA,
        "knowledgeText": rag["knowledge_text"],
    }
