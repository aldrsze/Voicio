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
    format: str = "wav",
) -> bytes:
    """Synthesise text → audio bytes in target format."""
    if not text or not text.strip():
        raise ValueError("No text to synthesise.")

    result = await synthesise_async(text, language=language, voice=voice, speed=speed)
    wav_bytes = _build_wav([result.audio_bytes], result.sample_rate)
    
    return _transcode(wav_bytes, format)


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


def _transcode(wav_bytes: bytes, target_format: str) -> bytes:
    """Transcode WAV bytes using ffmpeg."""
    import subprocess

    target_format = target_format.lower()
    if target_format == "wav":
        return wav_bytes

    if target_format not in ("mp3", "ogg"):
        raise ValueError(f"Unsupported target format: {target_format!r}")

    cmd = [
        "ffmpeg",
        "-i", "pipe:0",
        "-f", target_format,
        "pipe:1",
    ]

    try:
        proc = subprocess.run(
            cmd,
            input=wav_bytes,
            capture_output=True,
            timeout=30,
            check=True,
        )
        return proc.stdout
    except FileNotFoundError:
        raise RuntimeError("ffmpeg not found on PATH. Conversion failed.") from None
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr.decode("utf-8", errors="replace") if exc.stderr else ""
        raise RuntimeError(f"ffmpeg conversion failed: {stderr}") from exc

