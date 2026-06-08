"""TTS engine abstraction — Piper for English, MMS-TTS for Tagalog.

PiperTTS spawns the ``piper`` CLI subprocess (fast, low memory).
MMSTTS uses Hugging Face ``transformers`` + ``torch`` for the MMS-TTS
model (``facebook/mms-tts-tgl``) — the only accessible native Tagalog TTS.
"""

from __future__ import annotations

import asyncio
import io
import logging
import subprocess
import wave
from abc import ABC, abstractmethod
from pathlib import Path
from typing import NamedTuple

import numpy as np

from app.config import settings

logger = logging.getLogger(__name__)

# ── Shared types ──────────────────────────────────────────────────────────


class SynthesisResult(NamedTuple):
    """Result of a single TTS synthesis call."""

    audio_bytes: bytes
    sample_rate: int
    language: str  # "en" or "tl"


class TTSBackend(ABC):
    """Abstract interface all TTS engines must implement."""

    @abstractmethod
    def synthesise(
        self,
        text: str,
        *,
        voice: str | None = None,
        speed: float = 1.0,
    ) -> SynthesisResult:
        ...

    @abstractmethod
    def is_available(self) -> bool:
        ...


# ══════════════════════════════════════════════════════════════════════════
#  English — Piper TTS
# ══════════════════════════════════════════════════════════════════════════


class PiperTTS(TTSBackend):
    """Synchronous wrapper around the ``piper`` CLI.

    Used for English TTS with high-quality Piper voice models
    (``.onnx`` + ``.onnx.json`` in ``settings.models_dir``).

    Each call spawns a subprocess — fast enough for the MVP's sequential
    chunk-generation model and avoids GIL headaches with Piper's C++
    bindings during concurrent requests.
    """

    def __init__(self, binary: str | None = None) -> None:
        self._binary = binary or settings.piper_binary
        self._available: bool | None = None  # None=unchecked, True=ok, False=missing
        self._validate_binary()

    # ── Public API ───────────────────────────────────────────────────

    def is_available(self) -> bool:
        return self._available is True

    def synthesise(
        self,
        text: str,
        *,
        voice: str | None = None,
        speed: float = 1.0,
    ) -> SynthesisResult:
        """Synthesise English *text* with the given Piper *voice*."""
        if self._available is False:
            raise RuntimeError(
                f"Piper binary {self._binary!r} is not available.\n\n"
                f"Install it with:\n"
                f"    pip install piper-tts\n\n"
                f"Then check /api/health to confirm."
            )

        voice = voice or settings.voice_english
        model_path = settings.models_dir / f"{voice}.onnx"
        config_path = settings.models_dir / f"{voice}.onnx.json"

        if not model_path.exists():
            raise FileNotFoundError(
                f"Piper model not found at {model_path}. "
                f"Place {voice}.onnx and {voice}.onnx.json in {settings.models_dir}."
            )

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
        except FileNotFoundError as exc:
            raise RuntimeError(
                f"Piper binary {self._binary!r} not found. "
                f"Install piper-tts (`pip install piper-tts`) "
                f"or set the TT_PIPER_BINARY env-var to the full path."
            ) from exc
        except subprocess.TimeoutExpired:
            raise RuntimeError(f"Piper timed out after 120 s for text: {text[:50]!r}…")
        except subprocess.CalledProcessError as exc:
            stderr = exc.stderr.decode("utf-8", errors="replace") if exc.stderr else ""
            raise RuntimeError(f"Piper failed (exit {exc.returncode}): {stderr}") from exc

        return SynthesisResult(
            audio_bytes=proc.stdout,
            sample_rate=self._read_sample_rate(config_path),
            language="en",
        )

    # ── Helpers ──────────────────────────────────────────────────────

    def _validate_binary(self) -> None:
        """Check whether the piper binary responds. Sets ``self._available``."""
        try:
            proc = subprocess.run(
                [self._binary, "--help"],
                capture_output=True,
                timeout=30,
                check=False,
            )
            self._available = proc.returncode == 0
            if not self._available:
                stderr = proc.stderr.decode("utf-8", errors="replace")
                logger.warning(
                    "Piper binary %r returned exit code %d: %s",
                    self._binary, proc.returncode, stderr,
                )
        except FileNotFoundError:
            self._available = False
            logger.warning("Piper binary %r not found on PATH.", self._binary)

    @staticmethod
    def _read_sample_rate(config_path: Path) -> int:
        """Parse the sample rate from Piper's JSON config (default 22050)."""
        import json

        try:
            with open(config_path) as f:
                cfg = json.load(f)
            return int(cfg.get("audio", {}).get("sample_rate", 22050))
        except Exception:
            return 22050


# ══════════════════════════════════════════════════════════════════════════
#  Tagalog — MMS-TTS (Hugging Face)
# ══════════════════════════════════════════════════════════════════════════


# Module-level flag cached so we don't spam the warning every call.
_MMS_DEPS_WARNED: bool = False


class MMSTTS(TTSBackend):
    """Tagalog TTS via Hugging Face ``facebook/mms-tts-tgl``.

    The MMS (Massively Multilingual Speech) model from Facebook Research
    is the first production-quality neural TTS model with native Tagalog
    support.

    Requires ``transformers[torch]`` and ``torch`` — installed as optional
    dependencies (see ``requirements.txt``).
    """

    def __init__(self, model_id: str = "facebook/mms-tts-tgl") -> None:
        self._model_id = model_id
        self._model = None
        self._tokenizer = None
        self._sample_rate: int = 16000  # MMS default
        self._available = False
        self._load_model()

    # ── Public API ───────────────────────────────────────────────────

    def is_available(self) -> bool:
        return self._available

    def synthesise(
        self,
        text: str,
        *,
        voice: str | None = None,
        speed: float = 1.0,
    ) -> SynthesisResult:
        """Synthesise Tagalog *text* using the MMS-TTS model.

        ``voice`` is ignored — the Tagalog model is fixed.
        """
        if not self._available:
            raise RuntimeError(
                f"MMS model {self._model_id} is not loaded. "
                f"Ensure ``transformers[torch]`` and ``torch`` are installed."
            )

        inputs = self._tokenizer(text, return_tensors="pt")
        with self._torch.no_grad():
            outputs = self._model(**inputs)

        # waveform shape: (batch, channels, samples) → squeeze to 1-D
        audio = outputs.waveform.squeeze().cpu().numpy()

        # Speed adjustment via linear interpolation resampling.
        if speed != 1.0:
            orig_len = len(audio)
            new_len = max(1, int(orig_len / speed))
            indices = np.linspace(0, orig_len - 1, new_len)
            audio = np.interp(indices, np.arange(orig_len), audio)

        # Normalise to 16-bit PCM range and clip
        peak = np.max(np.abs(audio))
        if peak > 0:
            audio = audio / peak  # normalise to [-1, 1]
        audio_int16 = (audio * 32767).clip(-32768, 32767).astype(np.int16)

        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(self._sample_rate)
            wf.writeframes(audio_int16.tobytes())

        return SynthesisResult(
            audio_bytes=buf.getvalue(),
            sample_rate=self._sample_rate,
            language="tl",
        )

    # ── Helpers ──────────────────────────────────────────────────────

    def _load_model(self) -> None:
        """Download and cache the MMS-TTS model from Hugging Face Hub."""
        global _MMS_DEPS_WARNED

        try:
            import torch as _torch_mod  # noqa: F401 — used by synthesise()
            from transformers import VitsModel, AutoTokenizer  # type: ignore[import-untyped]
            self._torch = _torch_mod
        except ImportError:
            if not _MMS_DEPS_WARNED:
                logger.warning(
                    "MMS-TTS dependencies (transformers + torch) not installed. "
                    "Tagalog TTS will be unavailable. "
                    "Install with: pip install transformers[torch] torch"
                )
                _MMS_DEPS_WARNED = True
            self._available = False
            return

        try:
            logger.info("Downloading MMS model %s … (this may take a minute)", self._model_id)
            self._model = VitsModel.from_pretrained(self._model_id)
            self._tokenizer = AutoTokenizer.from_pretrained(self._model_id)
            self._sample_rate = self._model.config.sampling_rate
            self._available = True
            logger.info("MMS model %s loaded successfully (sample rate: %d Hz)", self._model_id, self._sample_rate)
        except Exception as exc:
            logger.error("Failed to load MMS model %s: %s", self._model_id, exc)
            self._available = False


# ══════════════════════════════════════════════════════════════════════════
#  Singletons & dispatch
# ══════════════════════════════════════════════════════════════════════════

_piper: PiperTTS | None = None
_mms: MMSTTS | None = None


def get_piper() -> PiperTTS:
    """Return the module-level Piper singleton (lazy initialised)."""
    global _piper
    if _piper is None:
        _piper = PiperTTS()
    return _piper


def get_mms() -> MMSTTS:
    """Return the module-level MMS-TTS singleton (lazy initialised)."""
    global _mms
    if _mms is None:
        _mms = MMSTTS()
    return _mms


def get_tts_for_language(language: str) -> TTSBackend:
    """Return the correct TTS backend for the given language code."""
    if language == "tl":
        return get_mms()
    return get_piper()


async def synthesise_async(
    text: str,
    *,
    voice: str | None = None,
    language: str = "en",
    speed: float = 1.0,
) -> SynthesisResult:
    """Non-blocking wrapper — runs the correct TTS engine in a thread pool."""
    tts = get_tts_for_language(language)
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,
        lambda: tts.synthesise(text, voice=voice, speed=speed),
    )


# ── Backwards-compat alias ─────────────────────────────────────────────────
# Existing code that calls ``get_tts()`` for Piper still works.
get_tts = get_piper
