"""FastAPI application entry point.

Usage
-----
    uvicorn app.main:app --reload
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.config import settings

# ── Logging ───────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)

logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Voicio TTS",
    description="Bilingual Text-to-Speech for English & Tagalog (Taglish)",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────

app.include_router(router, prefix="/api")


# ── Startup event ─────────────────────────────────────────────────────────


@app.on_event("startup")
async def startup() -> None:
    """Log configuration on startup so operators can verify settings."""
    logger.info("Voicio TTS starting — host=%s port=%s debug=%s", settings.host, settings.port, settings.debug)
    logger.info("Models directory: %s", settings.models_dir)
    logger.info("Detector backend: %s", settings.detector_backend)
    logger.info("Default voices — en: %s  tl (via es model): %s", settings.voice_english, settings.voice_spanish)
