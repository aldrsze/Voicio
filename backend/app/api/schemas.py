"""Pydantic models for TTS API request/response contracts."""

from __future__ import annotations

from pydantic import BaseModel, Field


class TTSRequest(BaseModel):
    """Request body for ``POST /api/tts``."""

    text: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="Input text to synthesise",
        examples=["Hello, welcome to the app!"],
    )
    language: str = Field(
        "en",
        description=(
            "Language code for TTS output. "
            "Must be one of the configured languages (e.g. 'en', 'es', 'fr', 'tl'). "
            "Ignored if a specific ``voice`` is provided."
        ),
        examples=["en", "es", "fr", "tl"],
    )
    voice: str | None = Field(
        None,
        description=(
            "Specific voice model ID (e.g. ``en_US-amy-medium``, ``en_GB-cori-high``). "
            "When provided, ``language`` is inferred from the voice prefix. "
            "When omitted, the default voice for ``language`` is used."
        ),
        examples=["en_US-amy-medium", "en_GB-cori-high"],
    )
    speed: float = Field(
        0.85,
        ge=0.5,
        le=2.0,
        description="Playback speed multiplier (0.5 – 2.0)",
    )


class VoiceInfo(BaseModel):
    """Describes a single available voice model."""

    id: str = Field(description="Unique voice identifier (e.g. 'en_US-amy-medium')")
    name: str = Field(description="Display name (e.g. 'Amy')")
    language: str = Field(description="Language code (e.g. 'en', 'es', 'tl')")
    region: str = Field(default="", description="Region code (e.g. 'US', 'GB')")
    quality: str = Field(default="medium", description="Quality tier: low, medium, high")
    engine: str = Field(default="piper", description="TTS engine: 'piper', 'mms', or 'edge'")
    gender: str = Field(default="mixed", description="Voice gender: female, male, non-binary, mixed")
    vibe: list[str] = Field(default_factory=list, description="Descriptive tags like 'warm', 'bright', 'deep'")
    description: str = Field(default="", description="Short description of the voice character")
    available: bool = Field(default=False, description="Whether model files are present and ready")


class GroupedVoicesResponse(BaseModel):
    """Response for ``GET /api/voices`` — voices grouped by language."""

    languages: dict[str, list[VoiceInfo]]


class HealthResponse(BaseModel):
    """Response for ``GET /api/health``."""

    status: str = Field(default="ok")
    piper_available: bool = Field(description="Whether the piper binary was found on PATH")
    mms_available: bool = Field(description="Whether the MMS-TTS dependencies are installed")
    edge_available: bool = Field(description="Whether the edge-tts library is installed")
    models_found: int = Field(description="Number of Piper .onnx model files detected in user models dir")
    languages: list[str] = Field(description="List of configured language codes")


# ── Model management ──


class CatalogVoice(BaseModel):
    """Describes a downloadable Piper voice from the public catalog."""

    id: str = Field(description="Unique voice identifier (e.g. 'en_US-lessac-medium')")
    name: str = Field(description="Display name (e.g. 'Lessac')")
    language: str = Field(description="Language code (e.g. 'en', 'es', 'de')")
    region: str = Field(default="", description="Region code (e.g. 'US', 'GB')")
    quality: str = Field(default="medium", description="Quality tier: x_low, low, medium, high")
    gender: str = Field(default="mixed", description="Voice gender: female, male, non-binary, mixed")
    vibe: list[str] = Field(default_factory=list, description="Descriptive tags like 'warm', 'bright'")
    description: str = Field(default="", description="Short description of the voice character")
    size_mb: float = Field(default=50, description="Estimated download size in MB")
    installed: bool = Field(default=False, description="Whether model files are present on disk")


class ModelCatalogResponse(BaseModel):
    """Response for ``GET /api/models/catalog``."""

    voices: list[CatalogVoice]
