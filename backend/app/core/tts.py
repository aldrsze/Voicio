"""Piper TTS wrapper.

Handles invocation of the ``piper`` binary and returns raw audio
bytes for a given text and voice model.
"""

from __future__ import annotations

import asyncio
import logging
import subprocess
import sys
from pathlib import Path
from typing import NamedTuple

from app.config import settings

logger = logging.getLogger(__name__)

# ── Public types ──────────────────────────────────────────────────────────


class SynthesisResult(NamedTuple):
    """Result of a single TTS synthesis call."""

    audio_bytes: bytes
    sample_rate: int
    language: str  # "en" or "tl"


class PiperTTS:
    """Synchronous wrapper around the ``piper`` CLI.

    Each call spawns a subprocess — fast enough for the MVP's sequential
    chunk-generation model and avoids GIL headaches with Piper's C++
    bindings during concurrent requests.

    Usage
    -----
        >>> tts = PiperTTS()
        >>> result = tts.synthesise("Hello world", voice="en_US-lessac-medium")
        >>> len(result.audio_bytes)
        12345
    """

    def __init__(self, binary: str | None = None) -> None:
        self._binary = binary or settings.piper_binary
        self._validate_binary()

    # ── Public API ───────────────────────────────────────────────────

    def synthesise(
        self,
        text: str,
        *,
        voice: str | None = None,
        language: str = "en",
        speed: float = 1.0,
    ) -> SynthesisResult:
        """Synthesise *text* with the given *voice*.

        Parameters
        ----------
        text:
            Input text to speak.
        voice:
            Piper voice/model name. Falls back to the configured default
            for *language* when omitted.
        language:
            ``"en"`` or ``"tl"`` — used only to pick a fallback voice.
        speed:
            Playback speed multiplier (0.5 – 2.0). Piper applies this via
            ``--length-scale`` (inverse of speed).

        Returns
        -------
        SynthesisResult with raw 16-bit mono PCM WAV bytes.
        """
        voice = voice or self._default_voice(language)
        model_path = settings.models_dir / f"{voice}.onnx"
        config_path = settings.models_dir / f"{voice}.json"

        if not model_path.exists():
            raise FileNotFoundError(
                f"Piper model not found at {model_path}. "
                f"Place {voice}.onnx and {voice}.json in {settings.models_dir}."
            )

        # Piper uses --length-scale (higher = slower).
        # Inverse of speed so 2.0x speed → 0.5 length scale.
        length_scale = round(1.0 / max(settings.min_speed, min(speed, settings.max_speed)), 3)

        cmd = [
            self._binary,
            "--model", str(model_path),
            "--config", str(config_path),
            "--output-raw",
            "--length-scale", str(length_scale),
        ]

        logger.debug("Running piper: %s", " ".join(cmd))

        try:
            proc = subprocess.run(
                cmd,
                input=text.encode("utf-8"),
                capture_output=True,
                timeout=120,
                check=True,
            )
        except subprocess.TimeoutExpired:
            raise RuntimeError(f"Piper timed out after 120 s for text: {text[:50]!r}…")
        except subprocess.CalledProcessError as exc:
            stderr = exc.stderr.decode("utf-8", errors="replace") if exc.stderr else ""
            raise RuntimeError(f"Piper failed (exit {exc.returncode}): {stderr}") from exc

        return SynthesisResult(
            audio_bytes=proc.stdout,
            sample_rate=self._read_sample_rate(config_path),
            language=language,
        )

    # ── Helpers ──────────────────────────────────────────────────────

    def _validate_binary(self) -> None:
        """Raise early if the piper binary cannot be found."""
        try:
            subprocess.run(
                [self._binary, "--help"],
                capture_output=True,
                check=False,
            )
        except FileNotFoundError:
            logger.warning(
                "Piper binary %r not found on PATH. "
                "Install piper-tts or set TT_PIPER_BINARY.",
                self._binary,
            )

    @staticmethod
    def _default_voice(language: str) -> str:
        if language == "tl":
            return settings.voice_tagalog
        return settings.voice_english

    @staticmethod
    def _read_sample_rate(config_path: Path) -> int:
        """Parse the sample rate from Piper's JSON config.

        Returns 22050 as the default if parsing fails.
        """
        import json

        try:
            with open(config_path) as f:
                cfg = json.load(f)
            return int(cfg.get("audio", {}).get("sample_rate", 22050))
        except Exception:
            return 22050


# ── Async convenience ─────────────────────────────────────────────────────

_tts: PiperTTS | None = None


def get_tts() -> PiperTTS:
    """Return a module-level singleton (lazy-initialised)."""
    global _tts
    if _tts is None:
        _tts = PiperTTS()
    return _tts


async def synthesise_async(
    text: str,
    *,
    voice: str | None = None,
    language: str = "en",
    speed: float = 1.0,
) -> SynthesisResult:
    """Non-blocking wrapper — runs ``PiperTTS.synthesise`` in a thread pool."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,
        get_tts().synthesise,
        text,
    )
