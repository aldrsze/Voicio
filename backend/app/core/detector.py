"""Language detection module.

Sentence-level classification of text as English (en) or Spanish (es).
Multiple backends are supported — swap via the `TT_DETECTOR` env-var.
"""

from __future__ import annotations

import logging
import re
from typing import Protocol

from app.config import settings

logger = logging.getLogger(__name__)

# ── Public API ────────────────────────────────────────────────────────────


class Detector(Protocol):
    """Protocol any detector backend must satisfy."""

    name: str

    def detect_lang(self, text: str) -> str:
        """Return ``"en"`` or ``"es"`` (or ``"un"`` for unknown)."""
        ...


def detect_sentence_lang(text: str, detector: Detector | None = None) -> str:
    """Classify a single sentence as ``"en"``, ``"es"``, or ``"un"``.

    Short／empty sentences fall back to heuristic rules so we don't
    waste a model call on noise.
    """
    cleaned = _clean(text)
    if not cleaned or len(cleaned) < 4:
        return "un"

    # Fast heuristic: known Spanish function words → skip the model
    if _looks_spanish(cleaned):
        return "es"
    if _looks_english(cleaned):
        return "en"

    if detector is None:
        detector = _get_default_detector()

    try:
        return detector.detect_lang(cleaned)
    except Exception:
        logger.exception("Language detection failed for %r, falling back to 'en'", text[:50])
        return "en"


def build_detector(backend: str | None = None) -> Detector:
    """Factory — return a Detector for the requested (or configured) backend."""
    backend = (backend or settings.detector_backend).strip().lower()

    if backend == "fasttext":
        return _FastTextDetector()
    if backend == "lingua":
        return _LinguaDetector()
    # default / langdetect
    return _LangDetectDetector()


# ── Sentence splitter ─────────────────────────────────────────────────────

_SENTENCE_PATTERN = re.compile(r"(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?|!|\n)\s+")


def split_sentences(text: str) -> list[str]:
    r"""Split *text* into sentences on ``.`` / ``!`` / ``?`` / newline.

    The regex avoids splitting on common abbreviations (e.g. "Mr.").
    """
    raw = _SENTENCE_PATTERN.split(text.strip())
    return [s.strip() for s in raw if s.strip()]


# ── Heuristics ────────────────────────────────────────────────────────────

_SPANISH_MARKERS: set[str] = {
    "el", "la", "los", "las", "un", "una", "unos", "unas",
    "y", "o", "pero", "sino", "porque", "que",
    "de", "del", "en", "con", "para", "por", "sin", "sobre", "entre",
    "es", "son", "está", "están", "estoy", "estamos", "soy", "eres",
    "tengo", "tiene", "tenemos", "tienen",
    "hace", "hago", "hacemos", "hacen",
    "puedo", "puede", "podemos", "pueden",
    "quiero", "quiere", "queremos", "quieren",
    "voy", "va", "vamos", "van", "fue", "fui", "iba",
    "he", "ha", "has", "han", "hemos",
    "me", "te", "se", "lo", "la", "le", "nos", "os",
    "mi", "tu", "su", "mis", "tus", "sus", "nuestro",
    "este", "esta", "esto", "ese", "esa", "eso", "aquel", "aquella",
    "muy", "más", "menos", "tan", "tanto",
    "no", "sí", "si", "también", "nunca", "siempre",
    "bien", "mal", "gracias", "hola", "adiós",
    "cuando", "donde", "como", "cuál", "cuáles",
    "todo", "toda", "todos", "todas", "cada", "algo", "nada",
    "quién", "quiénes", "qué",
    "ayer", "hoy", "mañana", "ahora", "ya", "todavía",
    "entonces", "luego", "después", "antes", "siempre",
    "mucho", "poca", "muchos", "pocos",
    "bueno", "buena", "malo", "mala", "grande", "pequeño",
    "señor", "señora", "señorita", "don", "doña",
}


def _looks_spanish(text: str) -> bool:
    """Quick check — does *text* contain known Spanish function words?"""
    lower = text.lower().split()
    return any(word in _SPANISH_MARKERS for word in lower)


def _looks_english(text: str) -> bool:
    """Quick check — does *text* appear unambiguously English?

    Currently a no-op placeholder for future heuristics (e.g. known
    English-only contractions or articles not shared with Spanish).
    """
    _ = text
    return False


def _clean(text: str) -> str:
    """Strip punctuation and normalise whitespace."""
    return re.sub(r"[^\w\s]", "", text).strip()


# ── Backend implementations ───────────────────────────────────────────────


class _LangDetectDetector:
    """Wrapper around the ``langdetect`` library (pure-Python, no model download)."""

    name = "langdetect"

    def __init__(self) -> None:
        from langdetect import DetectorFactory  # type: ignore[import-unused]
        DetectorFactory.seed = 0  # deterministic results

    def detect_lang(self, text: str) -> str:
        from langdetect import detect  # type: ignore[import-untyped]
        code = detect(text)[:2].lower()
        return code if code in ("en", "es") else "un"


class _FastTextDetector:
    """Wrapper around fasttext's quantised language-identification model.

    Expects the ``lid.176.ftz`` model at the path given by
    ``TT_FASTTEXT_MODEL`` or ``settings.fasttext_model``.
    """

    name = "fasttext"

    def __init__(self) -> None:
        import fasttext  # type: ignore[import-untyped]
        model_path = settings.fasttext_model or "models/lid.176.ftz"
        self._model = fasttext.load_model(model_path)

    def detect_lang(self, text: str) -> str:
        labels, scores = self._model.predict(text.replace("\n", " "))
        code = labels[0].replace("__label__", "")[:2].lower()
        return code if code in ("en", "es") else "un"


class _LinguaDetector:
    """Wrapper around the ``lingua`` library (most accurate, heaviest)."""

    name = "lingua"

    def __init__(self) -> None:
        from lingua import Language, LanguageDetectorBuilder  # type: ignore[import-untyped]
        self._builder = LanguageDetectorBuilder.from_languages(Language.ENGLISH, Language.SPANISH)
        self._detector = self._builder.build()

    def detect_lang(self, text: str) -> str:
        from lingua import Language  # type: ignore[import-untyped]
        result = self._detector.detect_language_of(text)
        if result == Language.ENGLISH:
            return "en"
        if result == Language.SPANISH:
            return "es"
        return "un"


# ── Default detector singleton ────────────────────────────────────────────

_default_detector: Detector | None = None


def _get_default_detector() -> Detector:
    global _default_detector
    if _default_detector is None:
        _default_detector = build_detector()
    return _default_detector
