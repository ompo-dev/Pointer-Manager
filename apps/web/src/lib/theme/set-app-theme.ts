"use client";

type AppTheme = "light" | "dark";
type ThemeSetter = (theme: string) => void;
type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => {
    finished: Promise<void>;
  };
};

const THEME_TRANSITION_CLASS = "theme-changing";
const THEME_TRANSITION_DURATION_MS = 220;

export function setAppTheme(theme: AppTheme, setTheme: ThemeSetter) {
  if (typeof document === "undefined") {
    setTheme(theme);
    return;
  }

  const root = document.documentElement;
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const doc = document as DocumentWithViewTransition;

  root.classList.add(THEME_TRANSITION_CLASS);

  if (!prefersReducedMotion && typeof doc.startViewTransition === "function") {
    const transition = doc.startViewTransition(() => {
      setTheme(theme);
    });

    void transition.finished.finally(() => {
      root.classList.remove(THEME_TRANSITION_CLASS);
    });

    return;
  }

  setTheme(theme);

  window.setTimeout(() => {
    root.classList.remove(THEME_TRANSITION_CLASS);
  }, THEME_TRANSITION_DURATION_MS);
}
