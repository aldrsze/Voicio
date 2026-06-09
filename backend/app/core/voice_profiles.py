"""Voice profile metadata, model discovery, and categorization for Piper/MMS/Edge."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)

# ── Edge cache (populated async at startup) ──
_edge_voice_cache: list[dict] | None = None

# ── Voice metadata ──

VoiceProfile = dict[str, str | list[str]]

# Known names for gender inference of unknown models
_FEMALE_NAMES: set[str] = {
    "amy", "kristin", "kathleen", "lessac", "ljspeech",
    "alba", "cori", "jenny_dioco", "southern_english_female", "hfc_female",
    "priyamvada", "daniela", "xiao_ya", "huayan",
}

_MALE_NAMES: set[str] = {
    "bryce", "danny", "joe", "john", "norman", "ryan",
    "kusal", "hfc_male", "alan", "northern_english_male",
    "cadu", "faber", "jeff", "tugão", "edresson",
    "pratham", "rohan", "ald", "davefx", "carlfm",
    "chaowen", "sharvard", "reza_ibrahim", "arctic",
    "l2arctic", "libritts", "libritts_r", "semaine", "vctk", "aru", "mls_10246", "mls_9972",
}

# Known non-binary
_NON_BINARY_NAMES: set[str] = {"sam"}

# ── Curated voice profiles (override auto-inference) ──

VOICE_METADATA: dict[str, VoiceProfile] = {
    # ── English US ──
    "en_US-lessac-high": {
        "gender": "female",
        "vibe": ["warm", "feminine", "clear"],
        "description": "Warm, clear female voice — the classic high-quality US English voice",
    },
    "en_US-lessac-medium": {
        "gender": "female",
        "vibe": ["warm", "feminine", "smooth"],
        "description": "Smooth female voice, slightly lower bitrate than high",
    },
    "en_US-lessac-low": {
        "gender": "female",
        "vibe": ["soft", "feminine"],
        "description": "Soft female voice at low bitrate for faster generation",
    },
    "en_US-amy-high": {
        "gender": "female",
        "vibe": ["bright", "feminine", "cheerful"],
        "description": "Bright, cheerful female voice",
    },
    "en_US-amy-medium": {
        "gender": "female",
        "vibe": ["bright", "feminine", "cheerful"],
        "description": "Bright, cheerful female voice",
    },
    "en_US-amy-low": {
        "gender": "female",
        "vibe": ["bright", "feminine"],
        "description": "Bright female voice at low bitrate",
    },
    "en_US-kristin-medium": {
        "gender": "female",
        "vibe": ["gentle", "feminine", "natural"],
        "description": "Gentle, natural female voice from LibriVox recordings",
    },
    "en_US-kathleen-low": {
        "gender": "female",
        "vibe": ["soft", "feminine", "calm"],
        "description": "Soft, calm female voice at low bitrate",
    },
    "en_US-hfc_female-medium": {
        "gender": "female",
        "vibe": ["crisp", "feminine", "clear"],
        "description": "Crisp, clear female voice from Hi-Fi Captain dataset",
    },
    "en_US-ljspeech-high": {
        "gender": "female",
        "vibe": ["neutral", "feminine", "crisp"],
        "description": "Crisp, neutral female voice — the benchmark US English TTS voice",
    },
    "en_US-ljspeech-medium": {
        "gender": "female",
        "vibe": ["neutral", "feminine"],
        "description": "Neutral female voice from the LJ Speech dataset",
    },
    "en_US-bryce-medium": {
        "gender": "male",
        "vibe": ["deep", "masculine", "authentic"],
        "description": "Deep, authentic male voice — the voice of Bryce himself",
    },
    "en_US-danny-low": {
        "gender": "male",
        "vibe": ["casual", "masculine"],
        "description": "Casual male voice at low bitrate",
    },
    "en_US-joe-medium": {
        "gender": "male",
        "vibe": ["warm", "masculine", "friendly"],
        "description": "Warm, friendly male voice",
    },
    "en_US-john-medium": {
        "gender": "male",
        "vibe": ["natural", "masculine", "balanced"],
        "description": "Balanced, natural male voice from LibriVox recordings",
    },
    "en_US-norman-medium": {
        "gender": "male",
        "vibe": ["rich", "masculine", "deep"],
        "description": "Rich, deep male voice trained on 15.5 hours of LibriVox audio",
    },
    "en_US-ryan-high": {
        "gender": "male",
        "vibe": ["smooth", "masculine", "deep"],
        "description": "Smooth, deep male voice — high-quality RyanSpeech model",
    },
    "en_US-ryan-medium": {
        "gender": "male",
        "vibe": ["smooth", "masculine", "balanced"],
        "description": "Balanced, smooth male voice",
    },
    "en_US-ryan-low": {
        "gender": "male",
        "vibe": ["deep", "masculine"],
        "description": "Deep male voice at low bitrate for faster generation",
    },
    "en_US-hfc_male-medium": {
        "gender": "male",
        "vibe": ["crisp", "masculine", "clear"],
        "description": "Crisp, clear male voice from Hi-Fi Captain dataset",
    },
    "en_US-kusal-medium": {
        "gender": "male",
        "vibe": ["warm", "masculine", "calm"],
        "description": "Warm, calm male voice",
    },
    "en_US-sam-medium": {
        "gender": "non-binary",
        "vibe": ["neutral", "clear", "modern"],
        "description": "Clear, neutral non-binary voice — modern and inclusive",
    },
    "en_US-reza_ibrahim-medium": {
        "gender": "male",
        "vibe": ["calm", "masculine", "bilingual"],
        "description": "Calm male voice, bilingual Persian / US English",
    },
    "en_US-arctic-medium": {
        "gender": "mixed",
        "vibe": ["varied", "multi-speaker"],
        "description": "Multi-speaker (18 voices) from CMU ARCTIC — several male and female speakers",
    },
    "en_US-l2arctic-medium": {
        "gender": "mixed",
        "vibe": ["varied", "accented", "multi-speaker"],
        "description": "Multi-speaker (24 voices) representing L2 English learners with diverse accents",
    },
    "en_US-libritts-high": {
        "gender": "mixed",
        "vibe": ["expressive", "varied", "multi-speaker"],
        "description": "Expressive multi-speaker (904 voices) — high-quality LibriTTS model",
    },
    "en_US-libritts_r-medium": {
        "gender": "mixed",
        "vibe": ["natural", "varied", "multi-speaker"],
        "description": "Natural multi-speaker (904 voices) re-encoded LibriTTS corpus",
    },

    # ── English British ──
    "en_GB-alan-medium": {
        "gender": "male",
        "vibe": ["calm", "british", "masculine"],
        "description": "Calm British male voice",
    },
    "en_GB-alan-low": {
        "gender": "male",
        "vibe": ["calm", "british", "masculine"],
        "description": "Calm British male voice at low bitrate",
    },
    "en_GB-alba-medium": {
        "gender": "female",
        "vibe": ["warm", "british", "feminine"],
        "description": "Warm British female voice from the Edinburgh dataset",
    },
    "en_GB-aru-medium": {
        "gender": "mixed",
        "vibe": ["liverpool", "multi-speaker", "regional"],
        "description": "Multi-speaker (12 voices) from Liverpool — a range of regional British accents",
    },
    "en_GB-cori-high": {
        "gender": "female",
        "vibe": ["expressive", "british", "feminine"],
        "description": "Expressive British female voice — high quality, 24 hours of LibriVox recordings",
    },
    "en_GB-cori-medium": {
        "gender": "female",
        "vibe": ["bright", "british", "feminine"],
        "description": "Bright British female voice from 24 hours of LibriVox recordings",
    },
    "en_GB-jenny_dioco-medium": {
        "gender": "female",
        "vibe": ["natural", "british", "feminine"],
        "description": "Natural British female voice from the Dioco Group dataset",
    },
    "en_GB-northern_english_male-medium": {
        "gender": "male",
        "vibe": ["northern", "british", "masculine"],
        "description": "Northern English male voice with distinct regional character",
    },
    "en_GB-semaine-medium": {
        "gender": "mixed",
        "vibe": ["varied", "multi-speaker", "expressive"],
        "description": "Multi-speaker (4 voices) from DFKI SEMAINE — varied expressive styles",
    },
    "en_GB-southern_english_female-low": {
        "gender": "female",
        "vibe": ["soft", "british", "feminine"],
        "description": "Soft Southern English female voice at low bitrate",
    },
    "en_GB-vctk-medium": {
        "gender": "mixed",
        "vibe": ["varied", "multi-speaker", "comprehensive"],
        "description": "Multi-speaker (109 voices) from the VCTK Edinburgh corpus — wide variety of accents",
    },

    # ── Spanish ──
    "es_AR-daniela-high": {
        "gender": "female",
        "vibe": ["warm", "feminine", "argentinian"],
        "description": "Warm Argentine female voice — high quality model",
    },
    "es_ES-carlfm-x_low": {
        "gender": "male",
        "vibe": ["masculine"],
        "description": "Spanish male voice at very low bitrate",
    },
    "es_ES-davefx-medium": {
        "gender": "male",
        "vibe": ["clear", "masculine", "spanish"],
        "description": "Clear Spanish male voice",
    },
    "es_ES-mls_10246-low": {
        "gender": "male",
        "vibe": ["masculine"],
        "description": "Spanish male voice at low bitrate (MLS corpus)",
    },
    "es_ES-mls_9972-low": {
        "gender": "male",
        "vibe": ["masculine"],
        "description": "Spanish male voice at low bitrate (MLS corpus)",
    },
    "es_ES-sharvard-medium": {
        "gender": "mixed",
        "vibe": ["neutral", "clinical"],
        "description": "Neutral multi-speaker (2) Spanish voice from hearing-test corpus",
    },
    "es_MX-ald-medium": {
        "gender": "male",
        "vibe": ["warm", "masculine", "mexican"],
        "description": "Warm Mexican Spanish male voice",
    },
    "es_MX-claude-high": {
        "gender": "male",
        "vibe": ["smooth", "masculine", "mexican"],
        "description": "Smooth Mexican Spanish male voice — high quality",
    },

    # ── Hindi ──
    "hi_IN-pratham-medium": {
        "gender": "male",
        "vibe": ["warm", "masculine", "hindi"],
        "description": "Warm Hindi male voice from the Indic NLP corpus",
    },
    "hi_IN-priyamvada-medium": {
        "gender": "female",
        "vibe": ["gentle", "feminine", "hindi"],
        "description": "Gentle Hindi female voice from the Indic NLP corpus",
    },
    "hi_IN-rohan-medium": {
        "gender": "male",
        "vibe": ["deep", "masculine", "hindi"],
        "description": "Deep Hindi male voice from IIT Madras IndicTTS",
    },

    # ── Portuguese ──
    "pt_BR-cadu-medium": {
        "gender": "male",
        "vibe": ["warm", "masculine", "brazilian"],
        "description": "Warm Brazilian Portuguese male voice",
    },
    "pt_BR-edresson-low": {
        "gender": "male",
        "vibe": ["masculine"],
        "description": "Brazilian Portuguese male voice at low bitrate",
    },
    "pt_BR-faber-medium": {
        "gender": "male",
        "vibe": ["clear", "masculine", "brazilian"],
        "description": "Clear Brazilian Portuguese male voice",
    },
    "pt_BR-jeff-medium": {
        "gender": "male",
        "vibe": ["bright", "masculine", "brazilian"],
        "description": "Bright Brazilian Portuguese male voice",
    },
    "pt_PT-tugão-medium": {
        "gender": "male",
        "vibe": ["warm", "masculine", "portuguese"],
        "description": "Warm European Portuguese male voice",
    },

    # ── Chinese ──
    "zh_CN-chaowen-medium": {
        "gender": "male",
        "vibe": ["calm", "masculine", "mandarin"],
        "description": "Calm Mandarin Chinese male voice",
    },
    "zh_CN-huayan-medium": {
        "gender": "female",
        "vibe": ["natural", "feminine", "mandarin"],
        "description": "Natural Mandarin Chinese female voice",
    },
    "zh_CN-huayan-x_low": {
        "gender": "female",
        "vibe": ["feminine"],
        "description": "Mandarin Chinese female voice at very low bitrate",
    },
    "zh_CN-xiao_ya-medium": {
        "gender": "female",
        "vibe": ["bright", "feminine", "mandarin"],
        "description": "Bright Mandarin Chinese female voice (Xiǎo Yǎ)",
    },
}

# ── Archive models (legacy reference) ──

ARCHIVE_METADATA: dict[str, VoiceProfile] = {
    "en_US-lessac-high": VOICE_METADATA["en_US-lessac-high"],
    "en_US-lessac-medium": VOICE_METADATA["en_US-lessac-medium"],
    "es_ES-sharvard-medium": VOICE_METADATA["es_ES-sharvard-medium"],
}


def _infer_gender(voice_name: str) -> str:
    """Infer gender from voice name; fall back to ``"mixed"``."""
    # Name is the segment between region and quality: "en_US-lessac-high" → "lessac"
    parts = voice_name.split("-")
    if parts and parts[0] in _MALE_NAMES:
        return "male"
    if parts and parts[0] in _FEMALE_NAMES:
        return "female"

    # Broader substring match
    for name in _FEMALE_NAMES:
        if name.replace("_", "-") in voice_name or name in voice_name:
            return "female"
    for name in _MALE_NAMES:
        if name.replace("_", "-") in voice_name or name in voice_name:
            return "male"
    for name in _NON_BINARY_NAMES:
        if name in voice_name:
            return "non-binary"

    return "mixed"


def _infer_vibe(gender: str, quality: str, voice_name: str) -> list[str]:
    """Generate default vibe tags for voices w/o curated metadata."""
    tags: list[str] = []

    if gender == "female":
        tags.append("feminine")
    elif gender == "male":
        tags.append("masculine")
    elif gender == "non-binary":
        tags.append("neutral")
    else:
        tags.append("varied")

    if quality in ("high",):
        tags.append("premium")
    elif quality in ("medium",):
        tags.append("balanced")
    elif quality in ("low", "x_low"):
        tags.append("lightweight")

    return tags


def _parse_quality(voice_id: str) -> str:
    """Extract quality tier: ``"en_US-lessac-high"`` → ``"high"``."""
    parts = voice_id.rsplit("-", 1)
    return parts[-1] if len(parts) > 1 else "medium"


def _parse_language_code(voice_id: str) -> str:
    """Extract ISO 639-1 code: ``"en_US-lessac-high"`` → ``"en"``."""
    return voice_id.split("_")[0]


def _parse_voice_name(voice_id: str) -> str:
    """Extract readable name from voice ID (e.g. ``"en_US-lessac-high"`` → ``"Lessac"``)."""
    parts = voice_id.rsplit("-", 1)  # strip quality suffix
    if "/" in parts[0]:
        return parts[0].split("/")[-1]
    # Format: lang_REGION-name-quality → parts[0]="en_US-lessac"
    segments = parts[0].split("-", 1)
    if len(segments) < 2:
        return parts[0]
    name_raw = segments[1]
    return (
        name_raw.replace("_", " ")
        .replace("/", " ")
        .title()
        .strip()
    )


def _parse_region(voice_id: str) -> str:
    """Extract region: ``"en_US-lessac-high"`` → ``"US"``."""
    parts = voice_id.split("_", 1)
    return parts[1].split("-")[0] if len(parts) > 1 else ""


def get_voice_profile(voice_id: str) -> VoiceProfile:
    """Return profile for a voice, inferring where no metadata exists."""
    if voice_id in VOICE_METADATA:
        return VOICE_METADATA[voice_id]

    # Infer from voice name (strip quality suffix)
    name_part = voice_id.rsplit("-", 1)[0]
    quality = _parse_quality(voice_id)
    gender = _infer_gender(name_part)
    vibe = _infer_vibe(gender, quality, voice_id)
    return {
        "gender": gender,
        "vibe": vibe,
        "description": f"{gender.replace('_', ' ').title()} voice ({quality} quality)"
        if gender != "mixed"
        else f"Multi-speaker model ({quality} quality)",
    }


def get_language_label(lang_code: str) -> str:
    """Friendly label for a language code."""
    labels = {
        "en": "English",
        "es": "Spanish",
        "fr": "French",
        "de": "German",
        "it": "Italian",
        "pt": "Portuguese",
        "nl": "Dutch",
        "pl": "Polish",
        "ru": "Russian",
        "hi": "Hindi",
        "zh": "Chinese",
        "tl": "Tagalog",
    }
    return labels.get(lang_code, lang_code.upper())


# ── Model discovery ──


@dataclass
class DiscoveredVoice:
    """Represents a single discovered voice model with its metadata."""

    voice_id: str
    language: str
    region: str
    quality: str
    gender: str
    vibe: list[str]
    description: str
    model_path: Path | None
    config_path: Path | None


def discover_models() -> list[DiscoveredVoice]:
    """Piper model discovery disabled — models come from browser IndexedDB."""
    return []


def get_voices_by_language() -> dict[str, list[dict]]:
    """Group voices by lang code, including MMS and Edge voices."""
    voices = discover_models()
    grouped: dict[str, list[dict]] = {}

    for v in voices:
        lang = v.language
        if lang not in grouped:
            grouped[lang] = []
        grouped[lang].append(
            {
                "id": v.voice_id,
                "name": _parse_voice_name(v.voice_id),
                "language": v.language,
                "region": v.region,
                "quality": v.quality,
                "gender": v.gender,
                "vibe": v.vibe,
                "description": v.description,
                "engine": "piper",
                "available": v.model_path is not None and v.config_path is not None,
            }
        )

    # ── Tagalog (MMS) ──
    mms_available = _check_mms_importable()
    if "tl" not in grouped:
        grouped["tl"] = []
    grouped["tl"].append(
        {
            "id": "facebook/mms-tts-tgl",
            "name": "Tagalog (MMS)",
            "language": "tl",
            "region": "PH",
            "quality": "medium",
            "engine": "mms",
            "gender": "mixed",
            "vibe": ["natural"],
            "description": "Neural Tagalog voice via Facebook MMS-TTS",
            "available": mms_available,
        }
    )

    # ── Edge TTS ──
    for ev in _fetch_edge_voices():
        lang = ev["language"]
        if lang not in grouped:
            grouped[lang] = []
        grouped[lang].append(ev)

    return grouped


def _check_mms_importable() -> bool:
    """Check if torch + transformers are importable (no model loading)."""
    try:
        import torch  # noqa: F401
        import transformers  # noqa: F401
        return True
    except ImportError:
        return False


def _check_edge_importable() -> bool:
    """Check if edge-tts is importable."""
    try:
        import edge_tts  # noqa: F401
        return True
    except ImportError:
        return False


# ── Locale mapping (Edge uses 3-letter codes) ──
_LOCALE_TO_LANG: dict[str, str] = {
    "fil": "tl",  # Filipino → Tagalog
}


def _locale_to_lang(locale: str) -> str:
    """Map Microsoft locale to internal code: ``"fil-PH"`` → ``"tl"``."""
    lang_part = locale.split("-")[0].lower()
    return _LOCALE_TO_LANG.get(lang_part, lang_part)


def _parse_edge_voice_name(short_name: str) -> str:
    """Extract clean name from edge-tts ShortName: ``"fil-PH-AngeloNeural"`` → ``"Angelo"``."""
    # ShortName format: {locale}-{Name}[Multilingual]Neural
    name_part = short_name.rsplit("-", 1)[-1]
    # Strip suffix in order of specificity
    for suffix in ("MultilingualNeural", "Neural"):
        if name_part.endswith(suffix):
            name_part = name_part[: -len(suffix)]
            break
    return name_part


def _fetch_edge_voices() -> list[dict]:
    """Return Edge voices from cache (populated at startup by ``prewarm_edge_voices``)."""
    global _edge_voice_cache
    if _edge_voice_cache is not None:
        return _edge_voice_cache

    # Cache not populated — sync fallback (e.g. in tests). Uses separate
    # thread to avoid nested-loop errors.
    if _check_edge_importable():
        try:
            import edge_tts

            raw = _run_async(edge_tts.list_voices)
            _edge_voice_cache = _build_edge_voice_list(raw)
            return _edge_voice_cache
        except Exception:
            logger.warning("Failed to fetch edge-tts voices synchronously — they'll be available on the next call.")
            _edge_voice_cache = []

    return []


def _run_async(coro_factory, *args):
    """Run an async coroutine from sync context, handling loop nesting."""
    try:
        return asyncio.run(coro_factory(*args))
    except RuntimeError:
        # Already in an event loop → run in a new thread
        import concurrent.futures

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(asyncio.run, coro_factory(*args))
            return future.result()


async def prewarm_edge_voices() -> None:
    """Pre-fetch Edge voice list at startup so first API call is fast."""
    global _edge_voice_cache
    try:
        import edge_tts

        raw = await edge_tts.list_voices()
        _edge_voice_cache = _build_edge_voice_list(raw)
        logger.info(
            "Edge TTS voices pre-warmed: %d voices across %d languages",
            len(_edge_voice_cache),
            len({v["language"] for v in _edge_voice_cache}),
        )
    except ImportError:
        logger.info("edge-tts not installed — Edge voices unavailable.")
        _edge_voice_cache = []
    except Exception:
        logger.warning("Failed to pre-warm edge-tts voice cache.", exc_info=True)
        _edge_voice_cache = []


def _build_edge_voice_list(raw_voices: list[dict]) -> list[dict]:
    """Convert edge-tts API response to our voice-info format."""
    result: list[dict] = []
    for v in raw_voices:
        voice_id = v.get("ShortName") or v.get("Name", "")
        if not voice_id:
            continue

        locale = v.get("Locale", "")
        gender_raw = v.get("Gender", "").lower()
        personalities = v.get("VoiceTag", {}).get("VoicePersonalities", [])

        lang_code = _locale_to_lang(locale)
        region = locale.split("-")[1].upper() if "-" in locale else ""

        gender = "female" if "female" in gender_raw else "male" if "male" in gender_raw else "mixed"

        # Personality tags as vibe; fall back to "natural"
        vibe = list(personalities) if personalities else ["natural"]

        display_name = _parse_edge_voice_name(voice_id)

        result.append({
            "id": voice_id,
            "name": display_name,
            "language": lang_code,
            "region": region,
            "quality": "high",
            "engine": "edge",
            "gender": gender,
            "vibe": vibe,
            "description": (
                f"{gender.title()} neural voice via Microsoft Edge TTS — "
                f"fast, no model downloads needed"
            ),
            "available": True,  # edge-tts is importable → ready to use
        })
    return result


def resolve_voice_engine(voice_id: str) -> str | None:
    """Return engine type (``"piper"``/``"mms"``/``"edge"``) for a voice ID, or None."""
    voices = get_voices_by_language()
    for lang_voices in voices.values():
        for v in lang_voices:
            if v["id"] == voice_id:
                return v.get("engine", "piper")
    return None


# ═══════════════════════════════════════
#  Model Catalog & Lifecycle
# ═══════════════════════════════════════

# Rough size estimates by quality tier (MB for .onnx + .json combined)
_QUALITY_SIZE_MB: dict[str, float] = {
    "x_low": 5,
    "low": 15,
    "medium": 50,
    "high": 200,
}

# Voices excluded from public catalog (archive / test-only / non-standard)
_CATALOG_EXCLUDE: set[str] = {
    # Archived (unmaintained / experimental)
    "en_US-l2arctic-medium",
    "en_US-reza_ibrahim-medium",
    "en_US-kristin-medium",
    "en_US-kathleen-low",
    "en_US-bryce-medium",
    "en_US-danny-low",
    "en_US-joe-medium",
    "en_US-john-medium",
    "en_US-norman-medium",
    "en_US-sam-medium",
    "en_US-kusal-medium",
    "en_US-ryan-high",
    "en_US-ryan-medium",
    "en_US-ryan-low",
    "en_GB-alan-medium",
    "en_GB-alan-low",
    "en_GB-aru-medium",
    "en_GB-semaine-medium",
    "en_GB-southern_english_female-low",
    "en_GB-vctk-medium",
    "en_GB-jenny_dioco-medium",
    # Non-existent on Hugging Face (only medium + low tiers exist for Amy)
    "en_US-amy-high",
}


def _hf_lang_dir(voice_id: str) -> str:
    """HF subdirectory: ``en_US-*`` → ``en``,  ``en_GB-*`` → ``en_GB``, others use ISO code."""
    prefix = voice_id.split("-")[0]  # e.g. "en_US", "en_GB", "es_ES"
    if prefix == "en_GB":
        return "en_GB"
    return prefix.split("_")[0]


def _hf_voice_name(voice_id: str) -> str:
    """Voice name portion used as HF subdirectory: ``en_US-amy-medium`` → ``"amy"``."""
    # Strip quality suffix, then language-region prefix
    without_quality = voice_id.rsplit("-", 1)[0]
    segments = without_quality.split("-", 1)
    return segments[1] if len(segments) > 1 else segments[0]


def _hf_download_url(voice_id: str, filename: str) -> str:
    """Full HF raw URL: ``{lang}/{lang_REGION}/{name}/{quality}/{file}``."""
    lang_dir = _hf_lang_dir(voice_id)
    lang_region = voice_id.split("-")[0]
    name = _hf_voice_name(voice_id)
    quality = _parse_quality(voice_id)
    return (
        f"https://huggingface.co/rhasspy/piper-voices/resolve/main/"
        f"{lang_dir}/{lang_region}/{name}/{quality}/{filename}"
    )


def _installed_voice_ids() -> set[str]:
    """Return set of voice IDs with ``.onnx`` files on disk."""
    model_dir = settings.models_dir
    if not model_dir.is_dir():
        return set()
    return {f.stem for f in model_dir.rglob("*.onnx")}


def get_model_catalog() -> list[dict]:
    """Full catalog of downloadable Piper voices (``installed`` always False — frontend tracks IndexedDB)."""
    catalog: list[dict] = []

    for voice_id, profile in VOICE_METADATA.items():
        if voice_id in _CATALOG_EXCLUDE:
            continue

        quality = _parse_quality(voice_id)
        catalog.append({
            "id": voice_id,
            "name": _parse_voice_name(voice_id),
            "language": _parse_language_code(voice_id),
            "region": _parse_region(voice_id),
            "quality": quality,
            "gender": profile.get("gender", "mixed"),
            "vibe": profile.get("vibe", []),
            "description": profile.get("description", ""),
            "size_mb": _QUALITY_SIZE_MB.get(quality, 50),
            "installed": False,
        })

    return catalog


def download_piper_model(voice_id: str) -> None:
    """Download ``.onnx`` + ``.onnx.json`` from Hugging Face."""
    import urllib.error
    import urllib.request

    if voice_id not in VOICE_METADATA or voice_id in _CATALOG_EXCLUDE:
        raise ValueError(f"Unknown voice: {voice_id!r}. Check GET /api/models/catalog.")

    model_dir = settings.models_dir
    model_dir.mkdir(parents=True, exist_ok=True)

    files = [f"{voice_id}.onnx", f"{voice_id}.onnx.json"]

    for filename in files:
        url = _hf_download_url(voice_id, filename)
        dest = model_dir / filename
        logger.info("Downloading %s → %s", url, dest)

        try:
            urllib.request.urlretrieve(url, dest)
        except urllib.error.HTTPError as exc:
            # Clean up partial download
            if dest.exists():
                dest.unlink()
            if exc.code == 404:
                raise RuntimeError(
                    f"Model file {filename!r} was not found on Hugging Face "
                    f"(HTTP 404). This quality tier may not exist for "
                    f"{voice_id!r}. Try a different quality (medium/low)."
                ) from exc
            raise RuntimeError(
                f"HTTP {exc.code} downloading {filename!r} for "
                f"{voice_id!r}: {exc}"
            ) from exc
        except Exception as exc:
            # Clean up partial download
            if dest.exists():
                dest.unlink()
            raise RuntimeError(
                f"Failed to download {filename!r} for {voice_id!r}: {exc}"
            ) from exc

    logger.info("Voice model %r installed successfully.", voice_id)


def remove_piper_model(voice_id: str) -> None:
    """Delete ``.onnx`` + ``.onnx.json`` from disk."""
    model_dir = settings.models_dir
    removed = False

    for ext in (".onnx", ".onnx.json"):
        # Search recursively — models may be in subdirectories
        for f in model_dir.rglob(f"{voice_id}{ext}"):
            f.unlink()
            removed = True
            logger.info("Removed model file: %s", f)

    if not removed:
        raise ValueError(f"Voice {voice_id!r} is not installed.")

    logger.info("Voice model %r removed successfully.", voice_id)


def import_piper_model(voice_id: str, onnx_bytes: bytes, json_bytes: bytes) -> None:
    """Write model files from raw bytes to the models directory."""
    model_dir = settings.models_dir
    model_dir.mkdir(parents=True, exist_ok=True)

    onnx_dest = model_dir / f"{voice_id}.onnx"
    json_dest = model_dir / f"{voice_id}.onnx.json"

    if onnx_dest.exists():
        raise ValueError(
            f"Model {voice_id!r} already exists at {onnx_dest}. "
            f"Remove it first or use a different voice ID."
        )

    onnx_dest.write_bytes(onnx_bytes)
    json_dest.write_bytes(json_bytes)

    logger.info(
        "Voice model %r imported successfully (%d + %d bytes).",
        voice_id, len(onnx_bytes), len(json_bytes),
    )
