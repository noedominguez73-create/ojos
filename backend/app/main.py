import asyncio
import json
import logging
import os
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from typing import Dict, Set
import base64

from app.config import get_settings
from app.models.schemas import AnalysisMode, AnalysisResponse, WebSocketMessage
from app.services.vision import VisionService
from app.services.tts import TTSService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(
    title="OjosParaCiego API",
    description="Asistente visual para personas ciegas usando Claude Vision",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Services
vision_service = VisionService()
tts_service = TTSService()

# Active WebSocket connections
active_connections: Dict[str, WebSocket] = {}


class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"Client connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(f"Client disconnected. Total connections: {len(self.active_connections)}")

    async def send_response(self, websocket: WebSocket, response: AnalysisResponse):
        await websocket.send_json(response.model_dump())


manager = ConnectionManager()


# Determine static files path
STATIC_DIR = Path(__file__).parent.parent.parent / "frontend"
if not STATIC_DIR.exists():
    STATIC_DIR = Path(__file__).parent.parent / "static"


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/")
async def serve_index():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"status": "ok", "message": "OjosParaCiego API running"}


# Mount static files (CSS, JS, etc.) - must be after specific routes
if STATIC_DIR.exists():
    app.mount("/css", StaticFiles(directory=STATIC_DIR / "css"), name="css")
    app.mount("/js", StaticFiles(directory=STATIC_DIR / "js"), name="js")

    @app.get("/manifest.json")
    async def serve_manifest():
        return FileResponse(STATIC_DIR / "manifest.json")

    @app.get("/sw.js")
    async def serve_sw():
        return FileResponse(STATIC_DIR / "sw.js", media_type="application/javascript")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)

    try:
        while True:
            data = await websocket.receive_text()

            try:
                message = json.loads(data)
                msg_type = message.get("type", "")

                if msg_type == "ping":
                    await websocket.send_json({"type": "pong"})
                    continue

                if msg_type == "frame":
                    frame_data = message.get("data", {})
                    image_base64 = frame_data.get("image", "")
                    mode_str = frame_data.get("mode", "navigation")
                    search_object = frame_data.get("searchObject")

                    mode = AnalysisMode.SEARCH if mode_str == "search" else AnalysisMode.NAVIGATION

                    if not image_base64:
                        continue

                    # Analyze image with Claude Vision
                    analysis_text = await vision_service.analyze_image(
                        image_base64=image_base64,
                        mode=mode,
                        search_object=search_object
                    )

                    # Generate audio response
                    audio_base64 = None
                    if analysis_text:
                        audio_base64 = await tts_service.synthesize_speech(analysis_text)

                    response = AnalysisResponse(
                        text=analysis_text,
                        audio_base64=audio_base64,
                        mode=mode,
                        success=True
                    )

                    await manager.send_response(websocket, response)

                elif msg_type == "command":
                    command_data = message.get("data", {})
                    command = command_data.get("command", "")

                    if command == "search":
                        search_object = command_data.get("searchObject", "")
                        await websocket.send_json({
                            "type": "command_ack",
                            "command": "search",
                            "searchObject": search_object
                        })

            except json.JSONDecodeError:
                logger.error("Invalid JSON received")
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid JSON format"
                })
            except Exception as e:
                logger.error(f"Error processing message: {e}")
                await websocket.send_json({
                    "type": "error",
                    "message": str(e)
                })

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
