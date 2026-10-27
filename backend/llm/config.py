import os
from pathlib import Path
from typing import Dict, Optional
from dotenv import load_dotenv
from pydantic import BaseModel

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=ENV_PATH, override=True)


class LLMRuntimeConfig(BaseModel):
    provider: str = os.getenv("LLM_PROVIDER", "gemini")  # gemini | openai | groq | ollama | auto | smart_fallback
    temperature: float = float(os.getenv("LLM_TEMPERATURE", "0.4"))
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "").strip()
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-3.5-flash").strip()
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "").strip()
    openai_base_url: str = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").strip()
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()
    groq_api_key: str = os.getenv("GROQ_API_KEY", "").strip()
    groq_model: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").strip()
    ollama_model: str = os.getenv("OLLAMA_MODEL", "llama3.2").strip()
    custom_system_note: str = ""


class LLMConfigUpdate(BaseModel):
    provider: Optional[str] = None
    temperature: Optional[float] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
    base_url: Optional[str] = None
    custom_system_note: Optional[str] = None


runtime_config = LLMRuntimeConfig()


def reload_env_config() -> None:
    """Membaca ulang file backend/.env secara otomatis agar perubahan API Key langsung aktif."""
    load_dotenv(dotenv_path=ENV_PATH, override=True)
    runtime_config.provider = os.getenv("LLM_PROVIDER", "gemini").strip()
    runtime_config.temperature = float(os.getenv("LLM_TEMPERATURE", "0.4"))
    runtime_config.gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
    runtime_config.gemini_model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash").strip()
    runtime_config.openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()
    runtime_config.openai_base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").strip()
    runtime_config.openai_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()
    runtime_config.groq_api_key = os.getenv("GROQ_API_KEY", "").strip()
    runtime_config.groq_model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
    runtime_config.ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").strip()
    runtime_config.ollama_model = os.getenv("OLLAMA_MODEL", "llama3.2").strip()


def get_active_provider_info() -> Dict[str, str]:
    """Resolves which provider will be used based on backend/.env configuration."""
    reload_env_config()
    p = runtime_config.provider.lower()
    if (p == "gemini" or p == "auto") and runtime_config.gemini_api_key:
        return {
            "provider": "gemini",
            "model": runtime_config.gemini_model,
            "has_key": True,
            "label": f"Google Gemini ({runtime_config.gemini_model})",
        }
    if (p == "openai" or p == "auto") and runtime_config.openai_api_key:
        return {
            "provider": "openai",
            "model": runtime_config.openai_model,
            "has_key": True,
            "label": f"OpenAI ({runtime_config.openai_model})",
        }
    if (p == "groq" or p == "auto") and runtime_config.groq_api_key:
        return {
            "provider": "groq",
            "model": runtime_config.groq_model,
            "has_key": True,
            "label": f"Groq Cloud ({runtime_config.groq_model})",
        }
    if p == "ollama":
        return {
            "provider": "ollama",
            "model": runtime_config.ollama_model,
            "has_key": True,
            "label": f"Ollama Local ({runtime_config.ollama_model})",
        }
    return {
        "provider": "smart_fallback",
        "model": "aurelia-rag-concierge-v2",
        "has_key": False,
        "label": "Aurelia Smart RAG Engine (Built-in)",
    }


def update_runtime_config(update: LLMConfigUpdate) -> Dict[str, str]:
    return get_active_provider_info()
