/**
 * Feed Destination Service — CRUD + secret handling + scheduler upkeep.
 * Secrets: plaintext arrives in *_token / *_json input fields, is stored
 * AES-encrypted in *_encrypted model fields, and reads expose SECRET_MASK.
 */
import { randomBytes } from "crypto";
import { connectWithModels } from "@/lib/db/connection";
import { encrypt } from "@/lib/utils/encryption";
import { SECRET_MASK } from "@/lib/data-models/redact-secrets";
import type { IFeedDestination } from "@/lib/db/models/feed-destination";

export interface FeedDestinationInput {
  type: "google_merchant" | "meta_catalog" | "trovaprezzi";
  name: string;
  channel: string;
  lang: string;
  currency: string;
  product_url_template: string;
  brand_labels?: string[];
  category_ids?: string[];
  in_stock_only?: boolean;
  delta_interval_minutes?: number;
  full_reconcile_hour?: number;
  status?: "active" | "paused";
  google_merchant_account_id?: string;
  google_service_account_json?: string;
  google_data_source?: string;
  meta_catalog_id?: string;
  meta_system_user_token?: string;
  shipping_cost?: number;
  notification_email?: string;
}

const SECRET_INPUTS: [keyof FeedDestinationInput, keyof IFeedDestination][] = [
  ["google_service_account_json", "google_service_account_json_encrypted"],
  ["meta_system_user_token", "meta_system_user_token_encrypted"],
];

/**
 * Allow-list of plain (non-secret) input fields that clients may set.
 * Anything not listed — destination_id, feed_token, *_encrypted, last_run,
 * unknown keys — is silently dropped, blocking mass assignment (e.g. echoing
 * a GET response back on PUT must not rewrite destination_id and orphan
 * FeedRun/FeedItemState rows).
 */
const PLAIN_FIELDS_CREATE: readonly (keyof FeedDestinationInput)[] = [
  "type", "name", "channel", "lang", "currency", "product_url_template",
  "brand_labels", "category_ids", "in_stock_only",
  "delta_interval_minutes", "full_reconcile_hour", "status",
  "google_merchant_account_id", "google_data_source", "meta_catalog_id",
  "shipping_cost", "notification_email",
] as const;

// type is immutable after create (adapters/credentials are type-specific).
const PLAIN_FIELDS_UPDATE: readonly (keyof FeedDestinationInput)[] =
  PLAIN_FIELDS_CREATE.filter((f) => f !== "type");

/**
 * Validate delta_interval_minutes: cron patterns silently drift for values
 * >= 60 that aren't divisible by 60 (see Task 10 review). Accept 5-59
 * (minute-of-hour cron) or a multiple of 60 up to 1440 (hour-of-day cron).
 * Exported so routes can pre-check the request body and return a 400
 * before touching the DB; the service call below is a second line of
 * defense in case a route forgets to call this.
 */
export function validateDeltaIntervalMinutes(value: number | undefined): void {
  if (value === undefined) return;
  const isValid =
    Number.isInteger(value) &&
    ((value >= 5 && value <= 59) ||
      (value >= 60 && value % 60 === 0 && value <= 1440));
  if (!isValid) {
    throw new Error(
      "delta_interval_minutes must be 5-59 or a multiple of 60 (max 1440)"
    );
  }
}

/**
 * Type-specific required-credential check, run at CREATE only. Updates
 * remain partial (PLAIN_FIELDS_UPDATE) so an admin can edit unrelated
 * fields without re-supplying every credential — validating there would
 * make e.g. renaming a destination fail if a secret was never re-typed.
 */
export function validateDestinationConfig(input: FeedDestinationInput): string | null {
  const missing = (value: string | undefined) => !value || !value.trim();

  if (input.type === "google_merchant") {
    const fields: [string, string | undefined][] = [
      ["google_merchant_account_id", input.google_merchant_account_id],
      ["google_service_account_json", input.google_service_account_json],
      ["google_data_source", input.google_data_source],
    ];
    const missingFields = fields.filter(([, v]) => missing(v)).map(([k]) => k);
    if (missingFields.length) {
      return `google_merchant destination requires: ${missingFields.join(", ")}`;
    }
  }

  if (input.type === "meta_catalog") {
    const fields: [string, string | undefined][] = [
      ["meta_catalog_id", input.meta_catalog_id],
      ["meta_system_user_token", input.meta_system_user_token],
    ];
    const missingFields = fields.filter(([, v]) => missing(v)).map(([k]) => k);
    if (missingFields.length) {
      return `meta_catalog destination requires: ${missingFields.join(", ")}`;
    }
  }

  return null;
}

function mask(doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...doc };
  for (const [inputKey, storedKey] of SECRET_INPUTS) {
    if (out[storedKey]) out[inputKey] = SECRET_MASK;
    delete out[storedKey];
  }
  return out;
}

function applySecrets(
  target: Record<string, unknown>,
  input: Partial<FeedDestinationInput>
): void {
  for (const [inputKey, storedKey] of SECRET_INPUTS) {
    const value = input[inputKey];
    if (value === undefined || value === null || value === "" || value === SECRET_MASK) {
      continue; // keep stored ciphertext
    }
    target[storedKey] = encrypt(String(value));
  }
}

function plainFields(
  input: Partial<FeedDestinationInput>,
  allowed: readonly (keyof FeedDestinationInput)[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in input && input[key] !== undefined) out[key] = input[key];
  }
  return out;
}

async function syncSchedules(tenantDb: string, tenantId: string, dest: IFeedDestination) {
  try {
    const { upsertFeedSchedules } = await import("@/lib/queue/feed-sync-schedules");
    await upsertFeedSchedules(tenantDb, tenantId, {
      destination_id: dest.destination_id,
      delta_interval_minutes: dest.delta_interval_minutes,
      full_reconcile_hour: dest.full_reconcile_hour,
      status: dest.status,
    });
  } catch (err) {
    console.error("[feeds] scheduler upsert failed (Redis down?):", err);
  }
}

export async function listDestinations(tenantDb: string) {
  const { FeedDestination } = await connectWithModels(tenantDb);
  const docs = await FeedDestination.find({}).sort({ created_at: -1 }).lean();
  return docs.map((d) => mask(d as Record<string, unknown>));
}

export async function getDestination(tenantDb: string, destinationId: string) {
  const { FeedDestination } = await connectWithModels(tenantDb);
  const doc = await FeedDestination.findOne({ destination_id: destinationId }).lean();
  return doc ? mask(doc as Record<string, unknown>) : null;
}

export async function createDestination(
  tenantDb: string,
  tenantId: string,
  input: FeedDestinationInput
) {
  validateDeltaIntervalMinutes(input.delta_interval_minutes);
  const configError = validateDestinationConfig(input);
  if (configError) throw new Error(configError);
  const { FeedDestination } = await connectWithModels(tenantDb);
  const doc: Record<string, unknown> = {
    ...plainFields(input, PLAIN_FIELDS_CREATE),
    destination_id: `fd_${randomBytes(5).toString("hex")}`,
  };
  applySecrets(doc, input);
  if (input.type === "trovaprezzi") {
    doc.feed_token = randomBytes(24).toString("base64url");
  }
  const created = await FeedDestination.create(doc);
  await syncSchedules(tenantDb, tenantId, created.toObject() as IFeedDestination);
  return mask(created.toObject() as Record<string, unknown>);
}

export async function updateDestination(
  tenantDb: string,
  tenantId: string,
  destinationId: string,
  input: Partial<FeedDestinationInput>
) {
  validateDeltaIntervalMinutes(input.delta_interval_minutes);
  const { FeedDestination } = await connectWithModels(tenantDb);
  const update: Record<string, unknown> = plainFields(input, PLAIN_FIELDS_UPDATE);
  applySecrets(update, input);
  const doc = await FeedDestination.findOneAndUpdate(
    { destination_id: destinationId },
    { $set: update },
    { new: true }
  ).lean();
  if (!doc) return null;
  await syncSchedules(tenantDb, tenantId, doc as unknown as IFeedDestination);
  return mask(doc as Record<string, unknown>);
}

export async function deleteDestination(tenantDb: string, destinationId: string) {
  const { FeedDestination, FeedRun, FeedItemState } = await connectWithModels(tenantDb);
  const res = await FeedDestination.deleteOne({ destination_id: destinationId });
  if (res.deletedCount === 0) return false;
  await FeedItemState.deleteMany({ destination_id: destinationId });
  await FeedRun.deleteMany({ destination_id: destinationId });
  try {
    const { removeFeedSchedules } = await import("@/lib/queue/feed-sync-schedules");
    await removeFeedSchedules(tenantDb, destinationId);
  } catch (err) {
    console.error("[feeds] scheduler removal failed:", err);
  }
  return true;
}

export async function regenerateFeedToken(tenantDb: string, destinationId: string) {
  const { FeedDestination } = await connectWithModels(tenantDb);
  const token = randomBytes(24).toString("base64url");
  const doc = await FeedDestination.findOneAndUpdate(
    { destination_id: destinationId, type: "trovaprezzi" },
    { $set: { feed_token: token } },
    { new: true }
  ).lean();
  return doc ? token : null;
}

export async function listRuns(
  tenantDb: string,
  destinationId: string,
  page = 1,
  limit = 20
) {
  const { FeedRun } = await connectWithModels(tenantDb);
  const query = { destination_id: destinationId };
  const [items, total] = await Promise.all([
    FeedRun.find(query).sort({ started_at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    FeedRun.countDocuments(query),
  ]);
  return { items, total };
}

export async function listItemStates(
  tenantDb: string,
  destinationId: string,
  status: string | undefined,
  page = 1,
  limit = 50
) {
  const { FeedItemState } = await connectWithModels(tenantDb);
  const query: Record<string, unknown> = { destination_id: destinationId };
  if (status) query.remote_status = status;
  const [items, total] = await Promise.all([
    FeedItemState.find(query).sort({ updated_at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    FeedItemState.countDocuments(query),
  ]);
  return { items, total };
}
