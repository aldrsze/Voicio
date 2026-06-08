import { useEffect, useState } from "react";
import type { VoiceInfo } from "../types";

const API_BASE = "/api";

export function useVoices() {
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchVoices = async () => {
      try {
        const res = await fetch(`${API_BASE}/voices`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: { voices: VoiceInfo[] } = await res.json();
        if (!cancelled) setVoices(data.voices);
      } catch (err) {
        console.warn("Failed to fetch voices:", err);
        // Don't block the UI — voices will show as empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchVoices();
    return () => { cancelled = true; };
  }, []);

  const englishVoices = voices.filter((v) => v.language === "en");
  const tagalogVoices = voices.filter((v) => v.language === "tl");

  return { voices, englishVoices, tagalogVoices, loading };
}
