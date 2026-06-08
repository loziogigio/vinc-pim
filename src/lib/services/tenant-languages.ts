import { connectWithModels } from "@/lib/db/connection";

/** Ultimate fallback only when a tenant has NO languages seeded (misconfig). */
const ULTIMATE_DEFAULT = "it";
const CACHE_TTL_MS = 60_000;

interface TenantLangs {
  codes: string[];
  defaultCode: string;
}
const cache = new Map<string, { value: TenantLangs; ts: number }>();

async function loadTenantLangs(tenantDb: string): Promise<TenantLangs> {
  const { Language } = await connectWithModels(tenantDb);
  const docs = (await Language.find({ isEnabled: true }, { code: 1, isDefault: 1 })
    .sort({ order: 1 })
    .lean()) as Array<{ code: string; isDefault?: boolean }>;
  const codes = docs.map((d) => d.code).filter(Boolean);
  const defaultCode =
    docs.find((d) => d.isDefault)?.code || codes[0] || ULTIMATE_DEFAULT;
  // Empty collection (misconfigured tenant): allow the default language only.
  return { codes: codes.length ? codes : [defaultCode], defaultCode };
}

async function getTenantLangs(tenantDb: string): Promise<TenantLangs> {
  const hit = cache.get(tenantDb);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.value;
  const value = await loadTenantLangs(tenantDb);
  cache.set(tenantDb, { value, ts: Date.now() });
  return value;
}

/** Enabled language codes for the tenant (>=1; the default only if none enabled). */
export async function getTenantLanguageCodes(tenantDb: string): Promise<string[]> {
  return (await getTenantLangs(tenantDb)).codes;
}

/** The tenant's default language code (isDefault, else first enabled, else "it"). */
export async function getTenantDefaultLanguageCode(tenantDb: string): Promise<string> {
  return (await getTenantLangs(tenantDb)).defaultCode;
}

/** Bust the cache (call after language admin writes). Pass a tenantDb or clear all. */
export function clearTenantLanguageCache(tenantDb?: string): void {
  if (tenantDb) cache.delete(tenantDb);
  else cache.clear();
}
