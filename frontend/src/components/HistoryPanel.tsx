import { Download, Play } from "lucide-react";

export interface HistoryEntry {
  id: number;
  text: string;
  voiceName: string;
  voiceId: string;
  speed: number;
  timestamp: Date;
  audioUrl: string;
}

interface Props {
  entries: HistoryEntry[];
  onPlay: (entry: HistoryEntry) => void;
  onDownload: (entry: HistoryEntry) => void;
  playingId: number | null;
}

// Relative time format
function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Truncate text
function truncate(text: string, max = 55): string {
  if (text.length <= max) return text;
  const trimmed = text.slice(0, max);
  const lastSpace = trimmed.lastIndexOf(" ");
  return (lastSpace > 10 ? trimmed.slice(0, lastSpace) : trimmed) + "…";
}

export function HistoryPanel({ entries, onPlay, onDownload, playingId }: Props) {
  const isEmpty = entries.length === 0;

  return (
    <div className="flex flex-1 flex-col border border-black/10 bg-white dark:border-white/10 dark:bg-bento-bg-dark">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-black/10 px-4 py-2.5 dark:border-white/10">
        <span className="font-sans text-sm font-semibold tracking-wide text-black dark:text-white">
          History
        </span>
        {!isEmpty && (
          <span className="inline-flex items-center gap-1 border border-black/10 bg-black/5 px-2 py-0.5 text-[10px] font-semibold uppercase tabular-nums text-black/70 dark:border-white/10 dark:bg-white/5 dark:text-white/80">
            {entries.length}
          </span>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-12">
            <span className="font-sans text-[11px] text-black/30 dark:text-white/30">
              No generations yet
            </span>
            <span className="text-center font-sans text-[10px] text-black/20 dark:text-white/20">
              Generated audio will appear here
            </span>
          </div>
        ) : (
          <div className="flex flex-col">
            {entries.map((entry) => {
              const isPlaying = playingId === entry.id;
              return (
                <div
                  key={entry.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onPlay(entry)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onPlay(entry);
                    }
                  }}
                  className={`
                    group flex w-full cursor-pointer items-start gap-3 border-b border-black/5 px-4 py-3 text-left
                    transition-all duration-150 last:border-b-0
                    hover:bg-black/2 active:bg-black/4
                    dark:border-white/5 dark:hover:bg-white/2 dark:active:bg-white/4
                  `}
                >
                  {/* Play */}
                  <span
                    className={`
                      mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border
                      transition-all duration-150
                      ${
                        isPlaying
                          ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                          : "border-black/10 text-black/40 group-hover:border-black/30 group-hover:text-black/60 dark:border-white/10 dark:text-white/40 dark:group-hover:border-white/30 dark:group-hover:text-white/60"
                      }
                    `}
                  >
                    <Play className="h-3 w-3" fill="currentColor" />
                  </span>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-sans text-[10px] font-medium uppercase tracking-wide text-black/40 dark:text-white/50">
                        {relativeTime(entry.timestamp)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-sans text-[10px] tabular-nums text-black/30 dark:text-white/30">
                          {entry.speed.toFixed(2)}×
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDownload(entry);
                          }}
                          className="flex h-5 w-5 items-center justify-center text-black/20 transition-colors hover:text-black/60 dark:text-white/20 dark:hover:text-white/60"
                          aria-label="Download this generation"
                        >
                          <Download className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <p className="mt-0.5 font-sans text-[13px] leading-snug text-black dark:text-white">
                      {truncate(entry.text)}
                    </p>
                    <p className="mt-0.5 truncate font-sans text-[10px] text-black/40 dark:text-white/50">
                      {entry.voiceName || entry.voiceId}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
