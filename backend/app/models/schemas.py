from pydantic import BaseModel
from typing import Optional, Literal
from enum import Enum


class AnalysisMode(str, Enum):
    NAVIGATION = "navigation"
    SEARCH = "search"


class FrameRequest(BaseModel):
    image_base64: str
    mode: AnalysisMode = AnalysisMode.NAVIGATION
    search_object: Optional[str] = None


class AnalysisResponse(BaseModel):
    text: str
    audio_base64: Optional[str] = None
    mode: AnalysisMode
    success: bool = True
    error: Optional[str] = None


class WebSocketMessage(BaseModel):
    type: Literal["frame", "command", "ping", "config"]
    data: Optional[dict] = None


class CommandMessage(BaseModel):
    command: Literal["start_navigation", "stop_navigation", "search", "analyze_once"]
    search_object: Optional[str] = None
