"""Application configuration.

Settings are loaded from environment variables with sensible defaults
for local development. Production overrides should be set via docker-compose
or the container runtime.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    # ── Paths ──────────────────────────────────────────────────────────
    # Root of the backend directory (two levels up from this file)
    base_dir: Path = Path(__file__).resolve().parent.parent.parent
    models_dir: Path = field(default_factory=lambda: _resolve_models_dir())

    # ── Server ─────────────────────────────────────────────────────────
    host: str = os.getenv("TT_HOST", "0.0.0.0")
    port: int = int(os.getenv("TT_PORT", "8000"))
    debug: bool = os.getenv("TT_DEBUG", "true").lower() in ("1", "true", "yes")

    # ── CORS ───────────────────────────────────────────────────────────
    # Comma-separated list of origins allowed for requests
    cors_origins: list[str] = field(default_factory=lambda: _parse_cors())

    # ── TTS ────────────────────────────────────────────────────────────
    # Piper binary path (auto-resolved on PATH if not set)
    piper_binary: str = os.getenv("TT_PIPER_BINARY", "piper")

    voice_english: str = os.getenv("TT_VOICE_EN", "en_US-lessac-medium")
    voice_tagalog: str = os.getenv("TT_VOICE_TL", "tl_PH-male-medium")

    # ── Limits (per PRD) ──────────────────────────────────────────────
    max_text_length: int = 5000
    max_speed: float = 2.0
    min_speed: float = 0.5

    # ── Language detection ─────────────────────────────────────────────
    # "fasttext", "langdetect", or "lingua"
    detector_backend: str = os.getenv("TT_DETECTOR", "langdetect")
    # Path to fasttext quantised model (only used when backend == "fasttext")
    fasttext_model: str | None = os.getenv("TT_FASTTEXT_MODEL", None)


def _resolve_models_dir() -> Path:
    env_path = os.getenv("TT_MODELS_DIR")
    if env_path:
        return Path(env_path).resolve()
    return (Path(__file__).resolve().parent.parent.parent / "models").resolve()


def _parse_cors() -> list[str]:
    raw = os.getenv("TT_CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
    return [o.strip() for o in raw.split(",") if o.strip()]


settings = Settings()
