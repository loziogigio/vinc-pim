/**
 * Language Validation Middleware
 * Validates that only enabled languages are used in requests
 * For multitenant SaaS - no restart needed when languages are enabled/disabled
 */

import { Request, Response, NextFunction } from "express";
import { getEnabledLanguages } from "../services/language.service";

/**
 * Validate multilingual fields in request body
 * Strips out disabled languages and warns about them
 */
export async function validateLanguages(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const enabledLanguages = await getEnabledLanguages();
    const enabledCodes = new Set(enabledLanguages.map(l => l.code));

    // Fields that should be multilingual
    const multilingualFields = [
      "name",
      "description",
      "shortDescription",
      "technicalData",
      "features",
      "seoTitle",
      "seoDescription",
      "seoKeywords",
    ];

    const warnings: string[] = [];
    const body = req.body;

    // Check each multilingual field
    for (const field of multilingualFields) {
      if (body[field] && typeof body[field] === "object") {
        const providedLanguages = Object.keys(body[field]);

        for (const lang of providedLanguages) {
          if (!enabledCodes.has(lang)) {
            warnings.push(
              `Language '${lang}' in field '${field}' is not enabled and will be ignored`
            );
            // Remove disabled language from request
            delete body[field][lang];
          }
        }
      }
    }

    // Attach warnings to request for logging
    if (warnings.length > 0) {
      (req as any).languageWarnings = warnings;
    }

    next();
  } catch (error) {
    console.error("Error validating languages:", error);
    next(); // Continue anyway, let Mongoose validation handle it
  }
}

/**
 * Filter multilingual fields in response
 * Only return enabled languages to clients
 */
export async function filterResponseLanguages(data: any): Promise<any> {
  const enabledLanguages = await getEnabledLanguages();
  const enabledCodes = new Set(enabledLanguages.map(l => l.code));

  if (Array.isArray(data)) {
    return Promise.all(data.map(item => filterResponseLanguages(item)));
  }

  if (data && typeof data === "object") {
    const filtered: any = { ...data };

    // Common multilingual field names
    const multilingualFields = [
      "name",
      "description",
      "shortDescription",
      "technicalData",
      "features",
      "seoTitle",
      "seoDescription",
      "seoKeywords",
    ];

    for (const field of multilingualFields) {
      if (filtered[field] && typeof filtered[field] === "object") {
        const fieldData = filtered[field];
        const filteredField: any = {};

        for (const lang of Object.keys(fieldData)) {
          if (enabledCodes.has(lang)) {
            filteredField[lang] = fieldData[lang];
          }
        }

        filtered[field] = filteredField;
      }
    }

    return filtered;
  }

  return data;
}

/**
 * Middleware to filter response languages
 */
export function filterLanguagesMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const originalJson = res.json.bind(res);

  res.json = async function (data: any) {
    const filtered = await filterResponseLanguages(data);
    return originalJson(filtered);
  };

  next();
}
