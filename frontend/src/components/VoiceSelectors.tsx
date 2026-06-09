import { useMemo, useState, useEffect, useRef } from "react";
import { ChevronDown, HardDrive, Info, Package, Zap, Globe, Search } from "lucide-react";
import * as Flags from 'country-flag-icons/react/3x2';
import { hasFlag } from 'country-flag-icons';
import type { VoiceInfo } from "../types";
import { voiceDisplayName } from "../hooks/useVoices";
import { ModelManager } from "./ModelManager";

const langToCountry: Record<string, string> = {
  en: 'US', es: 'ES', fr: 'FR', de: 'DE', it: 'IT', pt: 'PT', ru: 'RU',
  zh: 'CN', ja: 'JP', ko: 'KR', ar: 'SA', hi: 'IN', nl: 'NL', tr: 'TR',
  pl: 'PL', sv: 'SE', da: 'DK', fi: 'FI', no: 'NO', cs: 'CZ', el: 'GR',
  hu: 'HU', ro: 'RO', sk: 'SK', uk: 'UA', vi: 'VN', th: 'TH', id: 'ID',
  ms: 'MY', bg: 'BG', hr: 'HR', sr: 'RS', sl: 'SI', et: 'EE', lv: 'LV',
  lt: 'LT', ca: 'ES', eu: 'ES', gl: 'ES', fil: 'PH', fa: 'IR', he: 'IL',
  ur: 'PK', bn: 'BD', sw: 'KE', ta: 'IN', te: 'IN', mr: 'IN', gu: 'IN',
  kn: 'IN', ml: 'IN', pa: 'IN', am: 'ET', is: 'IS', kk: 'KZ', mk: 'MK',
  cy: 'GB', ga: 'IE', af: 'ZA', sq: 'AL', hy: 'AM', az: 'AZ', ka: 'GE'
};

function getCountryCode(lang: string) {
  const parts = lang.split(/[-_]/);
  let code = parts.length > 1 ? parts[1].toUpperCase() : null;
  if (!code || !hasFlag(code)) {
    const baseLang = parts[0].toLowerCase();
    code = langToCountry[baseLang] || baseLang.toUpperCase();
  }
  if (code && hasFlag(code)) return code as keyof typeof Flags;
  return null;
}

function FlagIcon({ lang }: { lang: string }) {
  const code = getCountryCode(lang);
  if (!code) return <Globe className="w-3.5 h-3.5 text-black/50 dark:text-white/50" />;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Flag = (Flags as any)[code] || (Flags as any).default?.[code];
  if (!Flag) return <Globe className="w-3.5 h-3.5 text-black/50 dark:text-white/50" />;
  return (
    <div className="shrink-0 shadow-sm border border-black/10 dark:border-white/10 overflow-hidden rounded-xs flex items-center justify-center bg-white">
      <Flag style={{ width: '16px', height: '11px', display: 'block' }} />
    </div>
  );
}

const LANG_LABELS: Record<string, string> = {
  af: "Afrikaans",
  am: "Amharic",
  ar: "Arabic",
  az: "Azerbaijani",
  bg: "Bulgarian",
  bn: "Bengali",
  bs: "Bosnian",
  ca: "Catalan",
  cs: "Czech",
  cy: "Welsh",
  da: "Danish",
  de: "German",
  el: "Greek",
  en: "English",
  es: "Spanish",
  et: "Estonian",
  fa: "Persian",
  fi: "Finnish",
  fr: "French",
  ga: "Irish",
  gl: "Galician",
  gu: "Gujarati",
  he: "Hebrew",
  hi: "Hindi",
  hr: "Croatian",
  hu: "Hungarian",
  id: "Indonesian",
  is: "Icelandic",
  it: "Italian",
  iu: "Inuktitut",
  ja: "Japanese",
  jv: "Javanese",
  ka: "Georgian",
  kk: "Kazakh",
  km: "Khmer",
  kn: "Kannada",
  ko: "Korean",
  lo: "Lao",
  lt: "Lithuanian",
  lv: "Latvian",
  mk: "Macedonian",
  ml: "Malayalam",
  mn: "Mongolian",
  mr: "Marathi",
  ms: "Malay",
  mt: "Maltese",
  my: "Burmese",
  nb: "Norwegian",
  ne: "Nepali",
  nl: "Dutch",
  pl: "Polish",
  ps: "Pashto",
  pt: "Portuguese",
  ro: "Romanian",
  ru: "Russian",
  si: "Sinhala",
  sk: "Slovak",
  sl: "Slovenian",
  so: "Somali",
  sq: "Albanian",
  sr: "Serbian",
  su: "Sundanese",
  sv: "Swedish",
  sw: "Swahili",
  ta: "Tamil",
  te: "Telugu",
  th: "Thai",
  tl: "Tagalog",
  tr: "Turkish",
  uk: "Ukrainian",
  ur: "Urdu",
  uz: "Uzbek",
  vi: "Vietnamese",
  zh: "Chinese",
  zu: "Zulu",
};

type EngineFilter = "all" | "local" | "edge";

interface Props {
  voicesByLanguage: Record<string, VoiceInfo[]>;
  selectedVoice: string;
  onChange: (voiceId: string) => void;
  disabled?: boolean;
  onModelChanged?: () => void;
}

export function VoiceSelector({
  voicesByLanguage,
  selectedVoice,
  onChange,
  disabled,
  onModelChanged,
}: Props) {
  const [engineFilter, setEngineFilter] = useState<EngineFilter>("all");
  const [showModelManager, setShowModelManager] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Count engines
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

  // Filter by engine
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

  const filteredLanguagesWithSearch = useMemo(() => {
    if (!searchQuery.trim()) return { langs: languageCodes, voices: filteredByLanguage };
    
    const query = searchQuery.toLowerCase();
    const resultLangs: string[] = [];
    const resultVoices: Record<string, VoiceInfo[]> = {};
    
    for (const lang of languageCodes) {
      const label = getLabelForLang(lang).toLowerCase();
      const voices = filteredByLanguage[lang];
      
      if (label.includes(query)) {
        resultLangs.push(lang);
        resultVoices[lang] = voices;
      } else {
        const matchedVoices = voices.filter(v => 
          formatVoiceOption(v).toLowerCase().includes(query) ||
          v.id.toLowerCase().includes(query) ||
          (v.description && v.description.toLowerCase().includes(query)) ||
          (v.engine && v.engine.toLowerCase().includes(query))
        );
        
        if (matchedVoices.length > 0) {
          resultLangs.push(lang);
          resultVoices[lang] = matchedVoices;
        }
      }
    }
    
    return { langs: resultLangs, voices: resultVoices };
  }, [languageCodes, filteredByLanguage, searchQuery]);

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

      {/* Engine filters */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 sm:gap-1" role="tablist" aria-label="Engine filter">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={engineFilter === tab.key}
            onClick={() => setEngineFilter(tab.key)}
            disabled={disabled}
            className={`
              flex w-full items-center justify-center sm:justify-start sm:w-auto gap-1.5 px-3 py-2 sm:py-1.5
              font-sans text-xs font-semibold tracking-wide
              transition-all duration-150
              disabled:cursor-not-allowed disabled:opacity-50
              ${
                engineFilter === tab.key
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "border border-black/10 bg-white text-black/60 hover:bg-black/5 hover:text-black dark:border-white/10 dark:bg-transparent dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
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
                  : "bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}

        {/* Models toggle */}
        <button
          type="button"
          onClick={() => setShowModelManager((v) => !v)}
          className={`
            sm:ml-auto flex w-full items-center justify-center sm:justify-start sm:w-auto gap-1.5 px-2.5 py-2 sm:py-1.5
            font-sans text-xs font-semibold tracking-wide
            transition-all duration-150
            ${
              showModelManager
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "border border-black/10 bg-white text-black/60 hover:bg-black/5 dark:border-white/10 dark:bg-transparent dark:text-white/70 dark:hover:bg-white/10"
            }
          `}
        >
          <Package className="h-3.5 w-3.5" />
          Models
        </button>
      </div>

      {/* Voice dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => !disabled && languageCodes.length > 0 && setIsOpen(!isOpen)}
          className={`
            w-full flex items-center justify-between border bg-gray-50 py-2.5 pl-3 pr-3
            font-sans text-sm text-black
            transition-colors duration-150 text-left
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
          <div className="truncate pr-4 flex-1">
            {(!selectedVoice || !languageCodes.some((lang) => filteredByLanguage[lang]?.some((v) => v.id === selectedVoice))) ? (
              <span className="text-black/60 dark:text-white/60">
                {languageCodes.length === 0
                  ? disabled
                    ? "Loading…"
                    : engineFilter !== "all" && Object.keys(voicesByLanguage).length > 0
                      ? `No ${engineFilter} voices — try a different tab`
                      : "No voices available"
                  : "Select a voice…"}
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <FlagIcon lang={Object.keys(filteredByLanguage).find(l => filteredByLanguage[l]?.some(v => v.id === selectedVoice)) || "en"} />
                <span className="truncate">{formatVoiceOption(selectedVoiceInfo!)}</span>
              </div>
            )}
          </div>
          <ChevronDown
            aria-hidden
            className={`shrink-0 h-4 w-4 text-black/60 dark:text-white/60 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 w-full max-h-88 flex flex-col bg-white dark:bg-bento-bg-dark border border-black/10 dark:border-white/10 shadow-xl py-1">
            <div className="px-2 pb-2 pt-1 shrink-0 z-20 border-b border-black/5 dark:border-white/5">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-black/40 dark:text-white/40" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search voices or languages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs font-sans bg-black/5 dark:bg-white/5 border border-transparent focus:border-black/20 dark:focus:border-white/20 focus:outline-none transition-colors dark:text-white"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    // Keep open on space
                    if (e.key === ' ') e.stopPropagation();
                  }}
                />
              </div>
            </div>
            
            <div className="overflow-y-auto custom-scrollbar flex-1 py-1">
              {filteredLanguagesWithSearch.langs.length === 0 ? (
                <div className="px-4 py-4 text-xs text-black/50 dark:text-white/50 text-center font-sans">
                  No voices match "{searchQuery}"
                </div>
              ) : (
                filteredLanguagesWithSearch.langs.map((lang) => {
                  const voices = filteredLanguagesWithSearch.voices[lang];
                  const label = getLabelForLang(lang);

                  return (
                    <div key={lang} className="mb-1">
                      <div className="px-3 py-1.5 bg-black/5 dark:bg-white/5 sticky top-0 z-10 backdrop-blur-sm flex items-center gap-2 border-y border-black/5 dark:border-white/5 font-sans text-xs font-bold text-black/70 dark:text-white/70 uppercase tracking-wider">
                        <FlagIcon lang={lang} />
                        {label}
                      </div>
                      <div className="py-1">
                        {voices.map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => {
                              onChange(v.id);
                              setIsOpen(false);
                              setSearchQuery("");
                            }}
                            className={`w-full text-left px-4 py-2 font-sans text-sm transition-colors flex items-center justify-between ${
                              selectedVoice === v.id
                                ? "bg-black/5 text-black dark:bg-white/10 dark:text-white font-medium"
                                : "text-black/80 hover:bg-black/5 hover:text-black dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white"
                            }`}
                          >
                            <span className="truncate pr-2">{formatVoiceOption(v)}</span>
                            {selectedVoice === v.id && (
                              <div className="w-1.5 h-1.5 rounded-full bg-black dark:bg-white shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Selected voice info */}
      {selectedVoiceInfo && (
        <div className="mt-1 flex flex-nowrap overflow-x-auto items-center gap-1.5 px-1 pb-1 -mb-1 scrollbar-hide">
          {/* Gender */}
          {selectedVoiceInfo.gender && selectedVoiceInfo.gender !== "mixed" && (
            <span className="inline-flex shrink-0 items-center gap-1 border border-black/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-black/70 dark:border-white/10 dark:text-white/80">
              {selectedVoiceInfo.gender}
            </span>
          )}

          {/* Vibes */}
          {selectedVoiceInfo.vibe?.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex shrink-0 items-center gap-1 border border-black/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-black/70 dark:border-white/10 dark:text-white/80"
            >
              {tag}
            </span>
          ))}
          {selectedVoiceInfo.vibe && selectedVoiceInfo.vibe.length > 3 && (
            <span className="shrink-0 text-[9px] text-black/50 dark:text-white/50">
              +{selectedVoiceInfo.vibe.length - 3}
            </span>
          )}

          {/* Quality */}
          {selectedVoiceInfo.quality && (
            <span className="inline-flex shrink-0 items-center gap-1 border border-black/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-black/70 dark:border-white/10 dark:text-white/80">
              {selectedVoiceInfo.quality}
            </span>
          )}

          {/* Engine */}
          {selectedVoiceInfo.engine && selectedVoiceInfo.engine !== "piper" && (
            <span
              title={
                selectedVoiceInfo.engine === "edge"
                  ? "Fast; no model downloads needed — streams from Microsoft Edge TTS"
                  : selectedVoiceInfo.engine === "mms"
                    ? "Model downloads on first use — Hugging Face MMS-TTS"
                    : undefined
              }
              className="inline-flex shrink-0 items-center gap-1 border border-black/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-black/70 dark:border-white/10 dark:text-white/80"
            >
              {selectedVoiceInfo.engine === "edge" ? "Edge" : selectedVoiceInfo.engine.toUpperCase()}
            </span>
          )}

          {/* Tooltip */}
          {selectedVoiceInfo.description && (
            <span
              title={selectedVoiceInfo.description}
              className="ml-auto cursor-help text-black/50 hover:text-black/70 dark:text-white/50 dark:hover:text-white/80"
            >
              <Info className="h-3 w-3" />
            </span>
          )}
        </div>
      )}

      {/* Model Manager */}
      {showModelManager && (
        <ModelManager onModelChanged={() => onModelChanged?.()} />
      )}
    </div>
  );
}

// Format option name
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

function getLabelForLang(lang: string) {
  const parts = lang.split('-');
  const baseLang = parts[0].toLowerCase();
  const baseLabel = LANG_LABELS[baseLang];
  
  if (!baseLabel) return lang.toUpperCase();
  
  if (parts.length > 1) {
    const region = parts[parts.length - 1].toUpperCase();
    return `${baseLabel} (${region})`;
  }
  return baseLabel;
}
