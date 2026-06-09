import { useMemo } from "react";
import type { VoiceInfo } from "../types";
import { voiceDisplayName } from "../hooks/useVoices";

const LANG_FLAGS: Record<string, string> = {
  en: "🇺🇸",
  es: "🇪🇸",
  fr: "🇫🇷",
  de: "🇩🇪",
  it: "🇮🇹",
  pt: "🇧🇷",
  nl: "🇳🇱",
  pl: "🇵🇱",
  ru: "🇷🇺",
  hi: "🇮🇳",
  zh: "🇨🇳",
  tl: "🇵🇭",
};

const LANG_LABELS: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  pl: "Polish",
  ru: "Russian",
  hi: "Hindi",
  zh: "Chinese",
  tl: "Tagalog",
};

interface Props {
  /** All voices grouped by language code */
  voicesByLanguage: Record<string, VoiceInfo[]>;
  /** Currently selected voice ID */
  selectedVoice: string;
  /** Called when a voice (and thus language) is selected */
  onChange: (voiceId: string) => void;
  disabled?: boolean;
}

export function VoiceSelector({
  voicesByLanguage,
  selectedVoice,
  onChange,
  disabled,
}: Props) {
  const selectedVoiceInfo = useMemo(() => {
    for (const voices of Object.values(voicesByLanguage)) {
      const found = voices.find((v) => v.id === selectedVoice);
      if (found) return found;
    }
    return null;
  }, [voicesByLanguage, selectedVoice]);

  const languageCodes = useMemo(
    () => Object.keys(voicesByLanguage).sort(),
    [voicesByLanguage]
  );

  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-display text-sm font-semibold tracking-wide text-cocoa">
        Voice
      </label>

      <div className="relative">
        <select
          value={selectedVoice}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`
            w-full appearance-none rounded-xl border-2 bg-white py-2.5 pl-3 pr-8
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
          {languageCodes.length === 0 && (
            <option value="" disabled>
              {disabled ? "Loading…" : "No voices available"}
            </option>
          )}

          {languageCodes.map((lang) => {
            const voices = voicesByLanguage[lang];
            const flag = LANG_FLAGS[lang] || "🌐";
            const label = LANG_LABELS[lang] || lang.toUpperCase();

            return (
              <optgroup key={lang} label={`${flag} ${label}`}>
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {formatVoiceOption(v)}
                  </option>
                ))}
              </optgroup>
            );
          })}
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

      {/* Selected voice character card */}
      {selectedVoiceInfo && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 px-1">
          {/* Gender badge */}
          {selectedVoiceInfo.gender && selectedVoiceInfo.gender !== "mixed" && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                selectedVoiceInfo.gender === "female"
                  ? "bg-rose-50 text-rose-600"
                  : selectedVoiceInfo.gender === "male"
                    ? "bg-sky-50 text-sky-600"
                    : "bg-purple-50 text-purple-600"
              }`}
            >
              {genderIcon(selectedVoiceInfo.gender)}
              {selectedVoiceInfo.gender}
            </span>
          )}

          {/* Vibe tags */}
          {selectedVoiceInfo.vibe?.map((tag) => (
            <span
              key={tag}
              className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700"
            >
              {tag}
            </span>
          ))}

          {/* Quality badge */}
          {selectedVoiceInfo.quality && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                selectedVoiceInfo.quality === "high"
                  ? "bg-emerald-50 text-emerald-600"
                  : selectedVoiceInfo.quality === "medium"
                    ? "bg-amber-50 text-amber-600"
                    : "bg-stone-50 text-stone-500"
              }`}
            >
              {selectedVoiceInfo.quality}
            </span>
          )}

          {/* Description tooltip */}
          {selectedVoiceInfo.description && (
            <span
              title={selectedVoiceInfo.description}
              className="ml-auto cursor-help text-[10px] text-mocha/50 hover:text-mocha/80"
            >
              ⓘ
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Format a voice as "Name — vibe · quality" for the option text */
function formatVoiceOption(v: VoiceInfo): string {
  const name = v.id.includes("facebook/mms") ? "Tagalog" : voiceDisplayName(v.id);
  const badge = v.gender && v.gender !== "mixed" ? genderIcon(v.gender) : "";
  return `${badge ? badge + " " : ""}${name}`;
}

function genderIcon(gender: string): string {
  switch (gender) {
    case "female":
      return "♀";
    case "male":
      return "♂";
    case "non-binary":
      return "⚧";
    default:
      return "";
  }
}
