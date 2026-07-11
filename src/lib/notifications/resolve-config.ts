import { recordToConfig, type NotificationChannelConfig } from "vinc-notifications";
import { getEmailConfigFromEnv } from "@/lib/email/env-config";
import { readNotificationRecord, readHomeSettings } from "./resolve-config-io";

// ============================================
// CACHE
// ============================================

const DEFAULT_CHANNEL = "default";
const TTL_MS = 60_000;
const cache = new Map<string, { cfg: NotificationChannelConfig; at: number }>();

function cacheKey(tenantDb: string, channel: string): string {
  return `${tenantDb}::${channel}`;
}

/**
 * Invalidate cache entries.
 * - No args: wipe the whole cache (test seam / process restart).
 * - tenantDb only: wipe all channels for that tenant (e.g. on tenant settings save).
 * - tenantDb + channel: invalidate a single (tenant, channel) entry (e.g. post per-channel save).
 */
export function clearNotificationConfigCache(tenantDb?: string, channel?: string): void {
  if (!tenantDb) {
    cache.clear();
    return;
  }
  if (!channel) {
    for (const k of cache.keys()) {
      if (k.startsWith(`${tenantDb}::`)) cache.delete(k);
    }
    return;
  }
  cache.delete(cacheKey(tenantDb, channel));
}

// ============================================
// FALLBACK HELPERS
// ============================================

function emailEmpty(e?: NotificationChannelConfig["email"]): boolean {
  return !e || !e.enabled || (!e.smtp?.host && !e.graph?.azureTenantId);
}

function webPushEmpty(w?: NotificationChannelConfig["webPush"]): boolean {
  return !w || !w.enabled || !w.vapidPublicKey || !w.vapidPrivateKey;
}

function mobilePushEmpty(m?: NotificationChannelConfig["mobilePush"]): boolean {
  return !m || !m.enabled || !m.projectId || !m.clientEmail || !m.privateKey;
}

// ============================================
// RESOLVER
// ============================================

/**
 * Resolve the effective `NotificationChannelConfig` for a tenant + channel:
 *
 * 1. Read the `dyn_notification_settings` record (keyed by channel code).
 * 2. Per-delivery-channel fallback to `b2bhomesettings` fields
 *    (`smtp_settings`, `graph_settings`, `web_push_settings`, `fcm_settings`).
 * 3. Final email fallback to `getEmailConfigFromEnv()` (env vars).
 *
 * Never throws — unknown channels or missing records are treated as "use defaults".
 * Results are cached for 60 s per `(tenantDb, channelCode)` key.
 */
export async function resolveNotificationConfig(
  tenantDb: string,
  channelCode: string = DEFAULT_CHANNEL,
): Promise<NotificationChannelConfig> {
  const k = cacheKey(tenantDb, channelCode);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.cfg;

  // Step 1 — dynamic record (unknown channel → null, never throws)
  const rec = await readNotificationRecord(tenantDb, channelCode).catch(() => null);
  let cfg = recordToConfig(channelCode, rec?.data ?? {});

  // Step 2 — tenant-wide homesettings as fallback source
  const home = await readHomeSettings(tenantDb).catch(() => ({}) as Record<string, unknown>);

  // Email fallback
  if (emailEmpty(cfg.email)) {
    const s = (home.smtp_settings as Record<string, unknown>) ?? {};
    const g = (home.graph_settings as Record<string, unknown>) ?? {};
    const env = getEmailConfigFromEnv();
    cfg = {
      ...cfg,
      email: {
        enabled: true,
        transport:
          (home.email_transport as "smtp" | "graph") ??
          (g.client_id ? "graph" : "smtp"),
        from: (s.from as string) ?? undefined,
        fromName: (s.from_name as string) ?? undefined,
        smtp: {
          host: (s.host as string) ?? env.host,
          port: (s.port as number) ?? env.port,
          secure: (s.secure as boolean) ?? env.secure,
          user: (s.user as string) ?? env.user,
          // `||` not `??`: an empty-string homesettings password must fall through
          // to env (matches the secret-backfill below); `??` would keep the "".
          password: (s.password as string) || env.password,
        },
        graph: g.client_id
          ? {
              azureTenantId: g.azure_tenant_id as string,
              clientId: g.client_id as string,
              clientSecret: g.client_secret as string,
              senderEmail: g.sender_email as string,
              senderName: g.sender_name as string,
              saveToSentItems: g.save_to_sent_items as boolean,
            }
          : undefined,
      },
    };
  }

  // Email secret backfill — a migrated record can carry the host/user but not the
  // secret (e.g. tenants whose SMTP key lives in env, not in the record or homesettings).
  // emailEmpty() above treats a host-bearing block as "complete", so without this the
  // mere presence of a record would suppress the homesettings/env fallback and silently
  // break sends. Record-supplied secrets always win (only empty ones are backfilled).
  if (cfg.email?.enabled) {
    const s = (home.smtp_settings as Record<string, unknown>) ?? {};
    const g = (home.graph_settings as Record<string, unknown>) ?? {};
    if (cfg.email.smtp && !cfg.email.smtp.password) {
      cfg.email.smtp.password =
        (s.password as string) || getEmailConfigFromEnv().password || undefined;
    }
    if (cfg.email.graph && !cfg.email.graph.clientSecret) {
      cfg.email.graph.clientSecret = (g.client_secret as string) || undefined;
    }
  }

  // Web push / FCM fallback — whole-block, NOT per-field like email above.
  // Email needs per-field secret backfill because its secret (SMTP password /
  // Graph client_secret) commonly lives in env, separate from the record and
  // homesettings (e.g. the efakturuj case). Web-push (VAPID) and FCM key material
  // is atomic — public + private are generated as a pair and have no env source —
  // so an enabled-but-incomplete record has nowhere to backfill a lone secret
  // from; falling back to the whole homesettings block is the only useful action.
  if (webPushEmpty(cfg.webPush)) {
    const w = (home.web_push_settings as Record<string, unknown>) ?? {};
    if (w.vapid_public_key) {
      cfg.webPush = {
        enabled: Boolean(w.enabled),
        vapidPublicKey: w.vapid_public_key as string,
        vapidPrivateKey: w.vapid_private_key as string,
        vapidSubject: w.vapid_subject as string,
        defaultIcon: w.default_icon as string,
        defaultBadge: w.default_badge as string,
      };
    }
  }

  // Mobile push (FCM) fallback
  if (mobilePushEmpty(cfg.mobilePush)) {
    const f = (home.fcm_settings as Record<string, unknown>) ?? {};
    if (f.project_id) {
      cfg.mobilePush = {
        enabled: Boolean(f.enabled),
        projectId: f.project_id as string,
        clientEmail: f.client_email as string,
        privateKey: f.private_key as string,
        defaultIcon: f.default_icon as string,
        defaultColor: f.default_color as string,
      };
    }
  }

  // The cached value is shared by reference for the TTL window. Callers MUST treat
  // the returned config as read-only — all current consumers copy values out rather
  // than mutating `resolved.*`. Mutating a sub-object here would poison every caller.
  cache.set(k, { cfg, at: Date.now() });
  return cfg;
}
