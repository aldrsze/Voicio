"""App config — env vars with local-dev defaults, overridable via docker-compose."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


# Supported languages — each maps a lang code to engine + default voice.
# Piper: download .onnx+.json from https://huggingface.co/rhasspy/piper-voices
# MMS: auto-downloads from Hugging Face Hub on first use.

SUPPORTED_LANGUAGES: dict[str, dict[str, str]] = {
    "en": {
        "name": "English (US)",
        "native_name": "English",
        "engine": "piper",
        "voice": "en_US-lessac-high",
        "quality": "high",
    },
    "es": {
        "name": "Spanish",
        "native_name": "Español",
        "engine": "piper",
        "voice": "es_ES-sharvard-medium",
        "quality": "medium",
    },
    "fr": {
        "name": "French",
        "native_name": "Français",
        "engine": "piper",
        "voice": "fr_FR-siwis-medium",
        "quality": "medium",
    },
    "de": {
        "name": "German",
        "native_name": "Deutsch",
        "engine": "piper",
        "voice": "de_DE-eva-medium",
        "quality": "medium",
    },
    "it": {
        "name": "Italian",
        "native_name": "Italiano",
        "engine": "piper",
        "voice": "it_IT-paola-medium",
        "quality": "medium",
    },
    "pt": {
        "name": "Portuguese (Brazil)",
        "native_name": "Português",
        "engine": "piper",
        "voice": "pt_BR-edresson-medium",
        "quality": "medium",
    },
    "nl": {
        "name": "Dutch",
        "native_name": "Nederlands",
        "engine": "piper",
        "voice": "nl_NL-mls-medium",
        "quality": "medium",
    },
    "pl": {
        "name": "Polish",
        "native_name": "Polski",
        "engine": "piper",
        "voice": "pl_PL-mls-medium",
        "quality": "medium",
    },
    "ru": {
        "name": "Russian",
        "native_name": "Русский",
        "engine": "piper",
        "voice": "ru_RU-irina-medium",
        "quality": "medium",
    },
    "tl": {
        "name": "Tagalog",
        "native_name": "Tagalog",
        "engine": "mms",
        "model_id": "facebook/mms-tts-tgl",
        "quality": "medium",
    },
}


@dataclass(frozen=True)
class Settings:
    # ── Paths ──
    base_dir: Path = Path(__file__).resolve().parent.parent  # backend/
    models_dir: Path = field(default_factory=lambda: _resolve_models_dir())

    # ── Server ──
    host: str = os.getenv("TT_HOST", "0.0.0.0")
    port: int = int(os.getenv("TT_PORT", "8000"))
    debug: bool = os.getenv("TT_DEBUG", "true").lower() in ("1", "true", "yes")

    # ── CORS ──
    cors_origins: list[str] = field(default_factory=lambda: _parse_cors())

    # ── TTS ──
    piper_binary: str = os.getenv("TT_PIPER_BINARY", "piper")
    default_language: str = os.getenv("TT_DEFAULT_LANG", "en")

    # ── Limits ──
    max_text_length: int = 5000
    max_speed: float = 2.0
    min_speed: float = 0.5

    # ── Languages ──
    supported_languages: dict = field(default_factory=lambda: dict(SUPPORTED_LANGUAGES))


def _resolve_models_dir() -> Path:
    env_path = os.getenv("TT_MODELS_DIR")
    if env_path:
        return Path(env_path).resolve()
    return (Path(__file__).resolve().parent.parent / "models").resolve()


def _parse_cors() -> list[str]:
    raw = os.getenv("TT_CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
    return [o.strip() for o in raw.split(",") if o.strip()]


settings = Settings()
