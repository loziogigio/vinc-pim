/**
 * Shared Synonym Dictionary Types
 * Used for product search synonym management
 *
 * Synonym dictionaries group related search terms under a single key.
 * Products reference dictionaries by key, enabling flexible search matching.
 */

// Base synonym dictionary fields
export interface SynonymDictionaryBase {
  dictionary_id: string;
  key: string;                    // Unique per locale (e.g., "climatizzatore")
  description?: string;           // Optional description
  terms: string[];                // Array of synonyms
  locale: string;                 // Language code: "it", "en", etc.
  is_active?: boolean;
  product_count?: number;
  display_order?: number;
}

// Synonym dictionary reference (minimal for product embedding)
export interface SynonymDictionaryReference {
  dictionary_id: string;
  key: string;
  locale: string;
}

// Full synonym dictionary document (with metadata)
export interface SynonymDictionaryDocument extends SynonymDictionaryBase {
  is_active: boolean;
  product_count: number;
  display_order: number;
  created_at: Date;
  updated_at: Date;
}

// Autocomplete suggestion result
export interface SynonymAutocompleteSuggestion {
  term: string;                   // Matched term
  key: string;                    // Dictionary key
  dictionary_id: string;          // For reference
  locale: string;
}
