import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Moon, Sun, Volume2 } from "lucide-react";
import { TextInput } from "./components/TextInput";
import { VoiceSelector } from "./components/VoiceSelectors";
import { SpeedSlider } from "./components/SpeedSlider";
import { PlayButton } from "./components/PlayButton";
import { StatusBar } from "./components/StatusBar";
import { useTTS } from "./hooks/useTTS";
import { useVoices } from "./hooks/useVoices";
import { useTheme } from "./contexts/ThemeContext";

/** Determine the voice ID for a language's first available voice */
function defaultVoiceForLang(
  byLanguage: Record<string, { id: string }[]>,
  lang: string,
): string | null {
  return byLanguage[lang]?.[0]?.id ?? null;
}

export default function App() {
  const [text, setText] = useState("");
  const [speed, setSpeed] = useState(0.85);
  const [selectedVoice, setSelectedVoice] = useState<string>("");

  const speedDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { all, byLanguage, loading } = useVoices();
  const { status, error, audioUrl, generate, play, stop } = useTTS();
  const { theme, toggleTheme } = useTheme();

  // ── Set default voice when voices load ──
  const [initialized, setInitialized] = useState(false);
  if (!initialized && !loading && all.length > 0 && !selectedVoice) {
    const def = defaultVoiceForLang(byLanguage, "en") || all[0]?.id;
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

  // Infer language from the selected voice
  const selectedLanguage = useMemo(() => {
    if (!selectedVoice) return "en";
    for (const [lang, voices] of Object.entries(byLanguage)) {
      if (voices.some((v) => v.id === selectedVoice)) return lang;
    }
    return "en";
  }, [selectedVoice, byLanguage]);

  const hasText = text.trim().length > 0;

  // ── Manual generate handler ──
  const handleGenerate = useCallback(() => {
    if (!hasText || !selectedVoice || status === "generating") return;
    generate(text, selectedLanguage, selectedVoice, speed);
  }, [text, selectedLanguage, selectedVoice, speed, hasText, status, generate]);

  // ── Voice change handler (immediate auto-regeneration) ──
  const handleVoiceChange = useCallback(
    (voiceId: string) => {
      setSelectedVoice(voiceId);

      if (speedDebounceRef.current) {
        clearTimeout(speedDebounceRef.current);
        speedDebounceRef.current = null;
      }

      if (hasText && text.trim().length > 0) {
        let lang = "en";
        for (const [l, voices] of Object.entries(byLanguage)) {
          if (voices.some((v) => v.id === voiceId)) {
            lang = l;
            break;
          }
        }
        generate(text, lang, voiceId, speed);
      }
    },
    [hasText, text, speed, byLanguage, generate],
  );

  // ── Speed change handler (debounced auto-regeneration) ──
  const handleSpeedChange = useCallback(
    (newSpeed: number) => {
      setSpeed(newSpeed);

      if (hasText && selectedVoice) {
        if (speedDebounceRef.current) {
          clearTimeout(speedDebounceRef.current);
        }
        speedDebounceRef.current = setTimeout(
          () => generate(text, selectedLanguage, selectedVoice, newSpeed),
          300,
        );
      }
    },
    [hasText, selectedVoice, text, selectedLanguage, generate],
  );

  // ── Keyboard shortcut: Ctrl+Enter / Cmd+Enter ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (hasText && selectedVoice && status !== "generating") {
          e.preventDefault();
          generate(text, selectedLanguage, selectedVoice, speed);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasText, selectedVoice, selectedLanguage, speed, status, generate]);

  const handleDownload = useCallback(() => {
    if (!audioUrl) return;

    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = "voicio-output.wav";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [audioUrl]);

  return (
    <div className="min-h-svh bg-white text-black transition-colors dark:bg-black dark:text-white">
      {/* ── Header ─────────────────────────────────────────── */}
      <header
        className="mx-auto max-w-2xl px-4 pt-8 sm:px-6 lg:px-8"
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
              <p className="font-sans text-xs text-black/50 dark:text-white/50">
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

      {/* ── Main card ──────────────────────────────────────── */}
      <main className="mx-auto mt-6 max-w-2xl px-4 pb-16 sm:px-6 lg:px-8">
        <div
          className="animate-in border border-black/10 bg-white p-5 sm:p-7 dark:border-white/10 dark:bg-bento-bg-dark"
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
              voicesByLanguage={byLanguage}
              selectedVoice={selectedVoice}
              onChange={handleVoiceChange}
              disabled={status === "generating" || loading}
            />

            {/* Speed slider */}
            <SpeedSlider
              value={speed}
              onChange={handleSpeedChange}
              disabled={status === "generating"}
            />
          </div>

          {/* ── Action row ──────────────────────────────────── */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <PlayButton
              status={status}
              hasText={hasText}
              onGenerate={handleGenerate}
              onPlay={play}
              onStop={stop}
              onDownload={handleDownload}
            />

          </div>

          {/* ── Status ──────────────────────────────────────── */}
          <div
            className="mt-4"
            style={{ "--delay": "200ms" } as React.CSSProperties}
          >
            <StatusBar status={status} error={error} />
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────── */}
        <p
          className="animate-in mt-8 text-center font-sans text-[11px] text-black/50 dark:text-white/50"
          style={{ "--delay": "300ms" } as React.CSSProperties}
        >
          {hasText && selectedVoice
            ? "⚡ Speed and voice changes auto-generate — hit ⌘↵ to generate manually."
            : "Select a voice and type text to generate speech."}
        </p>
      </main>

      {/* ── Fixed bottom-right shortcut ─────────────────── */}
      {hasText && selectedVoice && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 hidden items-center gap-1.5 sm:flex">
          <span className="font-sans text-[11px] text-black/30 dark:text-white/30">
            Generate
          </span>
          <kbd className="pointer-events-auto border border-black/10 bg-white/80 px-1.5 py-0.5 font-sans text-[10px] text-black/50 backdrop-blur-sm dark:border-white/10 dark:bg-black/80 dark:text-white/50">
            ⌘
          </kbd>
          <span className="font-sans text-[10px] text-black/30 dark:text-white/30">+</span>
          <kbd className="pointer-events-auto border border-black/10 bg-white/80 px-1.5 py-0.5 font-sans text-[10px] text-black/50 backdrop-blur-sm dark:border-white/10 dark:bg-black/80 dark:text-white/50">
            ↵
          </kbd>
        </div>
      )}
    </div>
  );
}
