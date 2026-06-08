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

  if (status === "playing") {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={onStop}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-teal px-5 py-2.5 font-body text-sm font-semibold text-white shadow-sm transition-all hover:bg-teal-dark active:scale-[0.97]"
        >
          {/* Stop icon */}
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
            <rect x="3" y="3" width="10" height="10" rx="1.5" />
          </svg>
          Stop
        </button>
        <button
          onClick={onDownload}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border-2 border-sand bg-white px-4 py-2.5 font-body text-sm font-medium text-cocoa transition-all hover:border-mocha/30 active:scale-[0.97]"
        >
          {/* Download icon */}
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 1v9M4 6l4 4 4-4" />
            <path d="M1 12v2a1 1 0 001 1h12a1 1 0 001-1v-2" />
          </svg>
          Download
        </button>
      </div>
    );
  }

  if (status === "ready") {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={onPlay}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-teal px-5 py-2.5 font-body text-sm font-semibold text-white shadow-sm transition-all hover:bg-teal-dark active:scale-[0.97]"
        >
          {/* Play icon */}
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2.5v11l9-5.5z" />
          </svg>
          Play
        </button>
        <button
          onClick={onDownload}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border-2 border-sand bg-white px-4 py-2.5 font-body text-sm font-medium text-cocoa transition-all hover:border-mocha/30 active:scale-[0.97]"
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 1v9M4 6l4 4 4-4" />
            <path d="M1 12v2a1 1 0 001 1h12a1 1 0 001-1v-2" />
          </svg>
          Download
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onGenerate}
      disabled={!hasText || isBusy}
      className={`
        relative inline-flex cursor-pointer items-center gap-2.5
        rounded-full px-7 py-3
        font-body text-sm font-semibold
        shadow-sm transition-all
        active:scale-[0.97]
        disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100
        ${
          isBusy
            ? "bg-mocha/20 text-mocha"
            : "bg-terracotta text-white hover:bg-terracotta-light"
        }
      `}
    >
      {/* Animated ring when generating */}
      {isBusy && (
        <span className="pointer-events-none absolute inset-0 rounded-full border-2 border-terracotta/30 animate-pulse-ring" />
      )}
      {/* Icon */}
      {isBusy ? (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
          <path d="M8 2a6 6 0 016 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 2.5v11l9-5.5z" />
        </svg>
      )}
      {isBusy ? "Generating…" : "Generate & Play"}
    </button>
  );
}
