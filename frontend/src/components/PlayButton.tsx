import { Download, LoaderCircle, Play, Square } from "lucide-react";
import type { AppStatus } from "../types";

interface Props {
  status: AppStatus;
  hasText: boolean;
  onGenerate: () => void;
  onPlay: () => void;
  onStop: () => void;
  onDownload: () => void;
}

export function PlayButton({
  status,
  hasText,
  onGenerate,
  onPlay,
  onStop,
  onDownload,
}: Props) {
  const isBusy = status === "generating";
  const hasAudio = status === "ready" || status === "playing";
  const isPlaying = status === "playing";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* ── Primary: Generate / Generate Again ── */}
      <button
        onClick={onGenerate}
        disabled={!hasText || isBusy}
        className={`
          relative inline-flex cursor-pointer items-center gap-2.5
          px-6 py-2.5
          font-sans text-sm font-semibold
          transition-all
          active:scale-[0.97]
          disabled:cursor-not-allowed disabled:opacity-30 disabled:active:scale-100
          ${
            isBusy
              ? "bg-black/10 text-black/50 dark:bg-white/10 dark:text-white/50"
              : hasAudio
                ? "bg-black text-white hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
                : "bg-black text-white hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
          }
        `}
      >
        {isBusy && (
          <span className="pointer-events-none absolute inset-0 border border-black/20 dark:border-white/20 animate-pulse-ring" />
        )}

        {isBusy ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Play className="h-4 w-4" fill="currentColor" />
        )}

        {isBusy ? "Generating…" : hasAudio ? "Generate Again" : "Generate & Play"}
      </button>

      {/* ── Play (when audio exists and not playing) ── */}
      {hasAudio && !isPlaying && (
        <button
          onClick={onPlay}
          className="inline-flex cursor-pointer items-center gap-2 border border-black/20 bg-white px-5 py-2.5 font-sans text-sm font-semibold text-black transition-all hover:bg-black/5 active:scale-[0.97] dark:border-white/20 dark:bg-transparent dark:text-white dark:hover:bg-white/10"
        >
          <Play className="h-4 w-4" fill="currentColor" />
          Play
        </button>
      )}

      {/* ── Stop (when playing) ── */}
      {isPlaying && (
        <button
          onClick={onStop}
          className="inline-flex cursor-pointer items-center gap-2 border border-red-400 bg-white px-5 py-2.5 font-sans text-sm font-semibold text-red-600 transition-all hover:bg-red-50 active:scale-[0.97] dark:border-red-800 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-950"
        >
          <Square className="h-4 w-4" fill="currentColor" />
          Stop
        </button>
      )}

      {/* ── Download (when audio exists) ── */}
      {hasAudio && (
        <button
          onClick={onDownload}
          className="inline-flex cursor-pointer items-center gap-1.5 border border-black/10 bg-white px-4 py-2.5 font-sans text-sm font-medium text-black/70 transition-all hover:bg-black/5 active:scale-[0.97] dark:border-white/10 dark:bg-transparent dark:text-white/80 dark:hover:bg-white/10"
        >
          <Download className="h-4 w-4" />
          Download
        </button>
      )}
    </div>
  );
}
