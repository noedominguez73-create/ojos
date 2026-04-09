import base64
import logging
from typing import Optional

from app.config import get_settings
from app.models.schemas import AnalysisMode

logger = logging.getLogger(__name__)
settings = get_settings()


NAVIGATION_PROMPT = """Eres un asistente de navegación para personas CIEGAS. Tu trabajo es SALVAR VIDAS detectando peligros.

CONTEXTO: La imagen viene de una cámara frontal de un teléfono colgado en el pecho del usuario que camina.

ANALIZA CUIDADOSAMENTE:
1. OBSTÁCULOS INMEDIATOS (0-2 metros): Muy peligroso
   - Personas, animales, postes, señales, basureros
   - Muebles, sillas, mesas, cajas
   - Vehículos estacionados o en movimiento
   - Puertas (abiertas/cerradas), columnas, paredes

2. PELIGROS EN EL SUELO:
   - Escalones (subir o bajar), bordillos, rampas
   - Desniveles, huecos, alcantarillas, charcos
   - Cables, objetos tirados, bolsas

3. PELIGROS A MEDIA DISTANCIA (2-5 metros):
   - Personas acercándose, bicicletas, patinetas
   - Obras, conos, barreras
   - Vehículos en movimiento

REGLAS DE RESPUESTA:
- Si NO hay peligro visible: responde "Camino libre"
- Si HAY peligro: [Qué es] + [Dónde: izquierda/centro/derecha] + [Distancia aproximada]
- Prioriza el peligro MÁS CERCANO e INMEDIATO
- Sé CONSERVADOR: si dudas, advierte
- Máximo 15 palabras
- Solo español

EJEMPLOS:
- "Camino libre"
- "Escalón bajando a 1 metro, centro"
- "Persona a 2 metros, izquierda"
- "Silla a 1 metro, derecha, rodéala"
- "Pared al frente a 3 metros, gira derecha"

RESPONDE SOLO LA INSTRUCCIÓN:"""


SEARCH_PROMPT_TEMPLATE = """Eres un asistente visual para personas CIEGAS. Debes ayudar a encontrar: **{objeto}**

CONTEXTO: La imagen viene de una cámara frontal. El usuario no puede ver NADA.

BUSCA CUIDADOSAMENTE:
1. Examina TODA la imagen: izquierda, centro, derecha, arriba, abajo
2. Busca el objeto exacto o similares
3. Considera que puede estar parcialmente oculto

SI ENCUENTRAS EL OBJETO:
- Indica posición: izquierda / centro / derecha
- Indica distancia aproximada en metros
- Si está sobre algo, menciona qué (mesa, estante, suelo)

SI NO LO VES:
- Confirma que NO está visible
- Sugiere dirección para girar

EJEMPLOS:
- "{objeto} a la derecha, sobre la mesa, a 2 metros"
- "{objeto} al frente, en el suelo, a 1 metro"
- "No visible, gira a la derecha"

RESPONDE SOLO LA INSTRUCCIÓN (máximo 20 palabras):"""


class VisionService:
    def __init__(self):
        self.google_client = None
        self.together_client = None
        self.provider = settings.vision_provider
        self._initialize_clients()

    def _initialize_clients(self):
        # Try Google Gemini first (preferred)
        if settings.google_api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=settings.google_api_key)
                self.google_client = genai.GenerativeModel(settings.vision_model)
                self.provider = "google"
                logger.info(f"Google Gemini client initialized: {settings.vision_model}")
            except Exception as e:
                logger.error(f"Failed to initialize Google Gemini: {e}")

        # Fallback to Together AI
        if not self.google_client and settings.together_api_key:
            try:
                from together import Together
                self.together_client = Together(api_key=settings.together_api_key)
                self.provider = "together"
                logger.info("Together AI client initialized as fallback")
            except Exception as e:
                logger.error(f"Failed to initialize Together AI: {e}")

        if not self.google_client and not self.together_client:
            logger.error("No vision API configured! Set GOOGLE_API_KEY or TOGETHER_API_KEY")

    async def analyze_image(
        self,
        image_base64: str,
        mode: AnalysisMode,
        search_object: Optional[str] = None
    ) -> str:
        # Select prompt based on mode
        if mode == AnalysisMode.SEARCH and search_object:
            prompt = SEARCH_PROMPT_TEMPLATE.format(objeto=search_object)
        else:
            prompt = NAVIGATION_PROMPT

        # Clean base64 string if it has data URL prefix
        if "base64," in image_base64:
            image_base64 = image_base64.split("base64,")[1]

        # Use Google Gemini if available
        if self.google_client:
            return await self._analyze_with_google(image_base64, prompt)

        # Fallback to Together AI
        if self.together_client:
            return await self._analyze_with_together(image_base64, prompt)

        return "Error: Servicio de visión no configurado"

    async def _analyze_with_google(self, image_base64: str, prompt: str) -> str:
        try:
            import google.generativeai as genai

            # Decode base64 to bytes
            image_bytes = base64.b64decode(image_base64)

            # Create image part
            image_part = {
                "mime_type": "image/jpeg",
                "data": image_bytes
            }

            # Generate response
            response = self.google_client.generate_content([prompt, image_part])

            response_text = response.text.strip()
            logger.info(f"Google Vision analysis: {response_text}")
            return response_text

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Google Vision error: {error_msg}")

            if "api_key" in error_msg.lower() or "invalid" in error_msg.lower():
                return "Error: API key de Google inválida"
            elif "quota" in error_msg.lower() or "limit" in error_msg.lower():
                return "Error: Límite de API excedido"
            elif "safety" in error_msg.lower():
                return "Camino libre"  # Safety filter triggered, assume safe
            else:
                return f"Error: {error_msg[:50]}"

    async def _analyze_with_together(self, image_base64: str, prompt: str) -> str:
        try:
            response = self.together_client.chat.completions.create(
                model=settings.vision_model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_base64}"
                                }
                            },
                            {
                                "type": "text",
                                "text": prompt
                            }
                        ]
                    }
                ],
                max_tokens=settings.max_tokens
            )

            response_text = response.choices[0].message.content.strip()
            logger.info(f"Together Vision analysis: {response_text}")
            return response_text

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Together Vision error: {error_msg}")

            if "api_key" in error_msg.lower():
                return "Error: API key inválida"
            elif "model" in error_msg.lower():
                return "Error: Modelo no disponible"
            else:
                return f"Error: {error_msg[:50]}"
