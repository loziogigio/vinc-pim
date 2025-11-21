/**
 * Language Management Admin API
 * Comprehensive API for language administration with automatic Solr schema sync
 */

import { Router, Request, Response } from "express";
import { LanguageModel } from "../lib/db/models/language";
import {
  getEnabledLanguages,
  getAllLanguages,
  refreshLanguageCache,
  getLanguageByCode
} from "../services/language.service";
import {
  addLanguageFieldsToSolr,
  removeLanguageFieldsFromSolr,
  ensureSolrFieldType,
  checkSolrCoreHealth
} from "../services/solr-schema.service";

const router = Router();

// ============================================================================
// Language Listing Endpoints
// ============================================================================

/**
 * GET /api/admin/languages
 * Get all languages with filtering and pagination
 */
router.get("/languages", async (req: Request, res: Response) => {
  try {
    const {
      status, // enabled, disabled, all
      search,
      page = 1,
      limit = 50,
      sortBy = "order",
      sortOrder = "asc"
    } = req.query;

    const query: any = {};

    // Filter by enabled/disabled
    if (status === "enabled") {
      query.isEnabled = true;
    } else if (status === "disabled") {
      query.isEnabled = false;
    }

    // Search by code or name
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { nativeName: { $regex: search, $options: "i" } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sort: any = {};
    sort[String(sortBy)] = sortOrder === "desc" ? -1 : 1;

    const [languages, total] = await Promise.all([
      LanguageModel.find(query)
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      LanguageModel.countDocuments(query)
    ]);

    const enabledCount = await LanguageModel.countDocuments({ isEnabled: true });
    const disabledCount = await LanguageModel.countDocuments({ isEnabled: false });

    res.json({
      success: true,
      data: languages,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      },
      stats: {
        total,
        enabled: enabledCount,
        disabled: disabledCount
      }
    });
  } catch (error: any) {
    console.error("Error fetching languages:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch languages",
      message: error.message
    });
  }
});

/**
 * GET /api/admin/languages/stats
 * Get language statistics
 */
router.get("/languages/stats", async (req: Request, res: Response) => {
  try {
    const [total, enabled, disabled, defaultLang] = await Promise.all([
      LanguageModel.countDocuments(),
      LanguageModel.countDocuments({ isEnabled: true }),
      LanguageModel.countDocuments({ isEnabled: false }),
      LanguageModel.findOne({ isDefault: true }).lean()
    ]);

    // Group by direction
    const byDirection = await LanguageModel.aggregate([
      { $group: { _id: "$direction", count: { $sum: 1 } } }
    ]);

    // Group by analyzer
    const byAnalyzer = await LanguageModel.aggregate([
      { $group: { _id: "$solrAnalyzer", count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      stats: {
        total,
        enabled,
        disabled,
        defaultLanguage: defaultLang?.code || "it",
        byDirection: byDirection.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {} as Record<string, number>),
        byAnalyzer: byAnalyzer.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {} as Record<string, number>)
      }
    });
  } catch (error: any) {
    console.error("Error fetching language stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch language statistics",
      message: error.message
    });
  }
});

/**
 * GET /api/admin/languages/:code
 * Get single language details
 */
router.get("/languages/:code", async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const language = await getLanguageByCode(code);

    if (!language) {
      return res.status(404).json({
        success: false,
        error: "Language not found"
      });
    }

    res.json({
      success: true,
      data: language
    });
  } catch (error: any) {
    console.error("Error fetching language:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch language",
      message: error.message
    });
  }
});

// ============================================================================
// Language Enable/Disable Endpoints
// ============================================================================

/**
 * POST /api/admin/languages/:code/enable
 * Enable a language and automatically update Solr schema
 */
router.post("/languages/:code/enable", async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const { syncSolr = true } = req.body;

    // Find language
    const language = await LanguageModel.findOne({ code });
    if (!language) {
      return res.status(404).json({
        success: false,
        error: `Language '${code}' not found`
      });
    }

    // Check if already enabled
    if (language.isEnabled) {
      return res.status(400).json({
        success: false,
        error: `Language '${code}' is already enabled`
      });
    }

    // Enable language
    language.isEnabled = true;
    await language.save();

    // Refresh cache
    await refreshLanguageCache();

    const result: any = {
      success: true,
      message: `Language '${code}' (${language.name}) enabled successfully`,
      language: {
        code: language.code,
        name: language.name,
        nativeName: language.nativeName,
        isEnabled: language.isEnabled
      },
      solrSync: null
    };

    // Sync Solr schema
    if (syncSolr) {
      try {
        console.log(`🔧 Syncing Solr schema for language: ${code}`);

        // Add field type and fields to Solr
        await addLanguageFieldsToSolr(language);

        result.solrSync = {
          success: true,
          message: `Solr schema updated for ${code}`,
          fieldsAdded: [
            `name_text_${code}`,
            `description_text_${code}`,
            `features_text_${code}`,
            `seo_title_text_${code}`,
            `seo_description_text_${code}`
          ]
        };

        console.log(`✅ Solr schema updated successfully for ${code}`);
      } catch (solrError: any) {
        console.error(`❌ Solr sync failed for ${code}:`, solrError);
        result.solrSync = {
          success: false,
          error: "Failed to update Solr schema",
          message: solrError.message
        };
        result.warning = "Language enabled in database but Solr schema update failed";
      }
    }

    res.json(result);
  } catch (error: any) {
    console.error("Error enabling language:", error);
    res.status(500).json({
      success: false,
      error: "Failed to enable language",
      message: error.message
    });
  }
});

/**
 * POST /api/admin/languages/:code/disable
 * Disable a language (cannot disable Italian or default language)
 */
router.post("/languages/:code/disable", async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const { removeSolrFields = false } = req.body;

    // Find language
    const language = await LanguageModel.findOne({ code });
    if (!language) {
      return res.status(404).json({
        success: false,
        error: `Language '${code}' not found`
      });
    }

    // Check if already disabled
    if (!language.isEnabled) {
      return res.status(400).json({
        success: false,
        error: `Language '${code}' is already disabled`
      });
    }

    // Prevent disabling Italian
    if (code === "it") {
      return res.status(400).json({
        success: false,
        error: "Cannot disable Italian (it) - it's the required default language"
      });
    }

    // Prevent disabling default language
    if (language.isDefault) {
      return res.status(400).json({
        success: false,
        error: `Cannot disable default language '${code}'`
      });
    }

    // Disable language
    language.isEnabled = false;
    await language.save();

    // Refresh cache
    await refreshLanguageCache();

    const result: any = {
      success: true,
      message: `Language '${code}' (${language.name}) disabled successfully`,
      language: {
        code: language.code,
        name: language.name,
        isEnabled: language.isEnabled
      },
      solrSync: null
    };

    // Optionally remove Solr fields
    if (removeSolrFields) {
      try {
        console.log(`🔧 Removing Solr fields for language: ${code}`);
        await removeLanguageFieldsFromSolr(language);

        result.solrSync = {
          success: true,
          message: `Solr fields removed for ${code}`,
          fieldsRemoved: [
            `name_text_${code}`,
            `description_text_${code}`,
            `features_text_${code}`
          ]
        };

        console.log(`✅ Solr fields removed successfully for ${code}`);
      } catch (solrError: any) {
        console.error(`❌ Solr field removal failed for ${code}:`, solrError);
        result.solrSync = {
          success: false,
          error: "Failed to remove Solr fields",
          message: solrError.message
        };
        result.warning = "Language disabled in database but Solr field removal failed";
      }
    }

    res.json(result);
  } catch (error: any) {
    console.error("Error disabling language:", error);
    res.status(500).json({
      success: false,
      error: "Failed to disable language",
      message: error.message
    });
  }
});

/**
 * POST /api/admin/languages/enable-multiple
 * Enable multiple languages at once
 */
router.post("/languages/enable-multiple", async (req: Request, res: Response) => {
  try {
    const { codes, syncSolr = true } = req.body;

    if (!Array.isArray(codes) || codes.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Please provide an array of language codes"
      });
    }

    const results = [];
    const errors = [];

    for (const code of codes) {
      try {
        const language = await LanguageModel.findOne({ code });

        if (!language) {
          errors.push({ code, error: "Language not found" });
          continue;
        }

        if (language.isEnabled) {
          errors.push({ code, error: "Already enabled" });
          continue;
        }

        // Enable language
        language.isEnabled = true;
        await language.save();

        const result: any = {
          code,
          name: language.name,
          enabled: true,
          solrSync: null
        };

        // Sync Solr
        if (syncSolr) {
          try {
            await addLanguageFieldsToSolr(language);
            result.solrSync = { success: true };
          } catch (solrError: any) {
            result.solrSync = {
              success: false,
              error: solrError.message
            };
          }
        }

        results.push(result);
      } catch (error: any) {
        errors.push({ code, error: error.message });
      }
    }

    // Refresh cache once at the end
    await refreshLanguageCache();

    res.json({
      success: true,
      message: `Enabled ${results.length} language(s)`,
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error("Error enabling multiple languages:", error);
    res.status(500).json({
      success: false,
      error: "Failed to enable languages",
      message: error.message
    });
  }
});

/**
 * POST /api/admin/languages/disable-multiple
 * Disable multiple languages at once
 */
router.post("/languages/disable-multiple", async (req: Request, res: Response) => {
  try {
    const { codes, removeSolrFields = false } = req.body;

    if (!Array.isArray(codes) || codes.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Please provide an array of language codes"
      });
    }

    // Check if trying to disable Italian
    if (codes.includes("it")) {
      return res.status(400).json({
        success: false,
        error: "Cannot disable Italian (it) - it's the required default language"
      });
    }

    const results = [];
    const errors = [];

    for (const code of codes) {
      try {
        const language = await LanguageModel.findOne({ code });

        if (!language) {
          errors.push({ code, error: "Language not found" });
          continue;
        }

        if (!language.isEnabled) {
          errors.push({ code, error: "Already disabled" });
          continue;
        }

        if (language.isDefault) {
          errors.push({ code, error: "Cannot disable default language" });
          continue;
        }

        // Disable language
        language.isEnabled = false;
        await language.save();

        const result: any = {
          code,
          name: language.name,
          disabled: true,
          solrSync: null
        };

        // Remove Solr fields
        if (removeSolrFields) {
          try {
            await removeLanguageFieldsFromSolr(language);
            result.solrSync = { success: true };
          } catch (solrError: any) {
            result.solrSync = {
              success: false,
              error: solrError.message
            };
          }
        }

        results.push(result);
      } catch (error: any) {
        errors.push({ code, error: error.message });
      }
    }

    // Refresh cache once at the end
    await refreshLanguageCache();

    res.json({
      success: true,
      message: `Disabled ${results.length} language(s)`,
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error("Error disabling multiple languages:", error);
    res.status(500).json({
      success: false,
      error: "Failed to disable languages",
      message: error.message
    });
  }
});

// ============================================================================
// Cache Management
// ============================================================================

/**
 * POST /api/admin/languages/refresh-cache
 * Manually refresh language cache
 */
router.post("/languages/refresh-cache", async (req: Request, res: Response) => {
  try {
    await refreshLanguageCache();
    const enabledLanguages = await getEnabledLanguages();

    res.json({
      success: true,
      message: "Language cache refreshed successfully",
      enabledLanguages: enabledLanguages.length,
      languages: enabledLanguages.map(l => ({
        code: l.code,
        name: l.name,
        isDefault: l.isDefault
      }))
    });
  } catch (error: any) {
    console.error("Error refreshing cache:", error);
    res.status(500).json({
      success: false,
      error: "Failed to refresh cache",
      message: error.message
    });
  }
});

// ============================================================================
// Solr Sync Endpoints
// ============================================================================

/**
 * POST /api/admin/languages/:code/sync-solr
 * Manually sync Solr schema for a specific language
 */
router.post("/languages/:code/sync-solr", async (req: Request, res: Response) => {
  try {
    const { code } = req.params;

    const language = await LanguageModel.findOne({ code });
    if (!language) {
      return res.status(404).json({
        success: false,
        error: `Language '${code}' not found`
      });
    }

    if (!language.isEnabled) {
      return res.status(400).json({
        success: false,
        error: `Language '${code}' is not enabled`
      });
    }

    console.log(`🔧 Syncing Solr schema for language: ${code}`);

    // Ensure field type exists
    await ensureSolrFieldType(language);

    // Add language fields
    await addLanguageFieldsToSolr(language);

    res.json({
      success: true,
      message: `Solr schema synced successfully for ${code}`,
      language: {
        code: language.code,
        name: language.name,
        analyzer: language.solrAnalyzer
      },
      fieldsCreated: [
        `name_text_${code}`,
        `description_text_${code}`,
        `features_text_${code}`,
        `seo_title_text_${code}`,
        `seo_description_text_${code}`
      ]
    });
  } catch (error: any) {
    console.error("Error syncing Solr schema:", error);
    res.status(500).json({
      success: false,
      error: "Failed to sync Solr schema",
      message: error.message
    });
  }
});

/**
 * POST /api/admin/languages/sync-all-solr
 * Sync Solr schema for all enabled languages
 */
router.post("/languages/sync-all-solr", async (req: Request, res: Response) => {
  try {
    const enabledLanguages = await getEnabledLanguages();

    console.log(`🔧 Syncing Solr schema for ${enabledLanguages.length} enabled languages...`);

    const results = [];
    const errors = [];

    for (const language of enabledLanguages) {
      try {
        await ensureSolrFieldType(language);
        await addLanguageFieldsToSolr(language);

        results.push({
          code: language.code,
          name: language.name,
          success: true
        });

        console.log(`✅ ${language.code} synced`);
      } catch (error: any) {
        errors.push({
          code: language.code,
          error: error.message
        });
        console.error(`❌ ${language.code} failed:`, error.message);
      }
    }

    res.json({
      success: true,
      message: `Synced ${results.length} language(s) to Solr`,
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error("Error syncing all languages to Solr:", error);
    res.status(500).json({
      success: false,
      error: "Failed to sync languages to Solr",
      message: error.message
    });
  }
});

/**
 * GET /api/admin/languages/solr-health
 * Check Solr core health
 */
router.get("/languages/solr-health", async (req: Request, res: Response) => {
  try {
    const health = await checkSolrCoreHealth();

    res.json({
      success: true,
      health
    });
  } catch (error: any) {
    console.error("Error checking Solr health:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check Solr health",
      message: error.message
    });
  }
});

export default router;
