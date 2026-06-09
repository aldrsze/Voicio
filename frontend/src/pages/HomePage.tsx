import { useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Globe } from "lucide-react";
import { useVoices } from "../hooks/useVoices";
import * as Flags from 'country-flag-icons/string/3x2';

import { hasFlag } from 'country-flag-icons';

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
const langNames = new Intl.DisplayNames(['en'], { type: 'language' });

const langToCountry: Record<string, string> = {
  en: 'US', es: 'ES', fr: 'FR', de: 'DE', it: 'IT', pt: 'PT', ru: 'RU',
  zh: 'CN', ja: 'JP', ko: 'KR', ar: 'SA', hi: 'IN', nl: 'NL', tr: 'TR',
  pl: 'PL', sv: 'SE', da: 'DK', fi: 'FI', no: 'NO', cs: 'CZ', el: 'GR',
  hu: 'HU', ro: 'RO', sk: 'SK', uk: 'UA', vi: 'VN', th: 'TH', id: 'ID',
  ms: 'MY', bg: 'BG', hr: 'HR', sr: 'RS', sl: 'SI', et: 'EE', lv: 'LV',
  lt: 'LT', ca: 'ES', eu: 'ES', gl: 'ES', fil: 'PH', fa: 'IR', he: 'IL',
  ur: 'PK', bn: 'BD', sw: 'KE', ta: 'IN', te: 'IN', mr: 'IN', gu: 'IN',
  kn: 'IN', ml: 'IN', pa: 'IN', am: 'ET', is: 'IS', kk: 'KZ', mk: 'MK',
  cy: 'GB', ga: 'IE', af: 'ZA', sq: 'AL', hy: 'AM', az: 'AZ', ka: 'GE', tl: 'PH'
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

function getCountryName(lang: string) {
  const parts = lang.split(/[-_]/);
  if (parts.length > 1) {
    try {
      return regionNames.of(parts[1].toUpperCase());
    } catch {}
  }
  try {
    return langNames.of(parts[0]);
  } catch {}
  return lang;
}

export function HomePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { languages, byLanguage, loading } = useVoices();

  return (
    <main className="mx-auto mt-0 md:mt-6 max-w-5xl px-4 pb-16 sm:px-6 lg:px-8 overflow-hidden">
      {/* Hero */}
      <section 
        id="hero"
        className="animate-in mb-8 md:mb-24 pb-24 md:pb-0 flex flex-col md:flex-row items-center justify-center gap-4 sm:gap-8 md:gap-12 min-h-[calc(100svh-8rem)]"
        style={{ "--delay": "50ms" } as React.CSSProperties}
      >
        <div className="w-full flex flex-row items-center justify-between md:contents gap-2 sm:gap-4">
          <div className="flex-[1.5] md:flex-1 text-left flex flex-col justify-center relative z-10 shrink-0 min-w-0">
            <h2 className="mb-4 sm:mb-6 font-sans text-3xl sm:text-5xl md:text-7xl font-extrabold tracking-tighter text-black dark:text-white leading-tight">
              Give Your <br className="sm:hidden" />Text a <span className="text-black/40 dark:text-white/40">Voice.</span>
            </h2>
            <p className="mb-2 md:mb-8 max-w-2xl font-sans text-xs sm:text-lg md:text-xl text-black/60 dark:text-white/60 leading-relaxed">
              Voicio is a fast, completely local Text-to-Speech synthesizer running entirely in your browser.
            </p>
            {/* Desktop Actions */}
            <div className="hidden md:flex flex-row gap-3">
              <Link 
                to="/app"
                className="bg-black px-6 sm:px-8 py-3 text-center font-sans text-[11px] sm:text-sm font-semibold text-white transition-transform hover:scale-[1.02] dark:bg-white dark:text-black"
              >
                Start Generating
              </Link>
              <button 
                onClick={() => setIsModalOpen(true)} 
                className="border border-black/20 bg-transparent px-6 sm:px-8 py-3 font-sans text-[11px] sm:text-sm font-semibold text-black transition-colors hover:bg-black/5 dark:border-white/20 dark:text-white dark:hover:bg-white/5 cursor-pointer text-center"
              >
                Available Languages
              </button>
            </div>
          </div>
          <div className="flex-1 flex justify-end items-center pointer-events-none">
            <img 
              src="/cat_standing.png" 
              alt="Voicio Cat Mascot" 
              className="w-32 sm:w-48 md:w-full max-w-30 sm:max-w-xs md:max-w-none h-auto object-contain scale-[1.2] sm:scale-100 md:scale-[0.8] md:translate-x-5 origin-right" 
            />
          </div>
        </div>

        {/* Mobile Actions */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:hidden mt-2">
          <Link 
            to="/app"
            className="bg-black px-6 sm:px-8 py-3.5 text-center font-sans text-[11px] sm:text-sm font-semibold text-white transition-transform hover:scale-[1.02] dark:bg-white dark:text-black"
          >
            Start Generating
          </Link>
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="border border-black/20 bg-transparent px-6 sm:px-8 py-3.5 font-sans text-[11px] sm:text-sm font-semibold text-black transition-colors hover:bg-black/5 dark:border-white/20 dark:text-white dark:hover:bg-white/5 cursor-pointer text-center"
          >
            Available Languages
          </button>
        </div>
      </section>

      {/* Features */}
      <section 
        id="features" 
        className="animate-in mb-24 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        style={{ "--delay": "150ms" } as React.CSSProperties}
      >
        <div className="flex flex-col border border-black/10 bg-white p-6 sm:col-span-2 dark:border-white/10 dark:bg-bento-bg-dark hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
          <h3 className="mb-3 font-sans text-xl font-bold">100% Local Processing</h3>
          <p className="font-sans text-sm text-black/60 dark:text-white/60">
            Your data never leaves your device. Everything runs directly in your browser using WebAssembly. No API keys, no subscriptions, and complete privacy guaranteed.
          </p>
        </div>
        <div className="flex flex-col border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-bento-bg-dark hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
          <h3 className="mb-3 font-sans text-xl font-bold">Lightning Fast</h3>
          <p className="font-sans text-sm text-black/60 dark:text-white/60">
            Powered by highly optimized ONNX runtimes, Voicio synthesizes speech faster than real-time on almost any modern device.
          </p>
        </div>
        <div className="flex flex-col border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-bento-bg-dark hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
          <h3 className="mb-3 font-sans text-xl font-bold">Multi-Language</h3>
          <p className="font-sans text-sm text-black/60 dark:text-white/60">
            Support for dozens of languages and regional accents. Switch seamlessly between them on the fly.
          </p>
        </div>
        <div className="flex flex-col border border-black/10 bg-white p-6 sm:col-span-2 dark:border-white/10 dark:bg-bento-bg-dark hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
          <h3 className="mb-3 font-sans text-xl font-bold">Bring Your Own Models</h3>
          <p className="font-sans text-sm text-black/60 dark:text-white/60">
            Import custom Piper TTS models with a single click. Expand your voice library infinitely with community-trained models.
          </p>
        </div>
        <div className="flex flex-col border border-black/10 bg-white p-6 sm:col-span-2 lg:col-span-3 dark:border-white/10 dark:bg-bento-bg-dark hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
          <h3 className="mb-3 font-sans text-xl font-bold">A free tool for everyone.</h3>
          <p className="font-sans text-sm text-black/60 dark:text-white/60">
            Voicio is strictly non-commercial and entirely free. Built with passion by a solo developer, Aldrsze, to bring local text-to-speech directly to your browser.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-32 border-t border-black/10 pt-8 pb-8 dark:border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="font-sans text-[11px] text-black/40 dark:text-white/40">
          © {new Date().getFullYear()} Built by Aldrsze. Free for everyone.
        </p>
        <div className="flex gap-6 font-sans text-[11px] text-black/60 dark:text-white/60">
          <a href="https://github.com/aldrsze" target="_blank" rel="noreferrer" className="hover:text-black dark:hover:text-white transition-colors">GitHub</a>
          <a href="https://aldrsze.is-pinoy.dev/" target="_blank" rel="noreferrer" className="hover:text-black dark:hover:text-white transition-colors">Dev Website</a>
          <Link to="/app" className="hover:text-black dark:hover:text-white transition-colors">TTS</Link>
        </div>
      </footer>
      {/* Languages Modal */}
      {isModalOpen && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-white/95 dark:bg-black/95 sm:bg-white/80 sm:dark:bg-black/80 sm:backdrop-blur-sm overflow-hidden"
          style={{ WebkitTransform: "translateZ(0)" } as React.CSSProperties}
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="w-full max-w-7xl h-full max-h-[calc(100svh-2rem)] sm:max-h-[calc(100svh-6rem)] bg-white dark:bg-bento-bg-dark border border-black/10 dark:border-white/10 shadow-2xl flex flex-col animate-in" 
            style={{ "--delay": "0ms" } as React.CSSProperties}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 border-b border-black/10 dark:border-white/10 flex justify-between items-center shrink-0">
              <h2 className="font-sans text-lg sm:text-2xl font-bold tracking-tight truncate pr-4">Available Languages</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white text-2xl leading-none cursor-pointer shrink-0 ml-2"
              >
                &times;
              </button>
            </div>
            <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar flex-1 min-h-0">
              {loading ? (
                <p className="font-sans text-black/60 dark:text-white/60">Fetching language database...</p>
              ) : languages.length === 0 ? (
                <p className="font-sans text-black/60 dark:text-white/60">No languages currently loaded or backend offline.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                  {languages.map((lang) => {
                    const countryCode = getCountryCode(lang);
                    const flagSvgString = countryCode ? ((Flags as any)[countryCode] || (Flags as any).default?.[countryCode]) : null;
                    const encodedSvg = flagSvgString ? `data:image/svg+xml;utf8,${encodeURIComponent(flagSvgString)}` : null;
                    const name = getCountryName(lang);
                    return (
                      <div key={lang} className="flex flex-col items-center justify-center gap-2 p-3 sm:p-4 border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                        {encodedSvg ? (
                          <div className="shrink-0 shadow-sm border border-black/10 dark:border-white/10 overflow-hidden rounded-sm flex items-center justify-center">
                            <img src={encodedSvg} alt={name} title={name} className="block object-cover" style={{ width: '32px', height: '22px' }} loading="lazy" />
                          </div>
                        ) : (
                          <Globe className="shrink-0 w-5 h-5 text-black/40 dark:text-white/40 stroke-[2.5]" />
                        )}
                        <div className="flex flex-col items-center justify-center min-w-0 text-center">
                          <span className="font-sans text-[10px] sm:text-xs font-semibold truncate leading-tight">{name}</span>
                          <span className="font-sans text-[8px] sm:text-[9px] text-black/40 dark:text-white/40 truncate leading-tight">{byLanguage[lang].length} voice{byLanguage[lang].length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </main>
  );
}

