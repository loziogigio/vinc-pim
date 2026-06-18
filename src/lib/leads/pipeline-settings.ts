import { getDataModelRecordModel } from "@/lib/db/model-registry";
import { CHANNEL_RELATION_ID } from "@/lib/db/models/data-model-definition";
import { PIPELINE_SETTINGS_FIELDS } from "@/lib/data-models/blueprints/pipeline-settings";

/**
 * Effective selling-machine pipeline config. Sourced from the dynamic
 * `pipeline_settings` data-model record (admin-editable) with per-field ENV
 * fallback. The pipeline tenant itself is bootstrap-only (VINC_PIPELINE_TENANT_ID).
 */
export interface PipelineSettings {
  twentyBaseUrl: string;
  twentyApiKey: string;
  twentyWebhookSecret: string;
  rudderstackWriteKey: string;
  rudderstackDataPlaneUrl: string;
}

export const TWENTY_BASE_DEFAULT = "https://vinc.crm.vendereincloud.it";

/** Phase 1: static config from env — the fallback when no dynamic record exists. */
export function pipelineSettingsFromEnv(): PipelineSettings {
  return {
    twentyBaseUrl: (process.env.VINC_TWENTY_BASE_URL || TWENTY_BASE_DEFAULT).trim(),
    twentyApiKey: (process.env.VINC_TWENTY_API_KEY || "").trim(),
    twentyWebhookSecret: (process.env.VINC_TWENTY_WEBHOOK_SECRET || "").trim(),
    rudderstackWriteKey: (process.env.RUDDERSTACK_WRITE_KEY || "").trim(),
    rudderstackDataPlaneUrl: (process.env.RUDDERSTACK_DATAPLANE_URL || "").trim(),
  };
}

/**
 * Phase 2 (pure): overlay a `pipeline_settings` record's data on top of env.
 * A record field wins only when it is a non-empty string; otherwise env stands.
 */
export function mapPipelineSettings(
  data: Record<string, unknown>,
  env: PipelineSettings = pipelineSettingsFromEnv()
): PipelineSettings {
  const pick = (v: unknown, fb: string): string => {
    const s = v == null ? "" : String(v).trim();
    return s || fb;
  };
  return {
    twentyBaseUrl: pick(data.twenty_base_url, env.twentyBaseUrl),
    twentyApiKey: pick(data.twenty_api_key, env.twentyApiKey),
    twentyWebhookSecret: pick(data.twenty_webhook_secret, env.twentyWebhookSecret),
    rudderstackWriteKey: pick(data.rudderstack_write_key, env.rudderstackWriteKey),
    rudderstackDataPlaneUrl: pick(data.rudderstack_dataplane_url, env.rudderstackDataPlaneUrl),
  };
}

let _cache: { at: number; val: PipelineSettings } | null = null;
const TTL_MS = 60_000;

/** Clear the in-memory cache (tests / after an admin edit). */
export function clearPipelineSettingsCache(): void {
  _cache = null;
}

/**
 * Phase 3 (seam): effective settings = the dynamic record (in the
 * VINC_PIPELINE_TENANT_ID tenant DB, channel VINC_PIPELINE_CHANNEL || "default")
 * overlaid on env, per-field. Returns env when the bootstrap tenant id is unset
 * or the read fails (never throws — the pipeline must stay safe-by-default).
 * Cached for 60s to avoid a DB read per event.
 */
export async function resolvePipelineSettings(opts?: { force?: boolean }): Promise<PipelineSettings> {
  const env = pipelineSettingsFromEnv();
  const tenantId = process.env.VINC_PIPELINE_TENANT_ID;
  if (!tenantId) return env;
  if (!opts?.force && _cache && Date.now() - _cache.at < TTL_MS) return _cache.val;
  try {
    const RecordModel = await getDataModelRecordModel(`vinc-${tenantId}`, {
      slug: "pipeline_settings",
      cardinality: "single",
      fields: PIPELINE_SETTINGS_FIELDS,
      external_ref_field: undefined,
    });
    const channel = process.env.VINC_PIPELINE_CHANNEL || "default";
    const rec = (await RecordModel.findOne({ relation_id: CHANNEL_RELATION_ID, channel }).lean()) as
      | { data?: Record<string, unknown> }
      | null;
    const val = mapPipelineSettings(rec?.data ?? {}, env);
    _cache = { at: Date.now(), val };
    return val;
  } catch {
    return env;
  }
}
