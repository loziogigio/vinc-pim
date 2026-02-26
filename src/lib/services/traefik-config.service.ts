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

// ============================================
// CONFIGURATION
// ============================================

const B2B_ROUTER_NAME = "vinc-b2b-tenants";
const B2B_SERVICE = process.env.TRAEFIK_B2B_SERVICE || "vinc-b2b@file";
const B2B_FILENAME = "b2b-tenants.yml";
const ENTRY_POINTS = ["websecure"];
const CERT_RESOLVER = "letsencrypt";
const MIDDLEWARE = "chain-public@file";
const B2B_PRIORITY = 90;

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
