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

/** Sentinel param value for "products with no channel assigned". */
export const UNTAGGED_CHANNEL_PARAM = "__untagged__";

/**
 * Apply a sales-channel filter to a product query in place.
 * - falsy channel        → no-op (all channels)
 * - UNTAGGED_CHANNEL_PARAM → products with no/empty channels array
 * - any code             → products whose channels array contains it
 *
 * Uses `$and` so it never clobbers an existing `$or` (e.g. text search).
 */
export function applyChannelFilter(
  query: Record<string, any>,
  channel?: string | null
): void {
  if (!channel) return;
  const clause =
    channel === UNTAGGED_CHANNEL_PARAM
      ? { $or: [{ channels: { $exists: false } }, { channels: { $size: 0 } }] }
      : { channels: channel };
  query.$and = [...((query.$and as unknown[]) ?? []), clause];
}
