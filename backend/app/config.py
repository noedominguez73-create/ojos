import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # API Keys
    together_api_key: str = ""
    google_api_key: str = ""  # For Google Gemini Vision
    google_cloud_credentials_path: str = ""

    # Vision settings
    vision_provider: str = "google"  # "google" or "together"
    vision_model: str = "gemini-2.0-flash"  # Google Gemini
    max_tokens: int = 300

    # TTS settings
    tts_language: str = "es-ES"
    tts_voice_name: str = "es-ES-Standard-A"
    tts_speaking_rate: float = 1.1

    # WebSocket settings
    frame_interval_ms: int = 1500

    # CORS
    allowed_origins: list = ["*"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
