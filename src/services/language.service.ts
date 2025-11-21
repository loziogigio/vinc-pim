/**
 * Language Service
 * Database-driven language configuration
 * Replaces static config with DB queries + caching
 */

import { LanguageModel, ILanguage } from "../lib/db/models/language";

// In-memory cache to avoid DB queries on every request
let languageCache: ILanguage[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Refresh language cache from database
 */
export const refreshLanguageCache = async (): Promise<void> => {
  try {
    languageCache = await LanguageModel.find({ isEnabled: true })
      .sort({ order: 1 })
      .lean();
    cacheTimestamp = Date.now();
  } catch (error) {
    console.error("Failed to refresh language cache:", error);
    throw error;
  }
};

/**
 * Get all enabled languages from cache (or DB if cache expired)
 */
export const getEnabledLanguages = async (): Promise<ILanguage[]> => {
  const now = Date.now();

  // Refresh cache if expired or empty
  if (!languageCache || now - cacheTimestamp > CACHE_TTL) {
    await refreshLanguageCache();
  }

  return languageCache || [];
};

/**
 * Get all enabled language codes
 */
export const getLanguageCodes = async (): Promise<string[]> => {
  const languages = await getEnabledLanguages();
  return languages.map(lang => lang.code);
};

/**
 * Get default language
 */
export const getDefaultLanguage = async (): Promise<ILanguage | null> => {
  const languages = await getEnabledLanguages();
  return languages.find(lang => lang.isDefault) || languages[0] || null;
};

/**
 * Get language by code
 */
export const getLanguageByCode = async (code: string): Promise<ILanguage | null> => {
  const languages = await getEnabledLanguages();
  return languages.find(lang => lang.code === code) || null;
};

/**
 * Check if language code is valid
 */
export const isValidLanguageCode = async (code: string): Promise<boolean> => {
  const codes = await getLanguageCodes();
  return codes.includes(code);
};

/**
 * Get all languages (including disabled) - for admin UI
 */
export const getAllLanguages = async (): Promise<ILanguage[]> => {
  return await LanguageModel.find().sort({ order: 1 }).lean();
};

/**
 * Create new language
 */
export const createLanguage = async (data: Partial<ILanguage>): Promise<ILanguage> => {
  const language = new LanguageModel(data);
  await language.save();
  await refreshLanguageCache(); // Refresh cache
  return language;
};

/**
 * Update language
 */
export const updateLanguage = async (
  code: string,
  data: Partial<ILanguage>
): Promise<ILanguage | null> => {
  const language = await LanguageModel.findOneAndUpdate(
    { code },
    { $set: { ...data, updated_at: new Date() } },
    { new: true }
  );

  if (language) {
    await refreshLanguageCache(); // Refresh cache
  }

  return language;
};

/**
 * Enable/disable language
 */
export const setLanguageEnabled = async (
  code: string,
  enabled: boolean
): Promise<boolean> => {
  const result = await LanguageModel.updateOne(
    { code },
    { $set: { isEnabled: enabled, updated_at: new Date() } }
  );

  if (result.modifiedCount > 0) {
    await refreshLanguageCache(); // Refresh cache
    return true;
  }

  return false;
};

/**
 * Delete language (soft delete - just disable)
 */
export const deleteLanguage = async (code: string): Promise<boolean> => {
  // Don't allow deleting the default language
  const language = await LanguageModel.findOne({ code });
  if (language?.isDefault) {
    throw new Error("Cannot delete the default language");
  }

  return await setLanguageEnabled(code, false);
};

/**
 * Set default language
 */
export const setDefaultLanguage = async (code: string): Promise<boolean> => {
  const language = await LanguageModel.findOne({ code });
  if (!language) {
    throw new Error(`Language ${code} not found`);
  }

  // Update all languages: remove default from others, set on this one
  await LanguageModel.updateMany({}, { $set: { isDefault: false } });
  await LanguageModel.updateOne({ code }, { $set: { isDefault: true } });

  await refreshLanguageCache(); // Refresh cache
  return true;
};

/**
 * Initialize cache on application start
 */
export const initializeLanguageCache = async (): Promise<void> => {
  console.log("Initializing language cache...");
  await refreshLanguageCache();
  console.log(`Language cache initialized with ${languageCache?.length || 0} languages`);
};
