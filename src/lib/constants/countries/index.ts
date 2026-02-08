/**
 * Country Configuration Registry
 *
 * Pluggable system: add a country by importing its config and adding to COUNTRY_CONFIGS.
 */

import { IT_CONFIG } from "./it";
import { SK_CONFIG } from "./sk";
import type {
  CountryConfig,
  CountryLabels,
  SupportedLanguage,
  VatRateConfig,
  FiscalIdFieldConfig,
} from "./types";

export type {
  CountryConfig,
  CountryLabels,
  SupportedLanguage,
  VatRateConfig,
  FiscalIdFieldConfig,
} from "./types";

/** Registry of all supported country configs */
export const COUNTRY_CONFIGS: Record<string, CountryConfig> = {
  IT: IT_CONFIG,
  SK: SK_CONFIG,
};

/** All supported country codes */
export const SUPPORTED_COUNTRIES = Object.keys(COUNTRY_CONFIGS);

/** Default country code (backwards compat) */
export const DEFAULT_COUNTRY_CODE = "IT";

/** Default language (backwards compat) */
export const DEFAULT_LANGUAGE: SupportedLanguage = "it";

/**
 * Get country config by ISO code. Falls back to IT if not found.
 */
export function getCountryConfig(countryCode: string): CountryConfig {
  return COUNTRY_CONFIGS[countryCode.toUpperCase()] || COUNTRY_CONFIGS.IT;
}

/**
 * Get labels for a country + language combination.
 * Falls back: unknown language → country primary, unknown country → IT Italian.
 */
export function getLabels(countryCode: string, language?: SupportedLanguage): CountryLabels {
  const config = getCountryConfig(countryCode);
  const lang = language && config.labels[language] ? language : config.primary_language;
  return config.labels[lang]!;
}

/**
 * Get VAT rates for a country.
 */
export function getVatRates(countryCode: string): VatRateConfig[] {
  return getCountryConfig(countryCode).vat_rates;
}

/**
 * Get fiscal ID field definitions for a country.
 */
export function getFiscalIdFields(countryCode: string): FiscalIdFieldConfig[] {
  return getCountryConfig(countryCode).fiscal_id_fields;
}

/**
 * Check if a country code is supported.
 */
export function isCountrySupported(countryCode: string): boolean {
  return countryCode.toUpperCase() in COUNTRY_CONFIGS;
}

/**
 * Get the formatting locale string for a country + language.
 */
export function getLocale(countryCode: string, language?: SupportedLanguage): string {
  return getLabels(countryCode, language).locale;
}
