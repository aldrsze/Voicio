import type { VoiceInfo } from "../types";

interface Props {
  englishVoices: VoiceInfo[];
  tagalogVoices: VoiceInfo[];
  selectedEnglish: string | null;
  selectedTagalog: string | null;
  onEnglishChange: (id: string) => void;
  onTagalogChange: (id: string) => void;
  disabled?: boolean;
}

export function VoiceSelectors({
  englishVoices,
  tagalogVoices,
  selectedEnglish,
  selectedTagalog,
  onEnglishChange,
  onTagalogChange,
  disabled,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <VoiceSelector
        label="English voice"
        flag="EN"
        voices={englishVoices}
        selected={selectedEnglish}
        onChange={onEnglishChange}
        disabled={disabled}
      />
      <VoiceSelector
        label="Tagalog voice"
        flag="TL"
        voices={tagalogVoices}
        selected={selectedTagalog}
        onChange={onTagalogChange}
        disabled={disabled}
      />
    </div>
  );
}

/* ── Internal sub-component ─────────────────────────────────────────── */

interface SubProps {
  label: string;
  flag: string;
  voices: VoiceInfo[];
  selected: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
}

function VoiceSelector({
  label,
  flag,
  voices,
  selected,
  onChange,
  disabled,
}: SubProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-display text-sm font-semibold tracking-wide text-cocoa">
        {label}
      </label>
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold uppercase tracking-widest text-terracotta"
        >
          {flag}
        </span>
        <select
          value={selected ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`
            w-full appearance-none rounded-xl border-2 bg-white py-2.5 pl-11 pr-8
            font-body text-sm text-espresso
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-terracotta/30
            disabled:cursor-not-allowed disabled:opacity-60
            ${disabled
              ? "border-sand"
              : "border-sand hover:border-mocha/30 focus:border-terracotta"
            }
          `}
        >
          {voices.length === 0 && (
            <option value="" disabled>
              {disabled ? "Loading…" : "No voices found"}
            </option>
          )}
          {voices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        {/* Chevron */}
        <svg
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-mocha"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </div>
    </div>
  );
}
