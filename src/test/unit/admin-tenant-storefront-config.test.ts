import mongoose from "mongoose";
import { afterAll, describe, expect, it } from "vitest";
import { TenantSchema } from "@/lib/db/models/admin-tenant";

const connection = mongoose.createConnection();
const Tenant = connection.model(
  "TenantStorefrontConfigTest",
  TenantSchema.clone(),
);

function buildTenant(overrides: Record<string, unknown> = {}) {
  return new Tenant({
    tenant_id: "storefront-test",
    name: "Storefront Test",
    admin_email: "admin@example.com",
    solr_core: "vinc-storefront-test",
    mongo_db: "vinc-storefront-test",
    created_by: "test",
    ...overrides,
  });
}

afterAll(async () => {
  await connection.close();
});

describe("admin tenant B2B storefront contract", () => {
  it("defaults the theme without backfilling a legacy pricing override", () => {
    const tenant = buildTenant();

    expect(tenant.b2b_theme).toBe("default");
    expect(tenant.features).toBeUndefined();
    expect(tenant.validateSync()).toBeUndefined();
  });

  it("accepts the explicit default provisioned for new tenants", () => {
    const tenant = buildTenant({
      b2b_theme: "default",
      features: { pricing_source: "inline" },
    });

    expect(tenant.features?.pricing_source).toBe("inline");
    expect(tenant.validateSync()).toBeUndefined();
  });

  it("does not backfill pricing on an existing unrelated feature object", () => {
    const tenant = buildTenant({ features: { is_demo: true } });

    expect(tenant.features?.is_demo).toBe(true);
    expect(tenant.features?.pricing_source).toBeUndefined();
    expect(tenant.validateSync()).toBeUndefined();
  });

  it.each(["inline", "erp", "hybrid"] as const)(
    "accepts the %s pricing source",
    (pricingSource) => {
      const tenant = buildTenant({
        b2b_theme: "time",
        features: { pricing_source: pricingSource },
      });

      expect(tenant.validateSync()).toBeUndefined();
    },
  );

  it("rejects unknown storefront themes and pricing sources", () => {
    const tenant = buildTenant({
      b2b_theme: "unknown",
      features: { pricing_source: "spreadsheet" },
    });
    const error = tenant.validateSync();

    expect(error?.errors.b2b_theme).toBeDefined();
    expect(error?.errors["features.pricing_source"]).toBeDefined();
  });

  it("allows an unrelated save of a hydrated tenant with legacy values", () => {
    const tenant = Tenant.hydrate({
      tenant_id: "legacy-storefront",
      name: "Legacy Storefront",
      status: "active",
      admin_email: "admin@example.com",
      solr_core: "vinc-legacy-storefront",
      mongo_db: "vinc-legacy-storefront",
      created_by: "test",
      b2b_theme: "custom-legacy-theme",
      features: { pricing_source: "legacy-provider" },
    });

    tenant.name = "Updated Legacy Storefront";

    expect(tenant.validateSync()).toBeUndefined();
  });

  it("stores the direct ERP URL used by vinc-b2b", () => {
    const tenant = buildTenant({
      api: { erp_url: "https://user:secret@erp.example.com/service" },
    });

    expect(tenant.api?.erp_url).toBe(
      "https://user:secret@erp.example.com/service",
    );
    expect(tenant.validateSync()).toBeUndefined();
  });
});
