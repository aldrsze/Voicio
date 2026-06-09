interface Props {
  label: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ label, enabled, onChange, disabled }: Props) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-sans text-sm font-semibold tracking-wide text-black dark:text-white">
        {label}
      </span>

      <div className="flex" role="switch" aria-checked={enabled} aria-label={label}>
        <button
          type="button"
          onClick={() => onChange(true)}
          disabled={disabled}
          className={`
            border px-3.5 py-1.5 font-sans text-xs font-semibold tracking-wide
            transition-all duration-150
            disabled:cursor-not-allowed disabled:opacity-50
            ${
              enabled
                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                : "border-black/15 bg-white text-black/40 hover:bg-black/5 dark:border-white/15 dark:bg-transparent dark:text-white/40 dark:hover:bg-white/10"
            }
          `}
        >
          ON
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          disabled={disabled}
          className={`
            -ml-px border px-3.5 py-1.5 font-sans text-xs font-semibold tracking-wide
            transition-all duration-150
            disabled:cursor-not-allowed disabled:opacity-50
            ${
              !enabled
                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                : "border-black/15 bg-white text-black/40 hover:bg-black/5 dark:border-white/15 dark:bg-transparent dark:text-white/40 dark:hover:bg-white/10"
            }
          `}
        >
          OFF
        </button>
      </div>
    </div>
  );
}
