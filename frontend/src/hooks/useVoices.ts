import { useCallback, useEffect, useState } from "react";
import type { VoiceInfo } from "../types";

const API_BASE = "/api";

// State (data-only)
interface VoicesState {
  all: VoiceInfo[]; // Flat list of all voices
  byLanguage: Record<string, VoiceInfo[]>; // Voices grouped by language
  languages: string[]; // List of language codes
  loading: boolean;
}

// Hook return type
export interface GroupedVoices extends VoicesState {
  refetch: () => Promise<void>; // Re-fetch voices
}

// Get display name from voice ID (supports Piper and Edge formats)
export function voiceDisplayName(voiceId: string): string {
  // Edge TTS: e.g., en-US-JennyNeural
  if (/Neural$/.test(voiceId)) {
    const parts = voiceId.split("-");
    const name = parts[parts.length - 1];
    // Strip known suffixes
    for (const suffix of ["MultilingualNeural", "Neural"]) {
      if (name.endsWith(suffix)) {
        return name.slice(0, -suffix.length);
      }
    }
    return name; // Fallback
  }

  // Piper: lang_REGION-name-quality
  const parts = voiceId.split("-");
  if (parts.length < 3) return voiceId;

  // Extract name between locale and quality
  const nameParts = parts.slice(1, -1); // Drop locale & quality
  const name = nameParts
    .join(" ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return name;
}

export function useVoices() {
  const [state, setState] = useState<VoicesState>({
    all: [],
    byLanguage: {},
    languages: [],
    loading: true,
  });

  const fetchVoices = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`${API_BASE}/voices`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { languages: Record<string, VoiceInfo[]> } = await res.json();

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
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchVoices();
    return () => controller.abort();
  }, [fetchVoices]);

  return { ...state, refetch: fetchVoices } satisfies GroupedVoices;
}
