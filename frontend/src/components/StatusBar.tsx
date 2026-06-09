import { Download, LoaderCircle, Play, Square } from "lucide-react";
import type { AppStatus } from "../types";
import { Waveform } from "./Waveform";

interface Props {
  status: AppStatus;
  error: string | null;
  hasText: boolean;
  onGenerate: () => void;
  onPlay: () => void;
  onStop: () => void;
  onDownload: () => void;
}

const STATUS_LABELS: Record<AppStatus, string> = {
  idle: "Ready to generate",
  generating: "Generating speech…",
  ready: "Ready to play",
  playing: "Playing…",
  error: "Something went wrong",
};

export function StatusBar({
  status,
  error,
  hasText,
  onGenerate,
  onPlay,
  onStop,
  onDownload,
}: Props) {
  const isActive = status === "generating" || status === "playing";
  const isBusy = status === "generating";
  const hasAudio = status === "ready" || status === "playing";
  const isPlaying = status === "playing";

  const canGenerate = hasText && !isBusy;

  return (
    <div className="flex items-center justify-between gap-3 border border-black/10 bg-white px-4 py-2.5 dark:border-white/10 dark:bg-bento-bg-dark">
      {/* ── Left: Waveform + status text ── */}
      <div className="flex min-w-0 items-center gap-2.5">
        <Waveform active={isActive} />
        <div className="flex flex-col">
          <span
            className={`font-sans text-xs font-medium uppercase tracking-wide ${
              status === "error"
                ? "text-red-500"
                : "text-black/70 dark:text-white/70"
            }`}
          >
            {status === "idle" && !hasText
              ? "Enter text to begin"
              : STATUS_LABELS[status]}
          </span>
          {error && (
            <span className="mt-0.5 font-sans text-xs text-red-400">
              {error}
            </span>
          )}
        </div>
      </div>

      {/* ── Right: Action buttons ── */}
      <div className="flex shrink-0 items-center gap-1">
        {/* Generate button (always available when text+voice are set) */}
        {canGenerate && (
          <button
            onClick={onGenerate}
            className={`
              inline-flex items-center gap-1.5 border px-3 py-1.5
              font-sans text-[11px] font-semibold tracking-wide
              transition-all duration-150 active:scale-[0.97]
              ${
                hasAudio
                  ? "border-black/10 bg-white text-black/60 hover:bg-black/5 dark:border-white/10 dark:bg-transparent dark:text-white/60 dark:hover:bg-white/10"
                  : "border-black bg-black text-white hover:bg-black/80 dark:border-white dark:bg-white dark:text-black dark:hover:bg-white/80"
              }
            `}
          >
            {isBusy ? (
              <>
                <LoaderCircle className="h-3 w-3 animate-spin" />
                Generating…
              </>
            ) : hasAudio ? (
              "Generate Again"
            ) : (
              <>
                <Play className="h-3 w-3" fill="currentColor" />
                Generate
              </>
            )}
          </button>
        )}

        {/* Play (when audio exists and not playing) */}
        {hasAudio && !isPlaying && (
          <button
            onClick={onPlay}
            className="inline-flex items-center gap-1 border border-black/10 bg-white px-2.5 py-1.5 font-sans text-[11px] font-semibold text-black transition-all hover:bg-black/5 active:scale-[0.97] dark:border-white/10 dark:bg-transparent dark:text-white dark:hover:bg-white/10"
          >
            <Play className="h-3 w-3" fill="currentColor" />
            Play
          </button>
        )}

        {/* Stop (when playing) */}
        {isPlaying && (
          <button
            onClick={onStop}
            className="inline-flex items-center gap-1 border border-red-300 bg-white px-2.5 py-1.5 font-sans text-[11px] font-semibold text-red-600 transition-all hover:bg-red-50 active:scale-[0.97] dark:border-red-800 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-950"
          >
            <Square className="h-3 w-3" fill="currentColor" />
            Stop
          </button>
        )}

        {/* Download (when audio exists) */}
        {hasAudio && !isPlaying && (
          <button
            onClick={onDownload}
            className="inline-flex items-center justify-center border border-black/10 bg-white p-1.5 text-black/40 transition-all hover:bg-black/5 hover:text-black/70 active:scale-[0.97] dark:border-white/10 dark:bg-transparent dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white/70"
            aria-label="Download"
          >
            <Download className="h-3 w-3" />
          </button>
        )}

        {/* Generating spinner when no generate button shown */}
        {isBusy && !canGenerate && (
          <span className="flex items-center gap-1.5 border border-black/10 bg-black/5 px-3 py-1.5 font-sans text-[11px] text-black/50 dark:border-white/10 dark:bg-white/5 dark:text-white/50">
            <LoaderCircle className="h-3 w-3 animate-spin" />
            Generating…
          </span>
        )}
      </div>
    </div>
  );
}
