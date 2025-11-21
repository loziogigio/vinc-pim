/**
 * Language Store
 * Global state management for language selection in PIM
 * Dynamically fetches enabled languages from API
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  isDefault: boolean;
  isEnabled: boolean;
  direction: "ltr" | "rtl";
  flag?: string;
}

interface LanguageStore {
  // Current selected language for editing
  currentLanguage: string;

  // All languages from database
  languages: Language[];

  // Loading state
  isLoading: boolean;

  // Show/hide reference language box
  showReferenceLanguage: boolean;

  // Actions
  setCurrentLanguage: (languageCode: string) => void;
  setShowReferenceLanguage: (show: boolean) => void;
  fetchLanguages: () => Promise<void>;
  getEnabledLanguages: () => Language[];
  getLanguageByCode: (code: string) => Language | undefined;
  isLanguageEnabled: (code: string) => boolean;
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set, get) => ({
      currentLanguage: "it", // Default to Italian
      languages: [],
      isLoading: false,
      showReferenceLanguage: true, // Show by default

      setCurrentLanguage: (languageCode) => {
        const language = get().getLanguageByCode(languageCode);
        if (language && language.isEnabled) {
          set({ currentLanguage: languageCode });
        }
      },

      setShowReferenceLanguage: (show) => {
        set({ showReferenceLanguage: show });
      },

      fetchLanguages: async () => {
        set({ isLoading: true });
        try {
          const response = await fetch("/api/admin/languages?status=enabled&limit=100");
          const data = await response.json();

          if (data.success && Array.isArray(data.data)) {
            const languages: Language[] = data.data.map((lang: any) => ({
              code: lang.code,
              name: lang.name,
              nativeName: lang.nativeName,
              isDefault: lang.isDefault,
              isEnabled: lang.isEnabled,
              direction: lang.direction || "ltr",
              flag: lang.flag,
            }));

            set({ languages, isLoading: false });

            // If current language is not enabled, switch to default or first enabled
            const current = get().currentLanguage;
            const currentLang = languages.find(l => l.code === current);

            if (!currentLang || !currentLang.isEnabled) {
              const defaultLang = languages.find(l => l.isDefault && l.isEnabled);
              const firstEnabled = languages.find(l => l.isEnabled);
              const fallback = defaultLang || firstEnabled;

              if (fallback) {
                set({ currentLanguage: fallback.code });
              }
            }
          } else {
            set({ isLoading: false });
          }
        } catch (error) {
          console.error("Failed to fetch languages:", error);
          set({ isLoading: false });
        }
      },

      getEnabledLanguages: () => {
        return get().languages.filter(lang => lang.isEnabled);
      },

      getLanguageByCode: (code) => {
        return get().languages.find(lang => lang.code === code);
      },

      isLanguageEnabled: (code) => {
        const language = get().getLanguageByCode(code);
        return language ? language.isEnabled : false;
      },
    }),
    {
      name: "pim-language-store",
      partialize: (state) => ({
        // Only persist current language and reference visibility, not the full languages array
        currentLanguage: state.currentLanguage,
        showReferenceLanguage: state.showReferenceLanguage,
      }),
    }
  )
);
