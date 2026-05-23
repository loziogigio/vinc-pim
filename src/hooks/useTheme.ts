"use client";

import { useEffect, useLayoutEffect, useState } from "react";

export type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "vinc-theme";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const getSystemTheme = (): ThemeMode => {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const getStoredTheme = (): ThemeMode | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return null;
};

const applyThemeToDocument = (theme: ThemeMode) => {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
};

/**
 * Light/dark theme controller. Reads the persisted preference (localStorage
 * key `vinc-theme`), falls back to the system preference, and keeps the `dark`
 * class on `<html>` in sync. The no-flash initial paint is handled by the
 * inline script in the root layout (src/app/layout.tsx); this hook owns
 * runtime toggling and reactive system-preference changes.
 */
export const useTheme = () => {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [hasStoredPreference, setHasStoredPreference] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const storedTheme = getStoredTheme();

    if (storedTheme) {
      setTheme(storedTheme);
      setHasStoredPreference(true);
      applyThemeToDocument(storedTheme);
    } else {
      const systemTheme = getSystemTheme();
      setTheme(systemTheme);
      applyThemeToDocument(systemTheme);
    }

    setInitialized(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (event: MediaQueryListEvent) => {
      if (hasStoredPreference) {
        return;
      }

      const nextTheme = event.matches ? "dark" : "light";
      setTheme(nextTheme);
      applyThemeToDocument(nextTheme);
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [hasStoredPreference]);

  const persistTheme = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    applyThemeToDocument(nextTheme);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    }

    setHasStoredPreference(true);
  };

  const toggle = () => {
    persistTheme(theme === "dark" ? "light" : "dark");
  };

  const useSystemPreference = () => {
    const systemTheme = getSystemTheme();
    setHasStoredPreference(false);

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    }

    setTheme(systemTheme);
    applyThemeToDocument(systemTheme);
  };

  return { theme, isDark: theme === "dark", toggle, useSystemPreference, initialized };
};
