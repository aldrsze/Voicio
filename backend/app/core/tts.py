"""TTS engine abstraction — Piper, MMS-TTS, and Edge TTS voices.

PiperTTS spawns the ``piper`` CLI subprocess per voice model.
MMSTTS uses Hugging Face ``transformers`` + ``torch`` for ``facebook/mms-tts-tgl``.
EdgeTTS uses Microsoft Edge online TTS (``edge-tts``) — 300+ voices, no downloads.

Engines are cached by voice ID or model ID.
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
from app.core.voice_profiles import discover_models, resolve_voice_engine

logger = logging.getLogger(__name__)

# ── Shared types ──────────────────────────────────────────────────────────


class SynthesisResult(NamedTuple):
    """Result of a single TTS synthesis call."""

    audio_bytes: bytes
    sample_rate: int
    language: str


class TTSBackend(ABC):
    """Abstract interface all TTS engines must implement."""

    @abstractmethod
    def synthesise(
        self,
        text: str,
        *,
        speed: float = 1.0,
    ) -> SynthesisResult:
        ...

    @abstractmethod
    def is_available(self) -> bool:
        ...


# ══════════════════════════════════════════════════════════════════════════
#  Piper TTS
# ══════════════════════════════════════════════════════════════════════════


class PiperTTS(TTSBackend):
    """Synchronous wrapper around the ``piper`` CLI for a single voice model.

    Each instance is bound to a specific voice (e.g. ``en_US-lessac-high``).
    The model path is resolved dynamically from the models directory,
    supporting both flat and nested directory layouts.
    """

    def __init__(self, voice: str, binary: str | None = None) -> None:
        self._binary = binary or settings.piper_binary
        self._voice = voice
        self._available: bool | None = None  # None=unchecked, True=ok, False=missing
        self._model_path: Path | None = None
        self._config_path: Path | None = None
        self._resolve_model()
        self._validate_binary()

    # ── Model file resolution ─────────────────────────────────────────

    def _resolve_model(self) -> None:
        """Locate the ``.onnx`` and ``.onnx.json`` files in the models tree."""
        model_dir = settings.models_dir
        if not model_dir.is_dir():
            self._available = False
            return

        # Search recursively — models may be nested in subdirectories
        for onnx_file in model_dir.rglob(f"{self._voice}.onnx"):
            self._model_path = onnx_file
            config = onnx_file.with_suffix(".onnx.json")
            self._config_path = config if config.exists() else None
            return

        # Fallback: flat file in models_dir (legacy layout)
        flat_model = model_dir / f"{self._voice}.onnx"
        if flat_model.exists():
            self._model_path = flat_model
            flat_config = model_dir / f"{self._voice}.onnx.json"
            self._config_path = flat_config if flat_config.exists() else None
            return

        self._available = False
        logger.warning("Voice model %r not found anywhere under %s", self._voice, model_dir)

    # ── Public API ───────────────────────────────────────────────────

    def is_available(self) -> bool:
        return (
            self._available is True
            and self._model_path is not None
            and self._model_path.exists()
            and self._config_path is not None
            and self._config_path.exists()
        )

    def synthesise(
        self,
        text: str,
        *,
        speed: float = 1.0,
    ) -> SynthesisResult:
        """Synthesise *text* using the configured Piper voice model."""
        if not self.is_available():
            raise RuntimeError(
                f"Piper voice {self._voice!r} is not available.\n\n"
                f"Ensure the piper binary is installed (`pip install piper-tts`)\n"
                f"and model files exist at:\n"
                f"  {self._model_path}\n"
                f"  {self._config_path}"
            )

        length_scale = round(1.0 / max(settings.min_speed, min(speed, settings.max_speed)), 3)

        cmd = [
            self._binary,
            "--model", str(self._model_path),
            "--config", str(self._config_path),
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

        # Infer language from voice name prefix (e.g. "en_US" → "en")
        inferred_lang = self._voice.split("_")[0]

        return SynthesisResult(
            audio_bytes=proc.stdout,
            sample_rate=self._read_sample_rate(),
            language=inferred_lang,
        )

    # ── Helpers ──────────────────────────────────────────────────────

    def _validate_binary(self) -> None:
        """Check whether the piper binary responds. Sets ``self._available``."""
        if self._available is False:
            return  # already failed model resolution

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

    def _read_sample_rate(self) -> int:
        """Parse the sample rate from Piper's JSON config (default 22050)."""
        import json

        if self._config_path is None:
            return 22050
        try:
            with open(self._config_path) as f:
                cfg = json.load(f)
            return int(cfg.get("audio", {}).get("sample_rate", 22050))
        except Exception:
            return 22050


# ══════════════════════════════════════════════════════════════════════════
#  MMS-TTS (Tagalog)
# ══════════════════════════════════════════════════════════════════════════


# Module-level flag so we don't spam the warning every time.
_MMS_DEPS_WARNED: bool = False


class MMSTTS(TTSBackend):
    """Tagalog TTS via Hugging Face ``facebook/mms-tts-tgl``.

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
        speed: float = 1.0,
    ) -> SynthesisResult:
        """Synthesise Tagalog *text* using the MMS-TTS model."""
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
            logger.info(
                "MMS model %s loaded successfully (sample rate: %d Hz)",
                self._model_id, self._sample_rate,
            )
        except Exception as exc:
            logger.error("Failed to load MMS model %s: %s", self._model_id, exc)
            self._available = False


# ══════════════════════════════════════════════════════════════════════════
#  Microsoft Edge TTS (Tagalog)
# ══════════════════════════════════════════════════════════════════════════

_EDGE_DEPS_WARNED: bool = False


class EdgeTTS(TTSBackend):
    """TTS via Microsoft Edge online TTS service (``edge-tts``).

    Supports 300+ neural voices across 140+ locales. No model files
    are needed — audio streams from Microsoft's cloud API on each call.
    The ``edge-tts`` library wraps Microsoft's free Edge TTS API.

    Uses a new event loop inside the thread-pool executor for the
    async ``edge_tts.Communicate`` API. The returned MP3 stream is
    transcoded to WAV via ``ffmpeg``.
    """

    def __init__(self, voice: str = "fil-PH-BlessicaNeural") -> None:
        self._voice = voice
        self._available = False
        try:
            import edge_tts  # noqa: F401
            self._available = True
        except ImportError:
            global _EDGE_DEPS_WARNED
            if not _EDGE_DEPS_WARNED:
                logger.warning(
                    "edge-tts library not installed. "
                    "Microsoft Edge TTS voices will be unavailable. "
                    "Install with: pip install edge-tts"
                )
                _EDGE_DEPS_WARNED = True

    # ── Public API ───────────────────────────────────────────────────

    def is_available(self) -> bool:
        return self._available

    def synthesise(
        self,
        text: str,
        *,
        speed: float = 1.0,
    ) -> SynthesisResult:
        """Synthesise Tagalog *text* via Microsoft Edge TTS."""
        if not self._available:
            raise RuntimeError(
                "Microsoft Edge TTS is not available — edge-tts library not installed."
            )

        import asyncio

        import edge_tts

        # Convert float speed (0.5–2.0) to edge-tts rate string (+/-%)
        rate_pct = int(round((speed - 1.0) * 100))
        rate_str = f"{rate_pct:+d}%"

        async def _synthesise() -> bytes:
            communicate = edge_tts.Communicate(
                text,
                self._voice,
                rate=rate_str,
            )
            audio_bytes = b""
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_bytes += chunk["data"]
            return audio_bytes

        try:
            mp3_bytes = asyncio.run(_synthesise())
        except Exception as exc:
            raise RuntimeError(
                f"Microsoft Edge TTS synthesis failed for voice {self._voice!r}: {exc}"
            ) from exc

        # Transcode MP3 → WAV (16-bit mono PCM) via ffmpeg
        try:
            proc = subprocess.run(
                [
                    "ffmpeg",
                    "-i", "pipe:0",
                    "-f", "wav",
                    "-acodec", "pcm_s16le",
                    "-ac", "1",
                    "-ar", "24000",
                    "pipe:1",
                ],
                input=mp3_bytes,
                capture_output=True,
                timeout=60,
                check=True,
            )
            wav_bytes = proc.stdout
        except FileNotFoundError:
            raise RuntimeError(
                "ffmpeg not found on PATH. "
                "Install ffmpeg to use Microsoft Edge TTS voices."
            ) from None
        except subprocess.CalledProcessError as exc:
            stderr = exc.stderr.decode("utf-8", errors="replace") if exc.stderr else ""
            raise RuntimeError(f"ffmpeg transcoding failed: {stderr}") from exc

        return SynthesisResult(
            audio_bytes=wav_bytes,
            sample_rate=24000,
            language="tl",
        )

_engines: dict[str, TTSBackend] = {}


def get_engine(language: str, voice: str | None = None) -> TTSBackend:
    """Return (or create) the TTS engine for the given language or voice.

    Engines are cached once created. When a specific ``voice`` ID is
    provided, it is used as the cache key. The engine type (Piper vs MMS)
    is determined from the language's config.

    Args:
        language: Language code (e.g. ``"en"``, ``"tl"``).
        voice: Optional specific voice ID (e.g. ``"en_US-amy-medium"``).

    Returns:
        A ``TTSBackend`` instance ready for synthesis.
    """
    # If a specific voice is given, cache by voice ID
    if voice:
        if voice not in _engines:
            voice_engine = resolve_voice_engine(voice)
            if voice_engine == "edge":
                _engines[voice] = EdgeTTS(voice=voice)
            elif voice_engine == "mms":
                lang_config = settings.supported_languages.get(language, {})
                _engines[voice] = MMSTTS(
                    model_id=lang_config.get("model_id", "facebook/mms-tts-tgl")
                )
            else:
                _engines[voice] = PiperTTS(voice=voice)
        return _engines[voice]

    # Otherwise, use the language-default voice from config
    if language not in _engines:
        lang_config = settings.supported_languages.get(language)
        if not lang_config:
            raise ValueError(
                f"Unsupported language: {language!r}. "
                f"Supported: {', '.join(settings.supported_languages)}"
            )

        if lang_config["engine"] == "mms":
            _engines[language] = MMSTTS(model_id=lang_config["model_id"])
        elif lang_config["engine"] == "piper":
            default_voice = lang_config.get("voice", "")
            _engines[language] = PiperTTS(voice=default_voice)
        elif lang_config["engine"] == "edge":
            default_voice = lang_config.get("voice", "")
            _engines[language] = EdgeTTS(voice=default_voice)
        else:
            raise ValueError(
                f"Unknown engine type {lang_config['engine']!r} for language {language!r}"
            )

    return _engines[language]


# ══════════════════════════════════════════════════════════════════════════
#  Health-check utilities (lightweight, no instance needed)
# ══════════════════════════════════════════════════════════════════════════


def check_piper_binary() -> bool:
    """Quick check if the piper CLI binary is available (no model loading)."""
    try:
        binary = settings.piper_binary
        proc = subprocess.run([binary, "--help"], capture_output=True, timeout=10)
        return proc.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def check_mms_deps() -> bool:
    """Check if MMS dependencies are importable (no model loading)."""
    try:
        import torch  # noqa: F401
        import transformers  # noqa: F401
        return True
    except ImportError:
        return False


def check_edge_deps() -> bool:
    """Check if edge-tts library is importable (no model loading)."""
    try:
        import edge_tts  # noqa: F401
        return True
    except ImportError:
        return False


# ══════════════════════════════════════════════════════════════════════════
#  Async dispatch
# ══════════════════════════════════════════════════════════════════════════


async def synthesise_async(
    text: str,
    *,
    language: str = "en",
    voice: str | None = None,
    speed: float = 1.0,
) -> SynthesisResult:
    """Non-blocking wrapper — runs the correct TTS engine in a thread pool."""
    engine = get_engine(language, voice=voice)
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,
        lambda: engine.synthesise(text, speed=speed),
    )
