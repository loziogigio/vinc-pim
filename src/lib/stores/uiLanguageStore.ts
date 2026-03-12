/**
 * UI Language Store
 * Persists the user's preferred UI language across sessions.
 * Separate from the PIM language store (content editing language).
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UILocale } from "@/lib/i18n";
import { DEFAULT_UI_LOCALE } from "@/lib/i18n";

interface UILanguageStore {
  locale: UILocale;
  setLocale: (locale: UILocale) => void;
}

export const useUILanguageStore = create<UILanguageStore>()(
  persist(
    (set) => ({
      locale: DEFAULT_UI_LOCALE,
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: "ui-language-store",
    }
  )
);
