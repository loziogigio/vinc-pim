/**
 * Language Service
 * Read-only language helpers for script/CLI contexts (e.g. batch-product-update).
 *
 * NOTE: The running web app does NOT use this module for language data — it reads
 * languages per-tenant via the API + `languageStore` (client) and
 * `tenant-languages.ts` (server). This service is bound to Mongoose's default
 * connection, which only scripts/tests connect via `mongoose.connect()`.
 */

import type { Model } from "mongoose";
import { LanguageModel, ILanguage } from "../lib/db/models/language";

// In-memory cache to avoid DB queries on every call within a script run.
let languageCache: ILanguage[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Refresh language cache from database.
 *
 * @param model - Language model to query. REQUIRED — there is no default, on
 *   purpose: the default-import `LanguageModel` is bound to Mongoose's default
 *   connection, which the running app never connects (it uses per-tenant
 *   `createConnection` pools), so querying it buffers and times out after 10s.
 *   Scripts/tests (which call `mongoose.connect()`) pass the default `LanguageModel`.
 */
export const refreshLanguageCache = async (
  model: Model<ILanguage>
): Promise<void> => {
  try {
    languageCache = await model.find({ isEnabled: true })
      .sort({ order: 1 })
      .lean();
    cacheTimestamp = Date.now();
  } catch (error) {
    console.error("Failed to refresh language cache:", error);
    throw error;
  }
};

/**
 * Get all enabled languages from cache (or DB if cache expired).
 */
export const getEnabledLanguages = async (): Promise<ILanguage[]> => {
  const now = Date.now();

  // Refresh cache if expired or empty
  if (!languageCache || now - cacheTimestamp > CACHE_TTL) {
    await refreshLanguageCache(LanguageModel);
  }

  return languageCache || [];
};

/**
 * Get all languages (including disabled).
 */
export const getAllLanguages = async (): Promise<ILanguage[]> => {
  return await LanguageModel.find().sort({ order: 1 }).lean();
};
