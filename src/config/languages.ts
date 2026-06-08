// Types only — runtime language data is per-tenant (the `languages` collection
// via tenant-languages.ts / the languageStore).

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

// Type helpers
export type SupportedLanguageCode = string;
export type MultilingualText = Partial<Record<string, string>>;
