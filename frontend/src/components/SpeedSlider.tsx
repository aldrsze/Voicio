import { useId } from "react";

interface Props {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

const MARKS = [0.5, 0.75, 1.0, 1.5, 2.0];

export function SpeedSlider({ value, onChange, disabled }: Props) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="font-sans text-sm font-semibold tracking-wide text-black dark:text-white"
      >
        Speed
      </label>
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="range"
          min={0.5}
          max={2.0}
          step={0.05}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="flex-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span className="min-w-[3ch] text-right font-sans text-sm tabular-nums text-black dark:text-white">
          {value.toFixed(2)}×
        </span>
      </div>
      <div className="flex justify-between px-0.5">
        {MARKS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            disabled={disabled}
            className={`
              font-sans text-[11px] font-medium uppercase tracking-wide transition-colors
              disabled:cursor-not-allowed
              ${Math.abs(value - m) < 0.04
                ? "text-black font-bold dark:text-white"
                : "text-black/40 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
              }
            `}
          >
            {m}×
          </button>
        ))}
      </div>
    </div>
  );
}
