"""FastAPI entry: uvicorn app.main:app --reload"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.config import settings
from app.core.voice_profiles import prewarm_edge_voices

# ── Logging ──

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)

logger = logging.getLogger(__name__)

# ── App ──

app = FastAPI(
    title="Voicio TTS",
    description="Multi-language Text-to-Speech (English, Spanish, French, German, Italian, Portuguese, Dutch, Polish, Russian, Tagalog)",
    version="0.2.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ──

app.include_router(router, prefix="/api")


# ── Startup ──

@app.on_event("startup")
async def startup() -> None:
    """Log config on startup for operator verification."""
    logger.info(
        "Voicio TTS starting — host=%s port=%s debug=%s",
        settings.host, settings.port, settings.debug,
    )
    logger.info("Models directory: %s", settings.models_dir)

    langs = ", ".join(
        f"{code} ({cfg['name']})"
        for code, cfg in settings.supported_languages.items()
    )
    logger.info("Configured languages: %s", langs)

    # Pre-warm edge-tts cache so first /api/voices call is fast.
    await prewarm_edge_voices()
