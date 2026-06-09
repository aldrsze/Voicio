"""Audio processing pipeline.

Single-language TTS synthesis with WAV output.
Takes text and a language code, routes to the correct engine.
Optionally accepts a specific voice ID for Piper models.
"""

from __future__ import annotations

import io
import logging

from app.core.tts import synthesise_async

logger = logging.getLogger(__name__)


# ── Public API ────────────────────────────────────────────────────────────


async def synthesise_text(
    text: str,
    *,
    language: str = "en",
    voice: str | None = None,
    speed: float = 1.0,
) -> bytes:
    """Synthesise *text* and return WAV bytes.

    Parameters
    ----------
    text:
        User-supplied input text (max 5000 chars).  Must not be empty.
    language:
        Language code (e.g. ``"en"``, ``"es"``, ``"tl"``).
        Must be one of the configured languages in ``settings.supported_languages``.
    voice:
        Optional specific Piper voice ID (e.g. ``"en_US-amy-medium"``).
        When provided, overrides the default voice for the language.
    speed:
        Playback speed multiplier (0.5 – 2.0).

    Returns
    -------
    Complete WAV file as ``bytes`` (16-bit mono PCM).
    """
    if not text or not text.strip():
        raise ValueError("No text to synthesise.")

    result = await synthesise_async(text, language=language, voice=voice, speed=speed)
    return _build_wav([result.audio_bytes], result.sample_rate)


# ── Internal helpers ──────────────────────────────────────────────────────


def _build_wav(chunks: list[bytes], sample_rate: int) -> bytes:
    """Concatenate raw 16-bit mono PCM chunks into a WAV file."""
    import wave

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)
        for chunk in chunks:
            wf.writeframes(chunk)

    return buf.getvalue()
