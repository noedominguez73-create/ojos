from together import Together
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
        self.client = None
        self._initialize_client()

    def _initialize_client(self):
        try:
            api_key = settings.together_api_key
            if api_key:
                self.client = Together(api_key=api_key)
                logger.info("Together AI client initialized successfully")
            else:
                logger.warning("TOGETHER_API_KEY not set")
        except Exception as e:
            logger.error(f"Failed to initialize Together AI client: {e}")

    async def analyze_image(
        self,
        image_base64: str,
        mode: AnalysisMode,
        search_object: Optional[str] = None
    ) -> str:
        if not self.client:
            logger.error("Together AI client not initialized")
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

            # Call Together AI Vision API
            response = self.client.chat.completions.create(
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

            # Extract text response
            response_text = response.choices[0].message.content.strip()
            logger.info(f"Vision analysis: {response_text}")
            return response_text

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Vision analysis error: {error_msg}")

            # Provide more specific error messages
            if "api_key" in error_msg.lower() or "unauthorized" in error_msg.lower():
                return "Error: API key inválida"
            elif "rate" in error_msg.lower() or "limit" in error_msg.lower():
                return "Error: Límite de API excedido"
            elif "model" in error_msg.lower():
                return "Error: Modelo no disponible"
            else:
                return f"Error al analizar: {error_msg[:50]}"
