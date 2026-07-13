/**
 * Server-side loader for Feature 1 (per-channel user-attribute search exclusion).
 *
 * Loads the channel's catalog_settings `user_exclusion_rules`, loads the
 * customer, and resolves each enabled rule to a concrete { solr_field, value }
 * exclusion. Guests (no customer_code) and unscoped requests (no channel) yield
 * no exclusions. Mirrors resolveEffectiveTagsForSearch in route.ts.
 */

import { connectWithModels } from "@/lib/db/connection";
import { getDataModelRecordModel } from "@/lib/db/model-registry";
import { CHANNEL_RELATION_ID } from "@/lib/db/models/data-model-definition";
import { CATALOG_SETTINGS_BLUEPRINT } from "@/lib/data-models/blueprints/catalog-settings";
import { resolveUserExclusions, type UserExclusionRule } from "@/lib/search/user-exclusions";
import type { UserExclusion } from "@/lib/types/search";

export async function loadUserExclusionsForSearch(
  tenantDb: string,
  channel?: string,
  customerCode?: string,
  addressCode?: string,
): Promise<UserExclusion[]> {
  // Guests and unscoped requests: no per-user exclusion.
  if (!channel || !customerCode) return [];

  const def = CATALOG_SETTINGS_BLUEPRINT.definition;
  const RecordModel = await getDataModelRecordModel(tenantDb, {
    slug: def.slug,
    cardinality: def.cardinality,
    fields: def.fields,
    external_ref_field: undefined,
  });
  const rec = (await RecordModel.findOne({
    relation_id: CHANNEL_RELATION_ID,
    channel,
  }).lean()) as { data?: { user_exclusion_rules?: UserExclusionRule[] } } | null;

  const rules = rec?.data?.user_exclusion_rules ?? [];
  if (!rules.length) return [];

  const { Customer } = await connectWithModels(tenantDb);
  const customer = (await Customer.findOne(
    {
      $or: [
        { external_code: customerCode },
        { customer_id: customerCode },
      ],
    },
    { addresses: 1 },
  ).lean()) as { addresses?: Array<{ address_id?: string; external_code?: string; country?: string; is_default?: boolean }> } | null;

  if (!customer) return [];
  return resolveUserExclusions(rules, customer, addressCode);
}
