import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TextInput } from "../components/TextInput";
import { Toggle } from "../components/Toggle";
import { VoiceSelector } from "../components/VoiceSelectors";
import { SpeedSlider } from "../components/SpeedSlider";
import { StatusBar } from "../components/StatusBar";
import { HistoryPanel, type HistoryEntry } from "../components/HistoryPanel";
import { useTTS, type UploadModelOptions } from "../hooks/useTTS";
import { useVoices, voiceDisplayName } from "../hooks/useVoices";

import { loadModel } from "../lib/modelStorage";
import type { AppStatus, VoiceInfo } from "../types";

// Default voice for language
function defaultVoiceForLang(
  byLanguage: Record<string, { id: string }[]>,
  lang: string,
): string | null {
  return byLanguage[lang]?.[0]?.id ?? null;
}

// Max history capacity
const MAX_HISTORY = 20;

export function GeneratorPage() {
  const [text, setText] = useState("");
  const [speed, setSpeed] = useState(0.85);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyPlayingId, setHistoryPlayingId] = useState<number | null>(null);
  const historyIdRef = useRef(0);
  // History blob URLs
  const historyUrlsRef = useRef<Set<string>>(new Set());

  const speedDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { byLanguage, loading, refetch } = useVoices();
  const { status, error, audioUrl, generate, play, stop } = useTTS();


  // Local voices
  const [importedVoiceIds, setImportedVoiceIds] = useState<Set<string>>(new Set());

  const refreshImported = useCallback(async () => {
    const { listInstalledIds } = await import("../lib/modelStorage");
    setImportedVoiceIds(await listInstalledIds());
  }, []);

  // Init local voices
  useEffect(() => {
    refreshImported();
  }, [refreshImported]);

  // Merge local voices
  const mergedByLanguage = useMemo(() => {
    if (importedVoiceIds.size === 0) return byLanguage;
    const merged: Record<string, VoiceInfo[]> = {};
    for (const [lang, voices] of Object.entries(byLanguage)) {
      merged[lang] = [...voices];
    }
    for (const voiceId of importedVoiceIds) {
      const lang = voiceId.split("_")[0];
      if (!merged[lang]) merged[lang] = [];
      // Only add if not already present (avoid duplicates)
      if (!merged[lang].some((v) => v.id === voiceId)) {
        merged[lang].push({
          id: voiceId,
          name: voiceDisplayName(voiceId),
          language: lang,
          region: voiceId.split("_")[1]?.split("-")[0] ?? "",
          quality: voiceId.split("-").pop() ?? "medium",
          engine: "piper",
          gender: "mixed",
          vibe: [],
          description: "User-imported voice",
          available: true,
        });
      }
    }
    return merged;
  }, [byLanguage, importedVoiceIds]);

  // Generate speech
  const generateWithVoice = useCallback(
    async (voiceId: string, text: string, lang: string, spd: number) => {
      let modelOpts: UploadModelOptions | undefined;
      if (importedVoiceIds.has(voiceId)) {
        const stored = await loadModel(voiceId);
        if (stored) {
          modelOpts = {
            voiceId: stored.voiceId,
            onnxBytes: stored.onnx,
            configBytes: stored.config,
          };
        }
      }
      generate(text, lang, voiceId, spd, modelOpts);
    },
    [importedVoiceIds, generate],
  );

  // Track status transitions
  const prevStatusRef = useRef<AppStatus>(status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (status === "ready" && audioUrl && prev === "generating") {
      if (autoPlay) {
        play();
      }

      // Clone blob for history
      fetch(audioUrl)
        .then((r) => r.blob())
        .then((blob) => {
          const historyUrl = URL.createObjectURL(blob);
          historyUrlsRef.current.add(historyUrl);

          // Get voice name
          let voiceName = voiceDisplayName(selectedVoice);
          for (const voices of Object.values(byLanguage)) {
            const found = voices.find((v) => v.id === selectedVoice);
            if (found?.name) {
              voiceName = found.name;
              break;
            }
          }

          const id = ++historyIdRef.current;
          const entry: HistoryEntry = {
            id,
            text,
            voiceName,
            voiceId: selectedVoice,
            speed,
            timestamp: new Date(),
            audioUrl: historyUrl,
          };

          setHistory((prev) => {
            const next = [entry, ...prev];
            // Evict old entries
            if (next.length > MAX_HISTORY) {
              const evicted = next.slice(MAX_HISTORY);
              for (const e of evicted) {
                historyUrlsRef.current.delete(e.audioUrl);
                URL.revokeObjectURL(e.audioUrl);
              }
              return next.slice(0, MAX_HISTORY);
            }
            return next;
          });
        });
    }
  }, [status, audioUrl, text, selectedVoice, speed, byLanguage, autoPlay, play]);

  // Set default voice
  const [initialized, setInitialized] = useState(false);
  const mergedAll = useMemo(
    () => Object.values(mergedByLanguage).flat(),
    [mergedByLanguage],
  );
  if (!initialized && !loading && mergedAll.length > 0 && !selectedVoice) {
    const def = defaultVoiceForLang(mergedByLanguage, "en") || mergedAll[0]?.id;
    if (def) {
      setSelectedVoice(def);
    }
    setInitialized(true);
  }

  // Clear debounces
  useEffect(() => {
    return () => {
      if (speedDebounceRef.current) clearTimeout(speedDebounceRef.current);
      if (textDebounceRef.current) clearTimeout(textDebounceRef.current);
    };
  }, []);

  // Revoke history URLs
  useEffect(() => {
    return () => {
      for (const url of historyUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      historyUrlsRef.current.clear();
    };
  }, []);

  // Get voice language
  const selectedLanguage = useMemo(() => {
    if (!selectedVoice) return "en";
    for (const [lang, voices] of Object.entries(mergedByLanguage)) {
      if (voices.some((v) => v.id === selectedVoice)) return lang;
    }
    return "en";
  }, [selectedVoice, mergedByLanguage]);

  const hasText = text.trim().length > 0;

  // Generate handler
  const handleGenerate = useCallback(() => {
    if (!hasText || !selectedVoice || status === "generating") return;
    generateWithVoice(selectedVoice, text, selectedLanguage, speed);
  }, [text, selectedLanguage, selectedVoice, speed, hasText, status, generateWithVoice]);

  // Text input handler
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      setText(newText);

      if (textDebounceRef.current) {
        clearTimeout(textDebounceRef.current);
      }

      if (autoGenerate && newText.trim().length > 0 && selectedVoice) {
        textDebounceRef.current = setTimeout(
          () => generateWithVoice(selectedVoice, newText, selectedLanguage, speed),
          5000,
        );
      }
    },
    [autoGenerate, selectedVoice, selectedLanguage, speed, generateWithVoice],
  );

  // Cancel debounce
  useEffect(() => {
    if (!autoGenerate && textDebounceRef.current) {
      clearTimeout(textDebounceRef.current);
      textDebounceRef.current = null;
    }
  }, [autoGenerate]);

  // Voice select handler
  const handleVoiceChange = useCallback(
    (voiceId: string) => {
      setSelectedVoice(voiceId);

      if (speedDebounceRef.current) {
        clearTimeout(speedDebounceRef.current);
        speedDebounceRef.current = null;
      }

      if (autoGenerate && hasText && text.trim().length > 0) {
        let lang = "en";
        for (const [l, voices] of Object.entries(mergedByLanguage)) {
          if (voices.some((v) => v.id === voiceId)) {
            lang = l;
            break;
          }
        }
        generateWithVoice(voiceId, text, lang, speed);
      }
    },
    [autoGenerate, hasText, text, speed, mergedByLanguage, generateWithVoice],
  );

  // Speed change handler
  const handleSpeedChange = useCallback(
    (newSpeed: number) => {
      setSpeed(newSpeed);

      if (autoGenerate && hasText && selectedVoice) {
        if (speedDebounceRef.current) {
          clearTimeout(speedDebounceRef.current);
        }
        speedDebounceRef.current = setTimeout(
          () => generateWithVoice(selectedVoice, text, selectedLanguage, newSpeed),
          300,
        );
      }
    },
    [autoGenerate, hasText, selectedVoice, text, selectedLanguage, generateWithVoice],
  );

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (hasText && selectedVoice && status !== "generating") {
          e.preventDefault();
          generateWithVoice(selectedVoice, text, selectedLanguage, speed);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasText, selectedVoice, selectedLanguage, speed, status, generateWithVoice]);

  const handleDownload = useCallback(() => {
    if (!audioUrl) return;

    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = "voicio-output.wav";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [audioUrl]);

  // History playback
  const handleHistoryPlay = useCallback(
    (entry: HistoryEntry) => {
      if (historyPlayingId === entry.id) return; // already playing

      setHistoryPlayingId(entry.id);

      const audio = new Audio(entry.audioUrl);
      audio.onended = () => setHistoryPlayingId(null);
      audio.onerror = () => setHistoryPlayingId(null);
      audio.play().catch(() => setHistoryPlayingId(null));
    },
    [historyPlayingId],
  );

  // History download
  const handleHistoryDownload = useCallback((entry: HistoryEntry) => {
    const a = document.createElement("a");
    a.href = entry.audioUrl;
    a.download = "voicio-output.wav";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  return (
    <main className="mx-auto mt-0 md:mt-6 max-w-5xl px-4 pb-16 sm:px-6 lg:px-8 overflow-x-hidden">
      {/* Main Layout */}
      <div id="generator" className="flex flex-col gap-4 xl:flex-row xl:items-stretch scroll-mt-8">
          {/* Generator */}
          <div
            className="animate-in flex flex-1 w-full flex-col border border-black/10 bg-white p-5 sm:p-7 dark:border-white/10 dark:bg-bento-bg-dark"
            style={{ "--delay": "100ms" } as React.CSSProperties}
          >
            <div className="flex flex-col gap-5">
              {/* Text input */}
              <TextInput
                value={text}
                onChange={handleTextChange}
                disabled={status === "generating"}
              />

              {/* Voice selector with engine filter tabs */}
              <VoiceSelector
                voicesByLanguage={mergedByLanguage}
                selectedVoice={selectedVoice}
                onChange={handleVoiceChange}
                disabled={status === "generating" || loading}
                onModelChanged={() => {
                  refetch();
                  refreshImported();
                }}
              />

              {/* Speed slider */}
              <SpeedSlider
                value={speed}
                onChange={handleSpeedChange}
                disabled={status === "generating"}
              />

              <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
                {/* Auto-generate toggle */}
                <div className="flex-1">
                  <Toggle
                    label="Auto-generate"
                    enabled={autoGenerate}
                    onChange={setAutoGenerate}
                    disabled={status === "generating"}
                  />
                </div>
                {/* Auto-play toggle */}
                <div className="flex-1">
                  <Toggle
                    label="Auto-play"
                    enabled={autoPlay}
                    onChange={setAutoPlay}
                    disabled={status === "generating"}
                  />
                </div>
              </div>
            </div>

            {/* Controls */}
            <div
              className="mt-6"
              style={{ "--delay": "200ms" } as React.CSSProperties}
            >
              <StatusBar
                status={status}
                error={error}
                hasText={hasText}
                onGenerate={handleGenerate}
                onPlay={play}
                onStop={stop}
                onDownload={handleDownload}
              />
            </div>
          </div>

          {/* History */}
          <div
            className="animate-in flex w-full flex-col xl:w-80 xl:min-w-80"
            style={{ "--delay": "150ms" } as React.CSSProperties}
          >
            <HistoryPanel
              entries={history}
              onPlay={handleHistoryPlay}
              onDownload={handleHistoryDownload}
              playingId={historyPlayingId}
            />
          </div>
        </div>

        {/* Footer */}
        <p
          className="animate-in mt-8 text-center font-sans text-[11px] text-black/60 dark:text-white/70"
          style={{ "--delay": "300ms" } as React.CSSProperties}
        >
          {hasText && selectedVoice
            ? autoGenerate
              ? "Auto-generate is on — speed and voice changes regenerate automatically."
              : "Auto-generate is off — toggle it on to regenerate on speed/voice changes."
            : "Select a voice and type text to generate speech."}
        </p>
      {/* Shortcut hint */}
      {hasText && selectedVoice && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 hidden items-center gap-1.5 sm:flex">
          <span className="font-sans text-[11px] text-black/50 dark:text-white/50">
            Generate
          </span>
          <kbd className="pointer-events-auto border border-black/10 bg-white/80 px-1.5 py-0.5 font-sans text-[10px] text-black/60 backdrop-blur-sm dark:border-white/10 dark:bg-black/80 dark:text-white/70">
            Ctrl
          </kbd>
          <span className="font-sans text-[10px] text-black/50 dark:text-white/50">+</span>
          <kbd className="pointer-events-auto border border-black/10 bg-white/80 px-1.5 py-0.5 font-sans text-[10px] text-black/60 backdrop-blur-sm dark:border-white/10 dark:bg-black/80 dark:text-white/70">
            ↵
          </kbd>
        </div>
      )}
    </main>
  );
}
