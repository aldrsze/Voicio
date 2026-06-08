"""API route handlers for the TTS service.

English speech → Piper TTS (with high-quality .onnx voice models)
Tagalog speech → MMS-TTS (facebook/mms-tts-tgl via Hugging Face)

The API contract exposes both languages natively — no more Spanish model hack.
"""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.api.schemas import HealthResponse, TTSRequest, VoiceInfo, VoicesResponse
from app.config import settings
from app.core.audio import synthesise_text
from app.core.tts import get_piper, get_mms

logger = logging.getLogger(__name__)

router = APIRouter()


# ── POST /api/tts ─────────────────────────────────────────────────────────


@router.post(
    "/tts",
    response_class=Response,
    responses={
        200: {
            "content": {"audio/wav": {}},
            "description": "WAV audio bytes",
        },
        400: {"description": "Invalid input (empty text, text too long, etc.)"},
        500: {"description": "TTS generation failure"},
    },
)
async def tts(request: TTSRequest) -> Response:
    """Generate speech from mixed English/Tagalog text.

    Returns a WAV file with ``Content-Type: audio/wav``. The backend
    automatically detects which sentences are English vs Tagalog and
    routes each segment to the correct TTS engine:

    - **English** → Piper TTS (local .onnx voice models)
    - **Tagalog** → MMS-TTS (facebook/mms-tts-tgl via Hugging Face)
    """
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text must not be empty.")

    try:
        wav_bytes = await synthesise_text(
            text,
            voice_en=request.voice_eng,
            speed=request.speed,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except RuntimeError as exc:
        logger.exception("TTS synthesis failed")
        raise HTTPException(status_code=500, detail=str(exc))

    return Response(
        content=wav_bytes,
        media_type="audio/wav",
        headers={
            "Content-Disposition": "attachment; filename=voicio-output.wav",
        },
    )


# ── GET /api/voices ───────────────────────────────────────────────────────


@router.get("/voices", response_model=VoicesResponse)
async def list_voices() -> VoicesResponse:
    """Return all available Piper voice models + MMS-TTS Tagalog model."""
    voices: list[VoiceInfo] = []
    model_dir = settings.models_dir

    # 1. Scan local Piper .onnx models (English)
    if model_dir.is_dir():
        for onnx_file in sorted(model_dir.glob("*.onnx")):
            voice_id = onnx_file.stem
            # Only show English models via Piper
            if voice_id.startswith("en_"):
                voices.append(
                    VoiceInfo(
                        id=voice_id,
                        name=voice_id,
                        language="en",
                        engine="piper",
                    )
                )

    # 2. Add MMS-TTS Tagalog model (always available if dependencies installed)
    mms = get_mms()
    voices.append(
        VoiceInfo(
            id="facebook/mms-tts-tgl",
            name="MMS-TTS Tagalog",
            language="tl",
            quality="high",
            engine="mms",
        )
    )

    if not voices:
        logger.warning("No voices available.")

    return VoicesResponse(voices=voices)


# ── GET /api/health ───────────────────────────────────────────────────────


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Lightweight health-check endpoint."""
    piper = get_piper()
    mms = get_mms()

    model_dir = settings.models_dir
    models_found = len(list(model_dir.glob("*.onnx"))) if model_dir.is_dir() else 0

    return HealthResponse(
        status="ok",
        piper_available=piper.is_available(),
        mms_available=mms.is_available(),
        models_found=models_found,
    )
