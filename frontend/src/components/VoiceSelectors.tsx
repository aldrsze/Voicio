import { useMemo, useState } from "react";
import { ChevronDown, Cloud, HardDrive, Info, Zap } from "lucide-react";
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

type EngineFilter = "all" | "local" | "edge";

interface Props {
  voicesByLanguage: Record<string, VoiceInfo[]>;
  selectedVoice: string;
  onChange: (voiceId: string) => void;
  disabled?: boolean;
}

export function VoiceSelector({
  voicesByLanguage,
  selectedVoice,
  onChange,
  disabled,
}: Props) {
  const [engineFilter, setEngineFilter] = useState<EngineFilter>("all");

  // Count voices per engine
  const counts = useMemo(() => {
    let local = 0;
    let edge = 0;
    for (const voices of Object.values(voicesByLanguage)) {
      for (const v of voices) {
        if (v.engine === "edge") edge++;
        else local++;
      }
    }
    return { local, edge, total: local + edge };
  }, [voicesByLanguage]);

  // Filter voices by engine
  const filteredByLanguage = useMemo(() => {
    if (engineFilter === "all") return voicesByLanguage;

    const engine = engineFilter === "edge" ? "edge" : undefined;
    const filtered: Record<string, VoiceInfo[]> = {};

    for (const [lang, voices] of Object.entries(voicesByLanguage)) {
      const matched = engine
        ? voices.filter((v) => v.engine === engine)
        : voices.filter((v) => v.engine !== "edge");
      if (matched.length > 0) {
        filtered[lang] = matched;
      }
    }
    return filtered;
  }, [voicesByLanguage, engineFilter]);

  const selectedVoiceInfo = useMemo(() => {
    for (const voices of Object.values(voicesByLanguage)) {
      const found = voices.find((v) => v.id === selectedVoice);
      if (found) return found;
    }
    return null;
  }, [voicesByLanguage, selectedVoice]);

  const languageCodes = useMemo(
    () => Object.keys(filteredByLanguage).sort(),
    [filteredByLanguage]
  );

  const tabs: { key: EngineFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.total },
    { key: "local", label: "Local", count: counts.local },
    { key: "edge", label: "Edge", count: counts.edge },
  ];

  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-sans text-sm font-semibold tracking-wide text-black dark:text-white">
        Voice
      </label>

      {/* ── Engine filter tabs ── */}
      <div className="flex gap-1" role="tablist" aria-label="Engine filter">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={engineFilter === tab.key}
            onClick={() => setEngineFilter(tab.key)}
            disabled={disabled}
            className={`
              flex items-center gap-1.5 px-3 py-1.5
              font-sans text-xs font-semibold tracking-wide
              transition-all duration-150
              disabled:cursor-not-allowed disabled:opacity-50
              ${
                engineFilter === tab.key
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "border border-black/10 bg-white text-black/50 hover:bg-black/5 hover:text-black dark:border-white/10 dark:bg-transparent dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
              }
            `}
          >
            {tab.key === "local" && <HardDrive className="h-3.5 w-3.5" />}
            {tab.key === "edge" && <Zap className="h-3.5 w-3.5" />}
            <span>{tab.label}</span>
            <span
              className={`ml-0.5 px-1.5 py-0.5 text-[10px] tabular-nums ${
                engineFilter === tab.key
                  ? "bg-white/20 text-white/90 dark:bg-black/20 dark:text-black/90"
                  : "bg-black/5 text-black/40 dark:bg-white/10 dark:text-white/40"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Voice dropdown ── */}
      <div className="relative">
        <select
          value={
            languageCodes.some((lang) =>
              filteredByLanguage[lang]?.some((v) => v.id === selectedVoice),
            )
              ? selectedVoice
              : ""
          }
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || languageCodes.length === 0}
          className={`
            w-full appearance-none border bg-gray-50 py-2.5 pl-3 pr-8
            font-sans text-sm text-black
            transition-colors duration-150
            focus:outline-none focus:ring-1 focus:ring-black/30
            disabled:cursor-not-allowed disabled:opacity-50
            dark:bg-neutral-900 dark:text-white
            dark:focus:ring-white/30
            ${disabled
              ? "border-black/10 dark:border-white/10"
              : "border-black/20 hover:border-black/40 dark:border-white/20 dark:hover:border-white/40"
            }
          `}
        >
          {/* Placeholder for when no voice matches filter */}
          {(!selectedVoice ||
            !languageCodes.some((lang) =>
              filteredByLanguage[lang]?.some((v) => v.id === selectedVoice),
            )) && (
            <option value="" disabled>
              {languageCodes.length === 0
                ? disabled
                  ? "Loading…"
                  : engineFilter !== "all" && Object.keys(voicesByLanguage).length > 0
                    ? `No ${engineFilter} voices — try a different tab`
                    : "No voices available"
                : "Select a voice…"}
            </option>
          )}

          {languageCodes.map((lang) => {
            const voices = filteredByLanguage[lang];
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
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-black/40 dark:text-white/40"
        />
      </div>

      {/* Selected voice character card — monochrome badges */}
      {selectedVoiceInfo && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 px-1">
          {/* Gender badge */}
          {selectedVoiceInfo.gender && selectedVoiceInfo.gender !== "mixed" && (
            <span className="inline-flex items-center gap-1 border border-black/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black/60 dark:border-white/10 dark:text-white/60">
              {genderIcon(selectedVoiceInfo.gender)}
              {selectedVoiceInfo.gender}
            </span>
          )}

          {/* Vibe tags */}
          {selectedVoiceInfo.vibe?.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex border border-black/10 bg-black/5 px-2 py-0.5 text-[10px] font-medium text-black/50 dark:border-white/10 dark:bg-white/5 dark:text-white/50"
            >
              {tag}
            </span>
          ))}
          {selectedVoiceInfo.vibe && selectedVoiceInfo.vibe.length > 3 && (
            <span className="text-[10px] text-black/30 dark:text-white/30">
              +{selectedVoiceInfo.vibe.length - 3}
            </span>
          )}

          {/* Quality badge */}
          {selectedVoiceInfo.quality && (
            <span className="inline-flex items-center border border-black/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black/60 dark:border-white/10 dark:text-white/60">
              {selectedVoiceInfo.quality}
            </span>
          )}

          {/* Engine badge */}
          {selectedVoiceInfo.engine && selectedVoiceInfo.engine !== "piper" && (
            <span
              title={
                selectedVoiceInfo.engine === "edge"
                  ? "Fast; no model downloads needed — streams from Microsoft Edge TTS"
                  : selectedVoiceInfo.engine === "mms"
                    ? "Model downloads on first use — Hugging Face MMS-TTS"
                    : undefined
              }
              className="inline-flex items-center gap-1 border border-black/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-black/60 dark:border-white/10 dark:text-white/60"
            >
              {selectedVoiceInfo.engine === "edge" ? (
                <Zap className="h-3 w-3" />
              ) : (
                <Cloud className="h-3 w-3" />
              )}
              {selectedVoiceInfo.engine === "edge" ? "Edge" : selectedVoiceInfo.engine.toUpperCase()}
            </span>
          )}

          {/* Description tooltip */}
          {selectedVoiceInfo.description && (
            <span
              title={selectedVoiceInfo.description}
              className="ml-auto cursor-help text-black/30 hover:text-black/60 dark:text-white/30 dark:hover:text-white/60"
            >
              <Info className="h-3 w-3" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Format a voice for the select option text */
function formatVoiceOption(v: VoiceInfo): string {
  let name = v.name || voiceDisplayName(v.id);
  if (!name && v.id.includes("facebook/mms")) name = "Tagalog";

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
