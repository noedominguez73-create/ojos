import anthropic
import base64
import logging
from typing import Optional

from app.config import get_settings
from app.models.schemas import AnalysisMode

logger = logging.getLogger(__name__)
settings = get_settings()


NAVIGATION_PROMPT = """Eres un asistente de navegación para personas ciegas. Analiza esta imagen de la cámara frontal del usuario que camina.

INSTRUCCIONES:
- Detecta obstáculos: personas, objetos, escalones, desniveles, vehículos, puertas, paredes, huecos
- Indica si el camino está libre para avanzar
- Si hay obstáculo: tipo + distancia aproximada + posición (izquierda/centro/derecha)
- Responde en español, MUY breve (máximo 10 palabras)
- Prioriza la seguridad del usuario

EJEMPLOS DE RESPUESTAS:
- "Libre"
- "Escalón a 2 metros"
- "Persona a la izquierda"
- "Pared al frente, gira derecha"
- "Objeto en el suelo, centro"
- "Puerta abierta a la derecha"

Responde SOLO con la instrucción, sin explicaciones adicionales."""


SEARCH_PROMPT_TEMPLATE = """Eres un asistente para personas ciegas. El usuario busca: {objeto}

INSTRUCCIONES:
- Localiza el objeto en la imagen
- Si lo encuentras: indica dirección (izquierda/derecha/frente/arriba/abajo) + distancia aproximada
- Si no está visible: sugiere girar para buscarlo
- Responde en español, máximo 15 palabras
- Sé muy preciso con las direcciones

EJEMPLOS:
- "Vaso a tu derecha, a 1 metro sobre la mesa"
- "No visible, gira lentamente a la derecha"
- "Silla al frente, a 2 metros"
- "Llaves a la izquierda, en la mesa"

Responde SOLO con la instrucción."""


class VisionService:
    def __init__(self):
        self.client = None
        self._initialize_client()

    def _initialize_client(self):
        try:
            api_key = settings.anthropic_api_key
            if api_key:
                self.client = anthropic.Anthropic(api_key=api_key)
                logger.info("Anthropic client initialized successfully")
            else:
                logger.warning("ANTHROPIC_API_KEY not set")
        except Exception as e:
            logger.error(f"Failed to initialize Anthropic client: {e}")

    async def analyze_image(
        self,
        image_base64: str,
        mode: AnalysisMode,
        search_object: Optional[str] = None
    ) -> str:
        if not self.client:
            logger.error("Anthropic client not initialized")
            return "Error: Servicio no disponible"

        try:
            # Clean base64 string if it has data URL prefix
            if "base64," in image_base64:
                image_base64 = image_base64.split("base64,")[1]

            # Select prompt based on mode
            if mode == AnalysisMode.SEARCH and search_object:
                prompt = SEARCH_PROMPT_TEMPLATE.format(objeto=search_object)
            else:
                prompt = NAVIGATION_PROMPT

            # Call Claude Vision API
            message = self.client.messages.create(
                model=settings.claude_model,
                max_tokens=settings.max_tokens,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/jpeg",
                                    "data": image_base64
                                }
                            },
                            {
                                "type": "text",
                                "text": prompt
                            }
                        ]
                    }
                ]
            )

            # Extract text response
            response_text = message.content[0].text.strip()
            logger.info(f"Vision analysis: {response_text}")
            return response_text

        except anthropic.APIError as e:
            logger.error(f"Anthropic API error: {e}")
            return "Error de conexión"
        except Exception as e:
            logger.error(f"Vision analysis error: {e}")
            return "Error al analizar"
