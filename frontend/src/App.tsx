import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Moon, Sun, Volume2 } from "lucide-react";
import { TextInput } from "./components/TextInput";
import { Toggle } from "./components/Toggle";
import { VoiceSelector } from "./components/VoiceSelectors";
import { SpeedSlider } from "./components/SpeedSlider";
import { StatusBar } from "./components/StatusBar";
import { HistoryPanel, type HistoryEntry } from "./components/HistoryPanel";
import { useTTS, type UploadModelOptions } from "./hooks/useTTS";
import { useVoices, voiceDisplayName } from "./hooks/useVoices";
import { useTheme } from "./contexts/ThemeContext";
import { loadModel } from "./lib/modelStorage";
import type { AppStatus, VoiceInfo } from "./types";

/** Determine the voice ID for a language's first available voice */
function defaultVoiceForLang(
  byLanguage: Record<string, { id: string }[]>,
  lang: string,
): string | null {
  return byLanguage[lang]?.[0]?.id ?? null;
}

/** Max history entries before the oldest are evicted */
const MAX_HISTORY = 20;

export default function App() {
  const [text, setText] = useState("");
  const [speed, setSpeed] = useState(0.85);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [autoGenerate, setAutoGenerate] = useState(false);

  // ── History state ──
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyPlayingId, setHistoryPlayingId] = useState<number | null>(null);
  const historyIdRef = useRef(0);
  /** Tracks blob URLs created for history so we can revoke them on eviction */
  const historyUrlsRef = useRef<Set<string>>(new Set());

  const speedDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { byLanguage, loading, refetch } = useVoices();
  const { status, error, audioUrl, generate, play, stop } = useTTS();
  const { theme, toggleTheme } = useTheme();

  // ── Imported (browser-stored) voice tracking ──
  const [importedVoiceIds, setImportedVoiceIds] = useState<Set<string>>(new Set());

  const refreshImported = useCallback(async () => {
    const { listInstalledIds } = await import("./lib/modelStorage");
    setImportedVoiceIds(await listInstalledIds());
  }, []);

  // Load imported voice IDs on mount
  useEffect(() => {
    refreshImported();
  }, [refreshImported]);

  // Merge imported voices into byLanguage so they appear in the selector
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

  // ── Generate helper that handles imported vs bundled voices ──
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

  // Detect status transitions to "ready" to capture history entries
  const prevStatusRef = useRef<AppStatus>(status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (status === "ready" && audioUrl && prev === "generating") {
      // Clone the blob so this URL survives the next cleanup in useTTS
      fetch(audioUrl)
        .then((r) => r.blob())
        .then((blob) => {
          const historyUrl = URL.createObjectURL(blob);
          historyUrlsRef.current.add(historyUrl);

          // Resolve voice name
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
            // Evict oldest entries beyond MAX_HISTORY
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
  }, [status, audioUrl, text, selectedVoice, speed, byLanguage]);

  // ── Set default voice when voices load ──
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

  // Clean up speed debounce timer on unmount
  useEffect(() => {
    return () => {
      if (speedDebounceRef.current) clearTimeout(speedDebounceRef.current);
    };
  }, []);

  // Clean up all history blob URLs on unmount
  useEffect(() => {
    return () => {
      for (const url of historyUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      historyUrlsRef.current.clear();
    };
  }, []);

  // Infer language from the selected voice
  const selectedLanguage = useMemo(() => {
    if (!selectedVoice) return "en";
    for (const [lang, voices] of Object.entries(mergedByLanguage)) {
      if (voices.some((v) => v.id === selectedVoice)) return lang;
    }
    return "en";
  }, [selectedVoice, mergedByLanguage]);

  const hasText = text.trim().length > 0;

  // ── Manual generate handler ──
  const handleGenerate = useCallback(() => {
    if (!hasText || !selectedVoice || status === "generating") return;
    generateWithVoice(selectedVoice, text, selectedLanguage, speed);
  }, [text, selectedLanguage, selectedVoice, speed, hasText, status, generateWithVoice]);

  // ── Voice change handler (immediate auto-regeneration) ──
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

  // ── Speed change handler (debounced auto-regeneration) ──
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

  // ── Keyboard shortcut: Ctrl+Enter / Cmd+Enter ──
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

  // ── History playback (no-op if already playing) ──
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

  // ── History download ──
  const handleHistoryDownload = useCallback((entry: HistoryEntry) => {
    const a = document.createElement("a");
    a.href = entry.audioUrl;
    a.download = "voicio-output.wav";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  return (
    <div className="min-h-svh bg-white text-black transition-colors dark:bg-black dark:text-white">
      {/* ── Header ─────────────────────────────────────────── */}
      <header
        className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 lg:px-8"
        style={{ "--delay": "0ms" } as React.CSSProperties}
      >
        <div className="animate-in flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center bg-black dark:bg-white">
              <Volume2 className="h-5 w-5 text-white dark:text-black" />
            </div>
            <div>
              <h1 className="font-sans text-2xl font-bold tracking-tight">
                Voicio
              </h1>
              <p className="font-sans text-xs text-black/60 dark:text-white/70">
                Multi-language Text-to-Speech
              </p>
            </div>
          </div>

          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center border border-black/10 bg-white text-sm hover:bg-black/5 dark:border-white/10 dark:bg-transparent dark:text-white dark:hover:bg-white/10"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* ── Generator + History side by side ──────────────── */}
      <main className="mx-auto mt-6 max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
          {/* ── Generator card ────────────────────────────── */}
          <div
            className="animate-in flex flex-1 flex-col border border-black/10 bg-white p-5 sm:p-7 dark:border-white/10 dark:bg-bento-bg-dark"
            style={{ "--delay": "100ms" } as React.CSSProperties}
          >
            <div className="flex flex-col gap-5">
              {/* Text input */}
              <TextInput
                value={text}
                onChange={(e) => setText(e.target.value)}
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

              {/* Auto-generate toggle */}
              <Toggle
                label="Auto-generate"
                enabled={autoGenerate}
                onChange={setAutoGenerate}
                disabled={status === "generating"}
              />
            </div>

            {/* ── Status bar with integrated controls ── */}
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

          {/* ── History panel ─────────────────────────────── */}
          <div
            className="animate-in flex flex-col lg:w-80 lg:min-w-80"
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

        {/* ── Footer ────────────────────────────────────────── */}
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
      </main>

      {/* ── Fixed bottom-right shortcut ─────────────────── */}
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
    </div>
  );
}
