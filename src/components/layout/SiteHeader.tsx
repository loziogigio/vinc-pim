"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Menu, Moon, Sun, ShoppingCart, ChevronLeft, ChevronRight, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMockCategories } from "@/lib/data/mockCatalog";

const categories = getMockCategories();

type ThemeMode = "light" | "dark";

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

const useTheme = () => {
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

export const SiteHeader = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isDark, toggle, initialized } = useTheme();
  const listRef = useRef<HTMLDivElement | null>(null);
  const isAdminRoute = pathname?.startsWith("/admin");
  const isEmbeddedPreview = pathname === "/preview" && searchParams?.get("embed") === "true";
  if (isAdminRoute || isEmbeddedPreview) {
    return null;
  }

  const scrollBy = (delta: number) => {
    listRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-screen-xl items-center gap-3 px-4 py-3 md:px-6">
        <Button variant="ghost" size="icon" className="rounded-xl">
          <Menu />
        </Button>
        <div className="flex items-center gap-2">
          <Store className="text-primary" />
          <span className="text-lg font-semibold">VIC Store</span>
        </div>
        <div className="hidden flex-1 items-center gap-2 md:flex">
          <div className="relative w-full">
            <Input placeholder="Search products…" className="rounded-xl pl-9" />
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={toggle}
            aria-pressed={isDark}
            disabled={!initialized}
            aria-label="Toggle color theme"
          >
            {isDark ? <Sun /> : <Moon />}
          </Button>
          <Button variant="default" size="icon" className="rounded-xl">
            <ShoppingCart />
          </Button>
        </div>
      </div>
      <div className="relative mx-auto max-w-screen-xl">
        <button
          aria-label="Scroll categories left"
          onClick={() => scrollBy(-240)}
          className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border bg-background/80 p-1 shadow md:flex"
        >
          <ChevronLeft size={18} />
        </button>
        <div
          ref={listRef}
          className="no-scrollbar flex gap-3 overflow-x-auto px-4 py-3 scroll-smooth md:px-6"
        >
          {categories.map((category) => (
            <button
              key={category.id}
              className="flex items-center gap-3 rounded-2xl border bg-card px-3 py-2 shadow-sm transition-colors hover:bg-accent"
            >
              <img src={category.image} alt={category.name} className="h-8 w-12 rounded-xl object-cover" />
              <span className="text-sm font-medium whitespace-nowrap md:text-[15px]">
                {category.name}
              </span>
            </button>
          ))}
        </div>
        <button
          aria-label="Scroll categories right"
          onClick={() => scrollBy(240)}
          className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border bg-background/80 p-1 shadow md:flex"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </header>
  );
};
