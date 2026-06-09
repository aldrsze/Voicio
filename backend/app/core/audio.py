"""Audio pipeline — single-language TTS synthesis to WAV."""

from __future__ import annotations

import io

from app.core.tts import synthesise_async


# ── Public API ──


async def synthesise_text(
    text: str,
    *,
    language: str = "en",
    voice: str | None = None,
    speed: float = 1.0,
) -> bytes:
    """Synthesise text → WAV bytes (16-bit mono PCM)."""
    if not text or not text.strip():
        raise ValueError("No text to synthesise.")

    result = await synthesise_async(text, language=language, voice=voice, speed=speed)
    return _build_wav([result.audio_bytes], result.sample_rate)


# ── Helpers ──


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
