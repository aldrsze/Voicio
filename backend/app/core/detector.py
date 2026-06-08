"""Language detection module.

Sentence-level classification of text as English (en) or Tagalog (tl).
Multiple backends are supported — swap via the ``TT_DETECTOR`` env-var.

Backends currently support ``en`` and ``tl``. Unknown languages fall back
to ``"en"``. Text that looks unambiguously Tagalog via the heuristic marker
check skips the model call entirely (fast path for short sentences).
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
        """Return ``"en"`` or ``"tl"`` (or ``"un"`` for unknown)."""
        ...


def detect_sentence_lang(text: str, detector: Detector | None = None) -> str:
    """Classify a single sentence as ``"en"``, ``"tl"``, or ``"un"``.

    Short / empty sentences fall back to heuristic rules so we don't
    waste a model call on noise.
    """
    cleaned = _clean(text)
    if not cleaned or len(cleaned) < 4:
        return "un"

    # Fast heuristic: known Tagalog function words → skip the model
    if _looks_tagalog(cleaned):
        return "tl"

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


# ── Tagalog heuristic markers ─────────────────────────────────────────────

# Distinctive Tagalog function words used as a fast pre-filter before the
# language-detection model. These are very common and unlikely to appear
# in English text.
_TAGALOG_MARKERS: set[str] = {
    # Core articles & markers (highly distinctive)
    "ang", "mga", "si", "sina", "ni", "nina",
    "ay",  # inversion marker
    # Personal / possessive pronouns
    "ako", "ikaw", "siya", "kami", "kayo", "sila",
    "ko", "mo", "niya", "namin", "ninyo", "nila",
    "akin", "iyo", "kaniya", "amin", "inyo",
    # Demonstratives (very distinctive)
    "ito", "iyan", "iyon", "dito", "diyan", "doon",
    "ganito", "ganiyan", "ganiyon",
    # Question words
    "ano", "sino", "saan", "ilan", "bakit", "paano", "kailan",
    "alin", "magkano",
    # Common particles
    "din", "rin", "daw", "raw", "pala", "yata", "sana", "kaya",
    "ba",  # question marker
    "po", "opo", "ho", "oho",  # politeness markers
    # Negation / modals
    "hindi", "wala", "ayaw", "huwag", "maaari", "pwede",
    "puede", "kailangan", "gusto", "sana",
    # Prepositions / connectors
    "kung", "kapag", "upang", "para", "dahil",
    # Existential / common
    "may", "mayroon", "meron",
    "lang", "lamang", "muna", "naman",
    # Common adjectives / adverbs used as function words
    "marami", "kaunti", "lahat", "iba", "ilang",
    # Common verb affix words (standalone)
    "nag", "mag", "naka", "maka",
}

# NOTE: The markers above are deliberately conservative — focused on words
# that are unambiguous markers of Tagalog. When in doubt, the model backend
# makes the final call. More markers (e.g. noun-verb pairs common in
# everyday speech) can be added later if the heuristic pre-filter misses
# too many short Tagalog sentences.

_TAGALOG_MARKERS_LOWER = {w.lower() for w in _TAGALOG_MARKERS}


def _looks_tagalog(text: str) -> bool:
    """Quick check — does *text* contain known Tagalog function words?"""
    lower = text.lower().split()
    return any(word in _TAGALOG_MARKERS_LOWER for word in lower)


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
        return code if code in ("en", "tl") else "un"


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
        return code if code in ("en", "tl") else "un"


class _LinguaDetector:
    """Wrapper around the ``lingua`` library (most accurate, heaviest)."""

    name = "lingua"

    def __init__(self) -> None:
        from lingua import Language, LanguageDetectorBuilder  # type: ignore[import-untyped]
        self._builder = LanguageDetectorBuilder.from_languages(Language.ENGLISH, Language.TAGALOG)
        self._detector = self._builder.build()

    def detect_lang(self, text: str) -> str:
        from lingua import Language  # type: ignore[import-untyped]
        result = self._detector.detect_language_of(text)
        if result == Language.ENGLISH:
            return "en"
        if result == Language.TAGALOG:
            return "tl"
        return "un"


# ── Default detector singleton ────────────────────────────────────────────

_default_detector: Detector | None = None


def _get_default_detector() -> Detector:
    global _default_detector
    if _default_detector is None:
        _default_detector = build_detector()
    return _default_detector
