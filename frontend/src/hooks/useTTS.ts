import { useRef, useState, useCallback } from "react";
import type { AppStatus } from "../types";

const API_BASE = "/api";

export interface TTSState {
  status: AppStatus;
  error: string | null;
  audioUrl: string | null;
}

export function useTTS() {
  const [state, setState] = useState<TTSState>({
    status: "idle",
    error: null,
    audioUrl: null,
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  const generate = useCallback(
    async (text: string, voiceEng?: string | null, voiceTgl?: string | null, speed?: number) => {
      cleanup();
      setState({ status: "generating", error: null, audioUrl: null });

      try {
        const res = await fetch(`${API_BASE}/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            voice_eng: voiceEng ?? null,
            voice_tgl: voiceTgl ?? null,
            speed: speed ?? 1.0,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.detail ?? `Request failed (HTTP ${res.status})`);
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;

        setState({ status: "ready", error: null, audioUrl: url });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong";
        setState({ status: "error", error: message, audioUrl: null });
      }
    },
    [cleanup],
  );

  const play = useCallback(() => {
    if (!state.audioUrl) return;

    const audio = new Audio(state.audioUrl);
    audioRef.current = audio;

    audio.onended = () => {
      setState((prev) => ({ ...prev, status: "ready" }));
      audioRef.current = null;
    };
    audio.onerror = () => {
      setState({ status: "error", error: "Playback failed", audioUrl: null });
      audioRef.current = null;
    };

    audio.play().catch(() => {
      setState({ status: "error", error: "Playback was prevented", audioUrl: null });
    });
    setState((prev) => ({ ...prev, status: "playing" }));
  }, [state.audioUrl]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setState((prev) => ({ ...prev, status: "ready" }));
  }, []);

  return { ...state, generate, play, stop, cleanup };
}
