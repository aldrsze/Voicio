import { Outlet, Link } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

export function Layout() {
  const { theme, toggleTheme } = useTheme();

  const handleFeaturesClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (window.location.pathname === '/') {
      const el = document.getElementById('features');
      if (el) {
        e.preventDefault();
        const isMobile = window.innerWidth < 768;
        const targetPosition = isMobile
          ? el.getBoundingClientRect().top + window.scrollY - 180 // Top alignment with taller mobile header offset
          : el.getBoundingClientRect().top + window.scrollY - (window.innerHeight / 2) + (el.offsetHeight / 2); // Centered for desktop
        
        const startPosition = window.scrollY;
        const distance = targetPosition - startPosition;
        const duration = 1200; // 1.2s slow scroll
        let start: number | null = null;
        
        const animation = (currentTime: number) => {
          if (start === null) start = currentTime;
          const timeElapsed = currentTime - start;
          let t = timeElapsed / (duration / 2);
          let run = t < 1 
            ? (distance / 2) * t * t + startPosition 
            : (-distance / 2) * (--t * (t - 2) - 1) + startPosition;
          
          window.scrollTo(0, run);
          if (timeElapsed < duration) requestAnimationFrame(animation);
          else window.history.pushState(null, '', '/#features');
        };
        requestAnimationFrame(animation);
      }
    }
  };

  return (
    <div className="min-h-svh bg-white text-black dark:bg-black dark:text-white">
      <header
        className="sticky top-0 z-40 w-full bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-black/10 dark:border-white/10"
        style={{ "--delay": "0ms" } as React.CSSProperties}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-2">
          <div className="animate-in flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden bg-transparent">
              <img src="/cat.png" alt="Voicio Logo" className="h-full w-full object-contain scale-[0.9]" />
            </div>
            <div>
              <h1 className="font-sans text-2xl font-bold tracking-tight leading-8">
                Voicio
              </h1>
              <p className="font-sans text-xs text-black/60 dark:text-white/70">
                Multi-language Text-to-Speech
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-6">
            <nav className="hidden sm:flex items-center gap-6 font-sans text-sm font-semibold text-black/60 dark:text-white/60">
              <Link to="/app" className="hover:text-black dark:hover:text-white transition-colors">TTS</Link>
              <a 
                href="/#features" 
                onClick={handleFeaturesClick}
                className="hover:text-black dark:hover:text-white transition-colors"
              >
                Features
              </a>
              <a href="https://github.com/aldrsze" target="_blank" rel="noreferrer" className="hover:text-black dark:hover:text-white transition-colors">Github</a>
            </nav>
            
            {/* Dark mode toggle */}
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center border border-black/10 bg-white text-sm hover:bg-black/5 dark:border-white/10 dark:bg-transparent dark:text-white dark:hover:bg-white/10"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
          </div>
          </div>
          
          {/* Mobile Navigation */}
          <nav className="flex sm:hidden flex-row items-center justify-center gap-6 pt-3 pb-2 mt-2 border-t border-black/5 dark:border-white/5 font-sans text-xs font-semibold text-black/60 dark:text-white/60">
            <Link to="/app" className="hover:text-black dark:hover:text-white transition-colors">TTS</Link>
            <a 
              href="/#features" 
              onClick={handleFeaturesClick}
              className="hover:text-black dark:hover:text-white transition-colors"
            >
              Features
            </a>
            <a href="https://github.com/aldrsze" target="_blank" rel="noreferrer" className="hover:text-black dark:hover:text-white transition-colors">Github</a>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
