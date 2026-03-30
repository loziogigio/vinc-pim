import { safeRegexQuery } from "@/lib/security";
import { connectWithModels } from "@/lib/db/connection";

/**
 * Build $or conditions for searching products across multilingual name fields,
 * SKU, entity_code, parent_sku, and parent_entity_code.
 *
 * Fetches enabled language codes from the database so language keys are never hardcoded.
 */
export async function buildProductSearchConditions(
  search: string,
  tenantDb: string
): Promise<Record<string, unknown>[]> {
  const safeSearch = safeRegexQuery(search);

  // Fetch enabled languages dynamically
  const { Language: LanguageModel } = await connectWithModels(tenantDb);
  const languages = (await LanguageModel.find({ isEnabled: true })
    .select("code")
    .lean()) as { code: string }[];
  const langCodes = languages.map((l) => l.code);

  return [
    // Multilingual name: name.it, name.en, name.sk, etc.
    ...langCodes.map((code) => ({ [`name.${code}`]: safeSearch })),
    // Plain string name (legacy fallback)
    { name: safeSearch },
    // Identifiers
    { sku: safeSearch },
    { entity_code: safeSearch },
    { parent_sku: safeSearch },
    { parent_entity_code: safeSearch },
  ];
}
