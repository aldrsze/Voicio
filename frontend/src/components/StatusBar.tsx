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
    <div className="flex items-center justify-between gap-3 rounded-xl border border-sand bg-white/60 px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <Waveform active={isActive} />
        <div className="flex flex-col">
          <span
            className={`font-body text-xs font-medium tracking-wide uppercase ${
              status === "error"
                ? "text-red-500"
                : status === "generating"
                  ? "text-terracotta"
                  : status === "playing"
                    ? "text-teal"
                    : "text-mocha"
            }`}
          >
            {STATUS_LABELS[status]}
          </span>
          {error && (
            <span className="mt-0.5 font-body text-xs text-red-400">
              {error}
            </span>
          )}
        </div>
      </div>
      {status === "ready" && (
        <span className="rounded-full bg-teal/10 px-2.5 py-0.5 font-body text-[11px] font-semibold text-teal">
          ✓ Ready
        </span>
      )}
    </div>
  );
}
