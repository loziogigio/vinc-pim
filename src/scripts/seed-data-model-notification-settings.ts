/**
 * Seed/migration: notification_settings data model (channel-scoped notification
 * backend config copied from tenant-wide homesettings on first run).
 *
 * Installs the `notification_settings` DataModelDefinition (from the blueprint
 * produced in Task 7) and creates a `default`-channel record whose values are
 * read from the tenant's existing `b2bhomesettings` document
 * (smtp_settings, graph_settings, web_push_settings, fcm_settings).
 *
 * Non-destructive: un-migrated tenants keep working (resolver falls back to
 * homesettings when no channel record exists — Task 8). Running again when a
 * record already exists leaves it untouched unless FORCE=1 is set.
 *
 * Usage:
 *   pnpm tsx src/scripts/seed-data-model-notification-settings.ts <tenantDb>
 *   VINC_TENANT_DB=vinc-acme-it pnpm tsx src/scripts/seed-data-model-notification-settings.ts
 *   FORCE=1 VINC_TENANT_DB=vinc-acme-it pnpm tsx src/scripts/seed-data-model-notification-settings.ts
 */

import "dotenv/config";
import { pathToFileURL } from "node:url";
import { connectWithModels, closeAllConnections } from "@/lib/db/connection";
import { getDataModelRecordModel } from "@/lib/db/model-registry";
import {
  findExternalRefField,
  validateFieldsTree,
  applyChannelRelationDefaults,
  CHANNEL_RELATION_ID,
} from "@/lib/db/models/data-model-definition";
import { validateRecordData } from "@/lib/data-models/validate-record";
import { NOTIFICATION_SETTINGS_BLUEPRINT } from "@/lib/data-models/blueprints/notification-settings";
import { getHomeSettings } from "@/lib/db/home-settings";

// ============================================================================
// Pure mapper — exported for unit testing (no DB access)
// ============================================================================

type HS = Record<string, any>;

/**
 * Flatten a `b2bhomesettings` document into the flat slug map used by
 * `notification_settings` data model records.
 *
 * Rules:
 * - `email_enabled` is true when any SMTP host or Graph client_id is present.
 * - `email_transport` defaults to "graph" when `graph_settings.client_id` is
 *   set and no explicit `email_transport` is stored, otherwise "smtp".
 * - `sms_enabled` defaults to false; `sms_provider` defaults to "brevo".
 * - `webpush_enabled` / `fcm_enabled` mirror the respective `.enabled` flag.
 */
export function homeSettingsToRecord(home: HS): Record<string, unknown> {
  const s = home.smtp_settings ?? {};
  const g = home.graph_settings ?? {};
  const w = home.web_push_settings ?? {};
  const f = home.fcm_settings ?? {};
  const hasEmail = Boolean(s.host || g.client_id);
  return {
    email_enabled: hasEmail,
    email_transport: home.email_transport ?? (g.client_id ? "graph" : "smtp"),
    email_from: s.from,
    email_from_name: s.from_name,
    smtp_host: s.host,
    smtp_port: s.port,
    smtp_secure: s.secure,
    smtp_user: s.user,
    smtp_password: s.password,
    graph_azure_tenant_id: g.azure_tenant_id,
    graph_client_id: g.client_id,
    graph_client_secret: g.client_secret,
    graph_sender_email: g.sender_email,
    graph_sender_name: g.sender_name,
    sms_enabled: false,
    sms_provider: "brevo",
    webpush_enabled: Boolean(w.enabled),
    webpush_vapid_public_key: w.vapid_public_key,
    webpush_vapid_private_key: w.vapid_private_key,
    webpush_vapid_subject: w.vapid_subject,
    webpush_default_icon: w.default_icon,
    webpush_default_badge: w.default_badge,
    fcm_enabled: Boolean(f.enabled),
    fcm_project_id: f.project_id,
    fcm_client_email: f.client_email,
    fcm_private_key: f.private_key,
    fcm_default_icon: f.default_icon,
    fcm_default_color: f.default_color,
  };
}

// ============================================================================
// Script entrypoint
// ============================================================================

const { definition: BLUEPRINT_DEF } = NOTIFICATION_SETTINGS_BLUEPRINT;
const SLUG = BLUEPRINT_DEF.slug;
const FIELDS = BLUEPRINT_DEF.fields;
const DEFAULT_CHANNEL = "default";

async function main() {
  const tenantDb = process.env.VINC_TENANT_DB ?? process.argv[2];
  if (!tenantDb) {
    console.error(
      "Usage: tsx seed-data-model-notification-settings.ts <tenantDb>\n" +
        "       or set VINC_TENANT_DB env var"
    );
    process.exit(1);
  }
  const force = process.env.FORCE === "1";

  // Channel-scoped single-cardinality definition applies to all channels ("*")
  const definition = applyChannelRelationDefaults({ ...BLUEPRINT_DEF, channel: "*" });

  console.log(`\n📋 Seed notification_settings data model`);
  console.log(`   Tenant DB: ${tenantDb}`);
  console.log(`   Slug     : ${SLUG}`);
  console.log(`   Relation : channel (definition channel: "*")`);
  console.log(`   Record   : relation_id="${CHANNEL_RELATION_ID}", channel="${DEFAULT_CHANNEL}"`);
  console.log(`   Force    : ${force}\n`);

  validateFieldsTree(FIELDS);
  const externalRefField = findExternalRefField(FIELDS); // undefined — single cardinality

  // ── Step 1: install / upsert the definition ─────────────────────────────
  const { DataModelDefinition } = await connectWithModels(tenantDb);

  const existing = await DataModelDefinition.findOne({ slug: SLUG });
  if (existing) {
    if (!force) {
      console.log(
        `\n↩️  Definition "${SLUG}" already exists in ${tenantDb} — left untouched ` +
          `(set FORCE=1 to overwrite).`
      );
    } else {
      existing.name = definition.name;
      existing.relation = definition.relation;
      existing.cardinality = definition.cardinality;
      existing.channel = definition.channel;
      existing.fields = FIELDS;
      existing.external_ref_field = externalRefField;
      existing.readable_by_end_user = definition.readable_by_end_user;
      existing.enabled = definition.enabled;
      existing.markModified("fields");
      await existing.save();
      console.log(`\n✏️  Updated existing definition ${existing._id}`);
    }
  } else {
    const created = await DataModelDefinition.create({
      ...definition,
      external_ref_field: externalRefField,
    });
    console.log(`\n✅ Created definition ${created._id}`);
  }

  // ── Step 2: read homesettings + map to record data ───────────────────────
  const homeDoc = await getHomeSettings(tenantDb);
  const rawRecord = homeSettingsToRecord((homeDoc as HS) ?? {});
  const coercedRecord = validateRecordData(rawRecord, FIELDS, { strict: false });

  console.log(`\n   email_enabled : ${coercedRecord.email_enabled ?? false}`);
  console.log(`   webpush_enabled: ${coercedRecord.webpush_enabled ?? false}`);
  console.log(`   fcm_enabled    : ${coercedRecord.fcm_enabled ?? false}`);

  // ── Step 3: upsert the `default`-channel record ──────────────────────────
  const RecordModel = await getDataModelRecordModel(tenantDb, {
    slug: SLUG,
    cardinality: definition.cardinality,
    fields: FIELDS,
    external_ref_field: externalRefField,
  });
  await RecordModel.init();

  const recordFilter = { relation_id: CHANNEL_RELATION_ID, channel: DEFAULT_CHANNEL };
  const existingRecord = await RecordModel.findOne(recordFilter).lean();
  if (existingRecord && !force) {
    console.log(
      `\n↩️  channel="${DEFAULT_CHANNEL}" record already exists — left untouched ` +
        `(set FORCE=1 to reset it).`
    );
  } else {
    await RecordModel.findOneAndUpdate(
      recordFilter,
      {
        $set: {
          relation_id: CHANNEL_RELATION_ID,
          channel: DEFAULT_CHANNEL,
          data: coercedRecord,
          source: "seed",
          imported_at: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    console.log(
      `\n${existingRecord ? "✏️  Reset" : "✅ Created"} channel="${DEFAULT_CHANNEL}" record`
    );
  }

  const count = await RecordModel.estimatedDocumentCount();
  console.log(`\n📦 Collection dyn_${SLUG} ready in ${tenantDb} — ${count} record(s)`);

  await closeAllConnections();
  console.log("\n✨ Done.\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async (err) => {
    console.error("\n💥 Seed failed:", err);
    await closeAllConnections();
    process.exit(1);
  });
}
