import { getDataModelRecordModel } from "@/lib/db/model-registry";
import { CHANNEL_RELATION_ID } from "@/lib/db/models/data-model-definition";
import { NOTIFICATION_SETTINGS_BLUEPRINT } from "@/lib/data-models/blueprints/notification-settings";
import { getHomeSettings } from "@/lib/db/home-settings";

/**
 * Read the channel-scoped `notification_settings` dynamic record for the
 * given tenant DB and sales-channel code.  Returns `null` when no record
 * has been seeded for that channel (unknown channel → safe fallback).
 */
export async function readNotificationRecord(
  tenantDb: string,
  channelCode: string,
): Promise<{ data: Record<string, unknown> } | null> {
  const def = NOTIFICATION_SETTINGS_BLUEPRINT.definition;
  const RecordModel = await getDataModelRecordModel(tenantDb, {
    slug: def.slug,
    cardinality: def.cardinality,
    fields: def.fields,
    external_ref_field: undefined,
  });
  const rec = await RecordModel.findOne({
    relation_id: CHANNEL_RELATION_ID,
    channel: channelCode,
  }).lean();
  return rec
    ? { data: (rec as { data?: Record<string, unknown> }).data ?? {} }
    : null;
}

/**
 * Read the tenant's `b2bhomesettings` document (the tenant-wide fallback for
 * notification transport config such as smtp_settings, graph_settings, etc.).
 */
export async function readHomeSettings(
  tenantDb: string,
): Promise<Record<string, unknown>> {
  const doc = await getHomeSettings(tenantDb);
  return (doc as unknown as Record<string, unknown>) ?? {};
}
