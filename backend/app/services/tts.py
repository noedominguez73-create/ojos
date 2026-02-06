import base64
import logging
import os
from typing import Optional

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Try to import Google Cloud TTS, but don't fail if not available
try:
    from google.cloud import texttospeech
    GOOGLE_TTS_AVAILABLE = True
except ImportError:
    GOOGLE_TTS_AVAILABLE = False
    logger.warning("Google Cloud TTS not available - using browser TTS fallback")


class TTSService:
    def __init__(self):
        self.client = None
        self.enabled = False
        self._initialize_client()

    def _initialize_client(self):
        if not GOOGLE_TTS_AVAILABLE:
            logger.info("Google Cloud TTS library not installed - using browser TTS")
            return

        try:
            # Set credentials path if provided
            creds_path = settings.google_cloud_credentials_path
            if creds_path and os.path.exists(creds_path):
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = creds_path
                self.client = texttospeech.TextToSpeechClient()
                self.enabled = True
                logger.info("Google Cloud TTS client initialized successfully")
            else:
                logger.info("Google Cloud credentials not configured - using browser TTS")
        except Exception as e:
            logger.warning(f"Google Cloud TTS not available: {e}")
            logger.info("Using browser TTS fallback")

    async def synthesize_speech(self, text: str) -> Optional[str]:
        if not self.client or not self.enabled:
            # Return None - frontend will use browser TTS
            return None

        if not text or text.startswith("Error"):
            return None

        try:
            # Configure synthesis input
            synthesis_input = texttospeech.SynthesisInput(text=text)

            # Configure voice parameters
            voice = texttospeech.VoiceSelectionParams(
                language_code=settings.tts_language,
                name=settings.tts_voice_name,
                ssml_gender=texttospeech.SsmlVoiceGender.FEMALE
            )

            # Configure audio output
            audio_config = texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.MP3,
                speaking_rate=settings.tts_speaking_rate,
                pitch=0.0
            )

            # Perform synthesis
            response = self.client.synthesize_speech(
                input=synthesis_input,
                voice=voice,
                audio_config=audio_config
            )

            # Encode audio to base64
            audio_base64 = base64.b64encode(response.audio_content).decode("utf-8")
            logger.info(f"TTS generated audio for: {text[:50]}...")

            return audio_base64

        except Exception as e:
            logger.error(f"TTS synthesis error: {e}")
            return None

    def get_available_voices(self, language_code: str = "es") -> list:
        if not self.client or not self.enabled or not GOOGLE_TTS_AVAILABLE:
            return []

        try:
            response = self.client.list_voices(language_code=language_code)
            voices = []
            for voice in response.voices:
                voices.append({
                    "name": voice.name,
                    "language_codes": list(voice.language_codes),
                    "gender": texttospeech.SsmlVoiceGender(voice.ssml_gender).name
                })
            return voices
        except Exception as e:
            logger.error(f"Error listing voices: {e}")
            return []
