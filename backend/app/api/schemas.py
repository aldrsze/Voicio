"""Pydantic models for the TTS API request/response contracts."""

from __future__ import annotations

from pydantic import BaseModel, Field


class TTSRequest(BaseModel):
    """Request body for ``POST /api/tts``."""

    text: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="Input text (mixed English & Tagalog)",
        examples=["Hello guys, kamusta kayo? Welcome to the app."],
    )
    voice_eng: str | None = Field(
        None,
        description="Override for the English Piper voice model name",
    )
    voice_tgl: str | None = Field(
        None,
        description="Override for the Tagalog Piper voice model name",
    )
    speed: float = Field(
        1.0,
        ge=0.5,
        le=2.0,
        description="Playback speed multiplier (0.5 – 2.0)",
    )


class VoiceInfo(BaseModel):
    """Describes a single available voice."""

    id: str = Field(description="Unique voice identifier (model name)")
    name: str = Field(description="Human-readable voice name")
    language: str = Field(description="Language code: 'en' or 'tl'")
    quality: str = Field(default="medium", description="Quality tier: low, medium, high")


class VoicesResponse(BaseModel):
    """Response for ``GET /api/voices``."""

    voices: list[VoiceInfo]


class HealthResponse(BaseModel):
    """Response for ``GET /api/health``."""

    status: str = Field(default="ok")
    piper_available: bool = Field(description="Whether the piper binary was found on PATH")
    models_found: int = Field(description="Number of .onnx model files detected")
