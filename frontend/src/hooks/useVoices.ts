import { useEffect, useState } from "react";
import type { VoiceInfo } from "../types";

const API_BASE = "/api";

export interface GroupedVoices {
  /** All voices flattened into one array */
  all: VoiceInfo[];
  /** Voices grouped by language code */
  byLanguage: Record<string, VoiceInfo[]>;
  /** Language codes that have available voices */
  languages: string[];
  loading: boolean;
}

/**
 * Returns voice name portion from a voice ID.
 * e.g. "en_US-amy-medium" → "Amy"
 *      "en_GB-cori-high" → "Cori"
 */
export function voiceDisplayName(voiceId: string): string {
  // Strip language_region- prefix and -quality suffix
  // e.g. "en_US-amy-medium" → "amy" → "Amy"
  const parts = voiceId.split("-");
  if (parts.length < 3) return voiceId;

  // The voice name is everything between the first two parts (region) and the last (quality)
  // en_US-amy-medium → parts = ["en_US", "amy", "medium"] → name = "amy"
  // en_GB-northern_english_male-medium → parts = ["en_GB", "northern", "english", "male-medium"]... hmm
  // Actually: "en_GB-northern_english_male-medium" → split by "-" →
  // ["en_GB", "northern", "english", "male", "medium"]
  // The first part is lang_region, the last is quality, everything in between is the name.
  const nameParts = parts.slice(1, -1); // drop lang_region and quality
  const name = nameParts
    .join(" ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return name;
}

export function useVoices() {
  const [state, setState] = useState<GroupedVoices>({
    all: [],
    byLanguage: {},
    languages: [],
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    const fetchVoices = async () => {
      try {
        const res = await fetch(`${API_BASE}/voices`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: { languages: Record<string, VoiceInfo[]> } = await res.json();

        if (cancelled) return;

        const byLanguage: Record<string, VoiceInfo[]> = {};
        const all: VoiceInfo[] = [];

        for (const [lang, voices] of Object.entries(data.languages)) {
          const available = voices.filter((v) => v.available !== false);
          if (available.length > 0) {
            byLanguage[lang] = available.length > 0 ? available : voices;
            all.push(...available);
          }
        }

        setState({
          all,
          byLanguage,
          languages: Object.keys(byLanguage).sort(),
          loading: false,
        });
      } catch (err) {
        console.warn("Failed to fetch voices:", err);
        if (!cancelled) setState((prev) => ({ ...prev, loading: false }));
      }
    };

    fetchVoices();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
