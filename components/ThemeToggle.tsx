"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function resolveInitial(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem("raven-theme");
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

/** Dawn/night watch toggle. Persists to localStorage; flips `.dark` on <html>. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initial = resolveInitial();
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
    setMounted(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      window.localStorage.setItem("raven-theme", next);
    } catch {
      /* private mode — theme just won't persist */
    }
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to dawn watch" : "Switch to night watch"}
      title={theme === "dark" ? "Dawn watch" : "Night watch"}
      className={`inline-flex items-center gap-1.5 rounded-lg border-2 border-(--raven-ink) bg-(--raven-card) px-3 py-2 font-mono text-[11px] font-black uppercase tracking-widest text-(--raven-ink) shadow-[2px_2px_0_rgba(var(--raven-shadow),0.15)] transition-all hover:-translate-y-px active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${className}`}
    >
      {/* Render the icon only after mount so SSR and first paint agree. */}
      {mounted && theme === "dark" ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 13.2A8.2 8.2 0 0 1 10.8 4 8.2 8.2 0 1 0 20 13.2Z" />
        </svg>
      )}
      {mounted ? (theme === "dark" ? "Day" : "Night") : "···"}
    </button>
  );
}
