/**
 * GET /api/admin/traefik/domains
 *
 * Returns all registered domains across tenants (B2B + B2C).
 * Groups by tenant with type, status, and routing info.
 * Requires super-admin auth.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth, unauthorizedResponse } from "@/lib/auth/admin-auth";
import { getTenantModel } from "@/lib/db/models/admin-tenant";
import { connectToAdminDatabase } from "@/lib/db/admin-connection";
import { connectWithModels } from "@/lib/db/connection";

export interface DomainEntry {
  hostname: string;
  type: "b2b" | "b2c";
  tenant_id: string;
  tenant_name: string;
  project_code: string;
  tenant_status: string;
  is_primary: boolean;
  is_active: boolean;
  /** true = currently routed in Traefik YAML (active tenant + active/primary domain) */
  in_traefik: boolean;
  /** B2C only: storefront name */
  storefront_name?: string;
  /** B2C only: storefront slug */
  storefront_slug?: string;
  /** B2C only: storefront status */
  storefront_status?: string;
}

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    await connectToAdminDatabase();
    const TenantModel = await getTenantModel();

    const tenants = await TenantModel.find()
      .select("tenant_id name status project_code mongo_db domains")
      .lean();

    const allDomains: DomainEntry[] = [];

    // B2B domains from admin tenant records
    for (const tenant of tenants) {
      const t = tenant as any;
      if (t.domains && Array.isArray(t.domains)) {
        for (const d of t.domains) {
          const isActive = d.is_active !== false;
          const inTraefik = t.status === "active" && isActive && d.protocol === "https";
          allDomains.push({
            hostname: d.hostname?.toLowerCase() || "",
            type: "b2b",
            tenant_id: t.tenant_id,
            tenant_name: t.name,
            project_code: t.project_code || "",
            tenant_status: t.status,
            is_primary: d.is_primary || false,
            is_active: isActive,
            in_traefik: inTraefik,
          });
        }
      }
    }

    // B2C domains: scan each tenant's storefronts
    const activeTenants = tenants.filter((t: any) => t.status === "active");
    const b2cResults = await Promise.allSettled(
      activeTenants.map(async (tenant) => {
        const t = tenant as any;
        const dbName = t.mongo_db || `vinc-${t.tenant_id}`;
        const { B2CStorefront } = await connectWithModels(dbName);

        const storefronts = await B2CStorefront.find()
          .select("name slug status domains")
          .lean();

        const entries: DomainEntry[] = [];
        for (const sf of storefronts) {
          const s = sf as any;
          if (!Array.isArray(s.domains)) continue;
          for (const d of s.domains) {
            if (!d.domain) continue;
            const hostname = d.domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
            const isPrimary = d.is_primary || false;
            const inTraefik = s.status === "active" && isPrimary;
            entries.push({
              hostname,
              type: "b2c",
              tenant_id: t.tenant_id,
              tenant_name: t.name,
              project_code: t.project_code || "",
              tenant_status: t.status,
              is_primary: isPrimary,
              is_active: s.status === "active",
              in_traefik: inTraefik,
              storefront_name: s.name,
              storefront_slug: s.slug,
              storefront_status: s.status,
            });
          }
        }
        return entries;
      })
    );

    for (const result of b2cResults) {
      if (result.status === "fulfilled") {
        allDomains.push(...result.value);
      }
    }

    // Get last sync times from file stats
    let lastSync: { b2b?: string; b2c?: string } = {};
    try {
      const fs = await import("fs");
      const path = await import("path");
      const dir = process.env.TRAEFIK_DYNAMIC_DIR || path.join(process.cwd(), ".traefik");
      const b2bPath = path.join(dir, "b2b-tenants.yml");
      const b2cPath = path.join(dir, "b2c-storefronts.yml");
      if (fs.existsSync(b2bPath)) {
        lastSync.b2b = fs.statSync(b2bPath).mtime.toISOString();
      }
      if (fs.existsSync(b2cPath)) {
        lastSync.b2c = fs.statSync(b2cPath).mtime.toISOString();
      }
    } catch {
      // File stats not available
    }

    return NextResponse.json({
      success: true,
      domains: allDomains,
      last_sync: lastSync,
      total: allDomains.length,
      in_traefik: allDomains.filter((d) => d.in_traefik).length,
    });
  } catch (error) {
    console.error("[traefik/domains] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch domains";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
