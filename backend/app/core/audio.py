"""Audio processing pipeline.

Sentence splitting, language detection, per-segment TTS synthesis,
and concatenation of audio chunks into a single WAV file.

English segments → Piper TTS
Tagalog segments → MMS-TTS (facebook/mms-tts-tgl)
"""

from __future__ import annotations

import io
import logging
from typing import NamedTuple

from app.core.detector import build_detector, split_sentences, detect_sentence_lang
from app.core.tts import synthesise_async

logger = logging.getLogger(__name__)


# ── Public API ────────────────────────────────────────────────────────────


class Segment(NamedTuple):
    """A contiguous block of same-language text ready for synthesis."""

    language: str  # "en" or "tl"
    text: str


async def synthesise_text(
    text: str,
    *,
    voice_en: str | None = None,
    speed: float = 1.0,
) -> bytes:
    """Full pipeline: detect → segment → synthesise → stitch.

    Parameters
    ----------
    text:
        User-supplied mixed-language input (max 5000 chars).
    voice_en:
        Override for the English Piper voice model.
    speed:
        Playback speed multiplier (0.5 – 2.0).

    Returns
    -------
    Complete WAV file as ``bytes``.
    """
    # 1. Sentence split
    sentences = split_sentences(text)
    if not sentences:
        raise ValueError("No text to synthesise.")

    logger.debug("Split into %d sentences", len(sentences))

    # 2. Language detection per sentence
    labelled = [_classify(s) for s in sentences]

    # 3. Merge consecutive same-language sentences
    segments = _merge(labelled)
    logger.debug("Merged into %d segments: %s", len(segments),
                 " | ".join(f"{s.language}:{len(s.text)}" for s in segments))

    # 4. Synthesise each segment (sequentially to manage memory)
    chunks: list[bytes] = []
    sample_rate: int | None = None

    for seg in segments:
        voice = voice_en if seg.language == "en" else None  # MMS ignores voice
        result = await synthesise_async(seg.text, voice=voice, language=seg.language, speed=speed)
        chunks.append(result.audio_bytes)
        if sample_rate is None:
            sample_rate = result.sample_rate

    sample_rate = sample_rate or 22050

    # 5. Stitch and wrap in WAV
    return _build_wav(chunks, sample_rate)


# ── Internal helpers ──────────────────────────────────────────────────────


def _classify(sentence: str) -> tuple[str, str]:
    """Return ``(language_code, sentence)``."""
    lang = detect_sentence_lang(sentence)
    if lang not in ("en", "tl"):
        lang = "en"  # fallback
    return lang, sentence


def _merge(labelled: list[tuple[str, str]]) -> list[Segment]:
    """Merge consecutive same-language sentences into segments."""
    if not labelled:
        return []

    segments: list[Segment] = []
    cur_lang, cur_texts = labelled[0][0], [labelled[0][1]]

    for lang, text in labelled[1:]:
        if lang == cur_lang:
            cur_texts.append(text)
        else:
            segments.append(Segment(cur_lang, " ".join(cur_texts)))
            cur_lang, cur_texts = lang, [text]

    segments.append(Segment(cur_lang, " ".join(cur_texts)))
    return segments


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
