import { useRef, useState, useCallback, useEffect } from "react";
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
  const abortRef = useRef<AbortController | null>(null);

  const cleanup = useCallback(() => {
    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    // Revoke the old blob URL
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    // Destroy any existing audio element
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  // Clean up on unmount
  useEffect(() => cleanup, [cleanup]);

  const generate = useCallback(
    async (
      text: string,
      language?: string,
      voice?: string,
      speed?: number,
    ) => {
      cleanup();
      setState({ status: "generating", error: null, audioUrl: null });

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const body: Record<string, unknown> = {
          text,
          language: language ?? "en",
          speed: speed ?? 0.85,
        };

        if (voice) {
          body.voice = voice;
        }

        const res = await fetch(`${API_BASE}/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
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
        if (err instanceof DOMException && err.name === "AbortError") {
          return; // Silently ignore aborted requests
        }
        const message = err instanceof Error ? err.message : "Something went wrong";
        setState({ status: "error", error: message, audioUrl: null });
      } finally {
        abortRef.current = null;
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
