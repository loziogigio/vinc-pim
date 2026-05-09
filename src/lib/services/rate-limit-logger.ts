/**
 * Structured logger for rate-limit 429 responses.
 *
 * Single source of field shape so log scrapers (Loki/Grafana) can rely on
 * stable JSON keys.
 */

import type { RateLimitResult } from "@/lib/services/tenant-rate-limit.service";

interface Log429Fields {
  tenant_id: string;
  ip: string;
  path: string;
  blocked_by: NonNullable<RateLimitResult["blocked_by"]>;
  limits: RateLimitResult["limits"];
}

export function log429(fields: Log429Fields): void {
  console.log(
    JSON.stringify({
      event: "rate_limit_429",
      ts: Date.now(),
      tenant_id: fields.tenant_id,
      ip: fields.ip,
      path: fields.path,
      blocked_by: fields.blocked_by,
      ip_minute: fields.limits.ip_minute,
      ip_day: fields.limits.ip_day,
      ip_concurrent: fields.limits.ip_concurrent,
    })
  );
}
