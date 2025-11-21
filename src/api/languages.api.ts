/**
 * Language Management API
 * REST endpoints for managing languages in the PIM system
 */

import { Request, Response, Router } from "express";
import {
  getAllLanguages,
  getEnabledLanguages,
  getLanguageByCode,
  createLanguage,
  updateLanguage,
  setLanguageEnabled,
  setDefaultLanguage,
  refreshLanguageCache,
} from "../services/language.service";
import { addLanguageFieldsToSolr, syncSolrSchemaWithLanguages } from "../services/solr-schema.service";
import { LanguageModel } from "../lib/db/models/language";

const router = Router();

/**
 * GET /api/languages
 * Get all languages (for admin) or enabled languages (for frontend)
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { includeDisabled } = req.query;

    const languages = includeDisabled === "true"
      ? await getAllLanguages()
      : await getEnabledLanguages();

    res.json({
      success: true,
      data: languages,
      count: languages.length,
    });
  } catch (error) {
    console.error("Error fetching languages:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch languages",
    });
  }
});

/**
 * GET /api/languages/:code
 * Get specific language by code
 */
router.get("/:code", async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const language = await getLanguageByCode(code);

    if (!language) {
      return res.status(404).json({
        success: false,
        error: `Language '${code}' not found`,
      });
    }

    res.json({
      success: true,
      data: language,
    });
  } catch (error) {
    console.error("Error fetching language:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch language",
    });
  }
});

/**
 * POST /api/languages
 * Create new language
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const language = await createLanguage(req.body);

    res.status(201).json({
      success: true,
      data: language,
      message: `Language '${language.code}' created successfully`,
    });
  } catch (error: any) {
    console.error("Error creating language:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: "Language code already exists",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to create language",
    });
  }
});

/**
 * PUT /api/languages/:code
 * Update language
 */
router.put("/:code", async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const language = await updateLanguage(code, req.body);

    if (!language) {
      return res.status(404).json({
        success: false,
        error: `Language '${code}' not found`,
      });
    }

    res.json({
      success: true,
      data: language,
      message: `Language '${code}' updated successfully`,
    });
  } catch (error) {
    console.error("Error updating language:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update language",
    });
  }
});

/**
 * PATCH /api/languages/:code/enable
 * Enable/disable language
 */
router.patch("/:code/enable", async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const { enabled, updateSolr = true } = req.body;

    const success = await setLanguageEnabled(code, enabled);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: `Language '${code}' not found`,
      });
    }

    // Update Solr schema if language was enabled
    if (enabled && updateSolr) {
      try {
        const language = await LanguageModel.findOne({ code });
        if (language) {
          await addLanguageFieldsToSolr(language);
        }
      } catch (solrError: any) {
        console.error("Error updating Solr schema:", solrError);
        return res.json({
          success: true,
          message: `Language '${code}' ${enabled ? "enabled" : "disabled"} in database, but Solr update failed`,
          warning: "You may need to sync Solr schema manually using /api/languages/sync-solr",
        });
      }
    }

    res.json({
      success: true,
      message: `Language '${code}' ${enabled ? "enabled" : "disabled"} successfully`,
      note: "Changes are live immediately - no restart needed",
    });
  } catch (error) {
    console.error("Error toggling language:", error);
    res.status(500).json({
      success: false,
      error: "Failed to toggle language",
    });
  }
});

/**
 * PATCH /api/languages/:code/set-default
 * Set language as default
 */
router.patch("/:code/set-default", async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    await setDefaultLanguage(code);

    res.json({
      success: true,
      message: `Language '${code}' set as default`,
    });
  } catch (error: any) {
    console.error("Error setting default language:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to set default language",
    });
  }
});

/**
 * POST /api/languages/refresh-cache
 * Manually refresh language cache
 */
router.post("/refresh-cache", async (req: Request, res: Response) => {
  try {
    await refreshLanguageCache();

    res.json({
      success: true,
      message: "Language cache refreshed successfully",
    });
  } catch (error) {
    console.error("Error refreshing cache:", error);
    res.status(500).json({
      success: false,
      error: "Failed to refresh cache",
    });
  }
});

/**
 * POST /api/languages/sync-solr
 * Sync Solr schema with all enabled languages
 */
router.post("/sync-solr", async (req: Request, res: Response) => {
  try {
    const enabledLanguages = await LanguageModel.find({ isEnabled: true });

    if (enabledLanguages.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No enabled languages found",
      });
    }

    await syncSolrSchemaWithLanguages(enabledLanguages);

    res.json({
      success: true,
      message: `Solr schema synced successfully for ${enabledLanguages.length} languages`,
      languages: enabledLanguages.map(l => ({ code: l.code, name: l.name })),
    });
  } catch (error: any) {
    console.error("Error syncing Solr schema:", error);
    res.status(500).json({
      success: false,
      error: "Failed to sync Solr schema",
      details: error.message,
    });
  }
});

export default router;
