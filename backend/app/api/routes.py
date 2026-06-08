"""API route handlers for the TTS service.

NOTE: The API contract speaks "Tagalog" (the user-facing purpose) while
the backend internals use Spanish Piper models — the closest accessible
model for Tagalog. Translation happens at the route boundary:
  - ``request.voice_tgl`` → ``voice_es`` param in the TTS pipeline
  - ``es_*`` model files on disk → reported as ``"tl"`` language in voice lists
"""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.api.schemas import HealthResponse, TTSRequest, VoiceInfo, VoicesResponse
from app.config import settings
from app.core.audio import synthesise_text
from app.core.tts import get_tts

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
    routes each segment to the corresponding Piper voice model.

    *Tagalog segments are synthesised with a Spanish Piper model
    (the closest accessible model).*
    """
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text must not be empty.")

    try:
        wav_bytes = await synthesise_text(
            text,
            voice_en=request.voice_eng,
            voice_es=request.voice_tgl,  # TL → Spanish model internally
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
    """Return all available Piper voice models found on disk.

    Spanish (``es_*``) models are reported as ``"tl"`` language —
    they serve as the Tagalog voices.
    """
    voices: list[VoiceInfo] = []
    model_dir = settings.models_dir

    if model_dir.is_dir():
        for onnx_file in sorted(model_dir.glob("*.onnx")):
            voice_id = onnx_file.stem
            language = _infer_language(voice_id)
            voices.append(
                VoiceInfo(
                    id=voice_id,
                    name=voice_id,
                    language=language,
                )
            )

    if not voices:
        logger.warning("No .onnx model files found in %s", model_dir)

    return VoicesResponse(voices=voices)


# ── GET /api/health ───────────────────────────────────────────────────────


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Lightweight health-check endpoint."""
    tts = get_tts()
    piper_available = tts._binary is not None  # noqa: SLF001 — pragmatic for health check

    model_dir = settings.models_dir
    models_found = len(list(model_dir.glob("*.onnx"))) if model_dir.is_dir() else 0

    return HealthResponse(
        status="ok",
        piper_available=piper_available,
        models_found=models_found,
    )


# ── Helpers ───────────────────────────────────────────────────────────────


def _infer_language(voice_id: str) -> str:
    """Guess language from a Piper voice ID.

    ``es_*`` models are returned as ``"tl"`` — they fill the Tagalog
    voice slot.
    """
    parts = voice_id.split("_")
    if len(parts) >= 1 and parts[0] == "es":
        return "tl"
    return "en"
