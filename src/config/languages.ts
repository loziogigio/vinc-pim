/**
 * Dynamic Language Configuration
 * Add/remove languages here without changing the schema
 */

export interface LanguageConfig {
  code: string;           // ISO 639-1 code (e.g., "it", "de", "en")
  name: string;           // Display name (e.g., "Italian", "Deutsch")
  nativeName: string;     // Native name (e.g., "Italiano", "Deutsch")
  isDefault: boolean;     // Is this the default/fallback language?
  isEnabled: boolean;     // Is this language currently active?
  solrAnalyzer: string;   // Solr field type (e.g., "text_it", "text_de")
  direction: "ltr" | "rtl"; // Text direction
  dateFormat?: string;    // Date format for this language
  numberFormat?: string;  // Number format for this language
}

export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  {
    code: "it",
    name: "Italian",
    nativeName: "Italiano",
    isDefault: true,
    isEnabled: true,
    solrAnalyzer: "text_it",
    direction: "ltr",
    dateFormat: "DD/MM/YYYY",
    numberFormat: "it-IT"
  },
  {
    code: "de",
    name: "German",
    nativeName: "Deutsch",
    isDefault: false,
    isEnabled: true,
    solrAnalyzer: "text_de",
    direction: "ltr",
    dateFormat: "DD.MM.YYYY",
    numberFormat: "de-DE"
  },
  {
    code: "en",
    name: "English",
    nativeName: "English",
    isDefault: false,
    isEnabled: true,
    solrAnalyzer: "text_en",
    direction: "ltr",
    dateFormat: "MM/DD/YYYY",
    numberFormat: "en-US"
  },
  {
    code: "cs",
    name: "Czech",
    nativeName: "Čeština",
    isDefault: false,
    isEnabled: true,
    solrAnalyzer: "text_general",
    direction: "ltr",
    dateFormat: "DD.MM.YYYY",
    numberFormat: "cs-CZ"
  },
  // Easy to add new languages:
  // {
  //   code: "fr",
  //   name: "French",
  //   nativeName: "Français",
  //   isDefault: false,
  //   isEnabled: true,
  //   solrAnalyzer: "text_fr",
  //   direction: "ltr",
  //   dateFormat: "DD/MM/YYYY",
  //   numberFormat: "fr-FR"
  // }
];

// Helper functions
export const getEnabledLanguages = (): LanguageConfig[] => {
  return SUPPORTED_LANGUAGES.filter(lang => lang.isEnabled);
};

export const getLanguageCodes = (): string[] => {
  return getEnabledLanguages().map(lang => lang.code);
};

export const getDefaultLanguage = (): LanguageConfig => {
  return SUPPORTED_LANGUAGES.find(lang => lang.isDefault) || SUPPORTED_LANGUAGES[0];
};

export const getLanguageByCode = (code: string): LanguageConfig | undefined => {
  return SUPPORTED_LANGUAGES.find(lang => lang.code === code && lang.isEnabled);
};

export const isValidLanguageCode = (code: string): boolean => {
  return getLanguageCodes().includes(code);
};

// Type helpers
export type SupportedLanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];
export type MultilingualText = Partial<Record<string, string>>;
