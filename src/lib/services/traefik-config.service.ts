/**
 * Traefik Dynamic Config Service
 *
 * Generates Traefik dynamic configuration YAML files for domain routing.
 * Traefik watches the target directory (file provider, watch: true) and
 * hot-reloads on file changes — zero downtime, auto ACME certs.
 *
 * In production: TRAEFIK_DYNAMIC_DIR points to the shared NFS mount.
 * In development: falls back to {project_root}/.traefik/ (gitignored).
 */

import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { getTenantModel } from "../db/models/admin-tenant";
import { connectToAdminDatabase } from "../db/admin-connection";
import { connectWithModels } from "../db/connection";

// ============================================
// CONFIGURATION
// ============================================

const B2B_ROUTER_NAME = "vinc-b2b-tenants";
const B2B_SERVICE = process.env.TRAEFIK_B2B_SERVICE || "vinc-b2b@file";
const B2B_FILENAME = "b2b-tenants.yml";
const B2B_PRIORITY = 90;

const B2C_ROUTER_NAME = "vinc-b2c-storefronts";
const B2C_SERVICE = process.env.TRAEFIK_B2C_SERVICE || "vinc-b2c@file";
const B2C_FILENAME = "b2c-storefronts.yml";
const B2C_PRIORITY = 80;
const B2C_DEBOUNCE_MS = parseInt(process.env.TRAEFIK_B2C_DEBOUNCE_MS || "5000", 10);

const ENTRY_POINTS = ["websecure"];
const CERT_RESOLVER = "letsencrypt";
const MIDDLEWARE = "chain-public@file";

let b2cDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function getDynamicDir(): string {
  if (process.env.TRAEFIK_DYNAMIC_DIR) {
    return process.env.TRAEFIK_DYNAMIC_DIR;
  }
  // Dev fallback: .traefik/ in project root
  return path.join(process.cwd(), ".traefik");
}

// ============================================
// YAML GENERATION
// ============================================

/**
 * Build Traefik router config for a list of domains.
 * Returns the full YAML-serializable object.
 */
export function buildRouterConfig(
  domains: string[],
  routerName: string,
  service: string,
  priority: number
): Record<string, unknown> {
  if (domains.length === 0) {
    return { http: {} };
  }

  const rule = domains.map((d) => `Host(\`${d}\`)`).join(" || ");

  return {
    http: {
      routers: {
        [routerName]: {
          rule,
          entryPoints: ENTRY_POINTS,
          service,
          middlewares: [MIDDLEWARE],
          tls: { certResolver: CERT_RESOLVER },
          priority,
        },
      },
    },
  };
}

// ============================================
// FILE WRITING
// ============================================

/**
 * Atomic write: write to .tmp then rename.
 * Prevents Traefik from reading a half-written file.
 */
function writeConfigFile(filename: string, config: Record<string, unknown>): string {
  const dir = getDynamicDir();

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = path.join(dir, filename);
  const tmpPath = `${filePath}.tmp`;
  const content = yaml.dump(config, { lineWidth: -1 });

  fs.writeFileSync(tmpPath, content, "utf-8");
  fs.renameSync(tmpPath, filePath);

  return filePath;
}

// ============================================
// B2B CONFIG GENERATION
// ============================================

/**
 * Regenerate b2b-tenants.yml from all active tenants.
 * Collects hostnames where is_active === true.
 */
export async function regenerateB2BConfig(): Promise<{
  domains_count: number;
  file_path: string;
}> {
  await connectToAdminDatabase();
  const TenantModel = await getTenantModel();

  const tenants = await TenantModel.find({ status: "active" })
    .select("domains")
    .lean();

  // Collect all is_active hostnames across all tenants
  const activeDomains: string[] = [];
  for (const tenant of tenants) {
    if (tenant.domains && Array.isArray(tenant.domains)) {
      for (const domain of tenant.domains) {
        if (domain.is_active && domain.hostname && domain.protocol === "https") {
          activeDomains.push(domain.hostname.toLowerCase());
        }
      }
    }
  }

  // Deduplicate
  const uniqueDomains = [...new Set(activeDomains)];

  const config = buildRouterConfig(
    uniqueDomains,
    B2B_ROUTER_NAME,
    B2B_SERVICE,
    B2B_PRIORITY
  );

  const filePath = writeConfigFile(B2B_FILENAME, config);

  console.log(
    `[traefik] Wrote ${B2B_FILENAME} with ${uniqueDomains.length} domain(s) to ${filePath}`
  );

  return { domains_count: uniqueDomains.length, file_path: filePath };
}

// ============================================
// B2C CONFIG GENERATION
// ============================================

/**
 * Regenerate b2c-storefronts.yml from all active storefronts across all active tenants.
 * Collects primary domains (is_primary === true) from active storefronts in active tenants.
 */
export async function regenerateB2CConfig(): Promise<{
  domains_count: number;
  file_path: string;
}> {
  await connectToAdminDatabase();
  const TenantModel = await getTenantModel();

  // Get all active tenants
  const tenants = await TenantModel.find({ status: "active" })
    .select("tenant_id mongo_db")
    .lean();

  // Scan each tenant DB for active storefronts with primary domains
  const activeDomains: string[] = [];

  const results = await Promise.allSettled(
    tenants.map(async (tenant) => {
      const dbName = (tenant as any).mongo_db || `vinc-${(tenant as any).tenant_id}`;
      const { B2CStorefront } = await connectWithModels(dbName);

      const storefronts = await B2CStorefront.find({ status: "active" })
        .select("domains")
        .lean();

      for (const storefront of storefronts) {
        const domains = (storefront as any).domains;
        if (!Array.isArray(domains)) continue;
        for (const d of domains) {
          if (d.is_primary && d.domain) {
            // Strip protocol if accidentally stored (e.g., "https://shop.example.com")
            const hostname = d.domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
            if (hostname) activeDomains.push(hostname);
          }
        }
      }
    })
  );

  // Log any tenant scan failures
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === "rejected") {
      const tenantId = (tenants[i] as any).tenant_id;
      console.warn(`[traefik] Failed to scan B2C storefronts for tenant ${tenantId}:`, (results[i] as PromiseRejectedResult).reason);
    }
  }

  // Deduplicate
  const uniqueDomains = [...new Set(activeDomains)];

  const config = buildRouterConfig(
    uniqueDomains,
    B2C_ROUTER_NAME,
    B2C_SERVICE,
    B2C_PRIORITY
  );

  const filePath = writeConfigFile(B2C_FILENAME, config);

  console.log(
    `[traefik] Wrote ${B2C_FILENAME} with ${uniqueDomains.length} domain(s) to ${filePath}`
  );

  return { domains_count: uniqueDomains.length, file_path: filePath };
}

/**
 * Debounced B2C config regeneration.
 * Coalesces rapid changes (e.g., toggling multiple storefronts) into a single file write.
 * Fire-and-forget: callers should not await this.
 */
export function regenerateB2CConfigDebounced(): void {
  if (b2cDebounceTimer) {
    clearTimeout(b2cDebounceTimer);
  }

  b2cDebounceTimer = setTimeout(() => {
    b2cDebounceTimer = null;
    regenerateB2CConfig().catch((err) =>
      console.error("[traefik] Failed to regenerate B2C config:", err)
    );
  }, B2C_DEBOUNCE_MS);
}
