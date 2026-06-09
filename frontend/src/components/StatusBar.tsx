import type { AppStatus } from "../types";
import { Waveform } from "./Waveform";

interface Props {
  status: AppStatus;
  error: string | null;
}

const STATUS_LABELS: Record<AppStatus, string> = {
  idle: "Ready to generate",
  generating: "Generating speech…",
  ready: "Ready to play",
  playing: "Playing…",
  error: "Something went wrong",
};

export function StatusBar({ status, error }: Props) {
  const isActive = status === "generating" || status === "playing";

  return (
    <div className="flex items-center justify-between gap-3 border border-black/10 bg-white px-4 py-2.5 dark:border-white/10 dark:bg-bento-bg-dark">
      <div className="flex items-center gap-2.5">
        <Waveform active={isActive} />
        <div className="flex flex-col">
          <span
            className={`font-sans text-xs font-medium uppercase tracking-wide ${
              status === "error"
                ? "text-red-500"
                : "text-black/70 dark:text-white/70"
            }`}
          >
            {STATUS_LABELS[status]}
          </span>
          {error && (
            <span className="mt-0.5 font-sans text-xs text-red-400">
              {error}
            </span>
          )}
        </div>
      </div>
      {status === "ready" && (
        <span className="rounded-full bg-black/5 px-2.5 py-0.5 font-sans text-[11px] font-semibold text-black/70 dark:bg-white/10 dark:text-white/80">
          ✓ Ready
        </span>
      )}
    </div>
  );
}
