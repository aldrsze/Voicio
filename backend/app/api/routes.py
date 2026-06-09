"""API route handlers for the multi-language TTS service.

Each request targets a single language — the user selects which language
to speak, and the backend routes to the correct TTS engine (Piper or MMS).
Specific voice models can be selected by ID for finer control.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.api.schemas import GroupedVoicesResponse, HealthResponse, TTSRequest, VoiceInfo
from app.config import settings
from app.core.audio import synthesise_text
from app.core.tts import (
    check_edge_deps,
    check_mms_deps,
    check_piper_binary,
    get_engine,
)
from app.core.voice_profiles import get_voices_by_language

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
        400: {"description": "Invalid input (empty text, text too long, unsupported language, etc.)"},
        500: {"description": "TTS generation failure"},
    },
)
async def tts(request: TTSRequest) -> Response:
    """Generate speech from text in the requested language or voice.

    Returns a WAV file with ``Content-Type: audio/wav``. The language field
    determines which TTS engine is used:

    - **Piper** languages (en, es, fr, de, it, pt, nl, pl, ru) → local .onnx models
    - **MMS** languages (tl) → Hugging Face ``facebook/mms-tts-tgl``

    If a ``voice`` ID is provided (e.g. ``en_US-amy-medium``), it selects a
    specific Piper model and the language is inferred automatically.
    """
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text must not be empty.")

    # Determine the effective language and voice
    language = request.language
    voice = request.voice

    # If a specific voice is given, check it exists and infer language
    if voice:
        # Look up the voice to validate
        voices_by_lang = get_voices_by_language()
        found = False
        for lang, voice_list in voices_by_lang.items():
            for v in voice_list:
                if v["id"] == voice and v["available"]:
                    language = lang
                    found = True
                    break
            if found:
                break

        if not found:
            raise HTTPException(
                status_code=400,
                detail=f"Voice {voice!r} is not available or not found. "
                f"Check GET /api/voices for available voices.",
            )

        # When a specific voice ID is given, skip the supported_languages
        # check — the voice itself is the authority (edge-tts supports
        # many languages not in our config, e.g. Afrikaans, Arabic, etc.)
        pass_through = True
    else:
        pass_through = False

    if not pass_through:
        # Validate language is configured
        if language not in settings.supported_languages:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Unsupported language: {language!r}. "
                    f"Supported: {', '.join(settings.supported_languages)}"
                ),
            )

    try:
        wav_bytes = await synthesise_text(
            text,
            language=language,
            voice=voice,
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


@router.get("/voices", response_model=GroupedVoicesResponse)
async def list_voices() -> GroupedVoicesResponse:
    """Return all available voices grouped by language, with categories."""
    voices_by_lang = get_voices_by_language()

    # Convert to VoiceInfo models grouped by language
    result: dict[str, list[VoiceInfo]] = {}
    for lang_code, vlist in voices_by_lang.items():
        result[lang_code] = [VoiceInfo(**v) for v in vlist]

    if not result:
        logger.warning("No voices discovered.")

    return GroupedVoicesResponse(languages=result)


# ── GET /api/health ───────────────────────────────────────────────────────


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Lightweight health-check endpoint."""
    piper_available = check_piper_binary()
    mms_available = check_mms_deps()
    edge_available = check_edge_deps()

    model_dir = settings.models_dir
    models_found = len(list(model_dir.rglob("*.onnx"))) if model_dir.is_dir() else 0

    return HealthResponse(
        status="ok",
        piper_available=piper_available,
        mms_available=mms_available,
        edge_available=edge_available,
        models_found=models_found,
        languages=list(settings.supported_languages.keys()),
    )
