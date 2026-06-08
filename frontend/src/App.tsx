import { useCallback, useState } from "react";
import { TextInput } from "./components/TextInput";
import { VoiceSelectors } from "./components/VoiceSelectors";
import { SpeedSlider } from "./components/SpeedSlider";
import { PlayButton } from "./components/PlayButton";
import { StatusBar } from "./components/StatusBar";
import { useTTS } from "./hooks/useTTS";
import { useVoices } from "./hooks/useVoices";

export default function App() {
  const [text, setText] = useState("");
  const [speed, setSpeed] = useState(1.0);
  const [voiceEng, setVoiceEng] = useState<string | null>(null);
  const [voiceTgl, setVoiceTgl] = useState<string | null>(null);

  const { englishVoices, tagalogVoices } = useVoices();
  const { status, error, audioUrl, generate, play, stop } = useTTS();

  const hasText = text.trim().length > 0;

  const handleGenerate = useCallback(() => {
    if (!hasText) return;
    generate(text, voiceEng, voiceTgl, speed);
  }, [text, voiceEng, voiceTgl, speed, hasText, generate]);

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
    <div className="min-h-svh bg-mesh">
      {/* ── Header ─────────────────────────────────────────── */}

      <header className="mx-auto flex max-w-2xl items-center gap-3 px-4 pt-8 animate-fade-up">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-terracotta shadow-sm">
          <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-espresso">
            Voicio
          </h1>
          <p className="font-body text-xs text-mocha">
            Bilingual Text-to-Speech — English &amp; Tagalog
          </p>
        </div>
      </header>

      {/* ── Main card ──────────────────────────────────────── */}

      <main className="mx-auto mt-6 max-w-2xl px-4 pb-16">
        <div className="animate-fade-up delay-1 rounded-2xl border border-sand bg-white/70 p-5 shadow-sm backdrop-blur-[2px] sm:p-7">
          <div className="flex flex-col gap-5">
            {/* Text input */}
            <TextInput
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={status === "generating"}
            />

            {/* Voice selectors + speed */}
            <VoiceSelectors
              englishVoices={englishVoices}
              tagalogVoices={tagalogVoices}
              selectedEnglish={voiceEng}
              selectedTagalog={voiceTgl}
              onEnglishChange={setVoiceEng}
              onTagalogChange={setVoiceTgl}
              disabled={status === "generating"}
            />

            <SpeedSlider
              value={speed}
              onChange={setSpeed}
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

          <div className="mt-4 animate-fade-up delay-5">
            <StatusBar status={status} error={error} />
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────── */}

        <p className="mt-8 text-center font-body text-[11px] text-mocha/45">
          Automatically detects English and Tagalog in your text.
        </p>
      </main>
    </div>
  );
}
