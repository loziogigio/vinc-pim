/**
 * Unit Tests for Multi-Tenant Configuration
 *
 * Tests the tenant schema interfaces and helper functions.
 */

import { describe, it, expect } from "vitest";

// ============================================
// HELPER FUNCTIONS (matching UI logic)
// ============================================

/**
 * Strips protocol from hostname (matches updateDomain logic)
 */
function stripProtocol(hostname: string): string {
  return hostname.replace(/^https?:\/\//, "").trim();
}

/**
 * Validates hostname format
 */
function isValidHostname(hostname: string): boolean {
  if (!hostname || hostname.trim() === "") return false;
  // Should not contain protocol
  if (hostname.includes("://")) return false;
  // Basic hostname validation
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*(:[\d]+)?$/;
  return hostnameRegex.test(hostname);
}

/**
 * Validates API Key ID format
 */
function isValidApiKeyId(keyId: string): boolean {
  if (!keyId) return false;
  // Format: ak_{tenant-id}_{12-hex-chars}
  const apiKeyRegex = /^ak_[a-z0-9-]+_[a-f0-9]{12}$/;
  return apiKeyRegex.test(keyId);
}

/**
 * Validates API Secret format
 */
function isValidApiSecret(secret: string): boolean {
  if (!secret) return false;
  // Format: sk_{32-hex-chars}
  const secretRegex = /^sk_[a-f0-9]{32}$/;
  return secretRegex.test(secret);
}

// ============================================
// HOSTNAME PROCESSING TESTS
// ============================================

describe("unit: Multi-Tenant - Hostname Processing", () => {
  it("should strip http:// protocol from hostname", () => {
    const input = "http://localhost:3001";
    const result = stripProtocol(input);
    expect(result).toBe("localhost:3001");
  });

  it("should strip https:// protocol from hostname", () => {
    const input = "https://hidros-b2b.vendereincloud.it";
    const result = stripProtocol(input);
    expect(result).toBe("hidros-b2b.vendereincloud.it");
  });

  it("should not modify hostname without protocol", () => {
    const input = "shop.example.com";
    const result = stripProtocol(input);
    expect(result).toBe("shop.example.com");
  });

  it("should trim whitespace after stripping protocol", () => {
    const input = "https://example.com  ";
    const result = stripProtocol(input);
    expect(result).toBe("example.com");
  });

  it("should handle localhost with port", () => {
    const input = "http://localhost:3000";
    const result = stripProtocol(input);
    expect(result).toBe("localhost:3000");
  });

  it("should handle empty string", () => {
    const input = "";
    const result = stripProtocol(input);
    expect(result).toBe("");
  });
});

// ============================================
// HOSTNAME VALIDATION TESTS
// ============================================

describe("unit: Multi-Tenant - Hostname Validation", () => {
  it("should accept valid hostname", () => {
    expect(isValidHostname("shop.example.com")).toBe(true);
  });

  it("should accept hostname with port", () => {
    expect(isValidHostname("localhost:3000")).toBe(true);
  });

  it("should accept subdomain hostname", () => {
    expect(isValidHostname("hidros-b2b.vendereincloud.it")).toBe(true);
  });

  it("should accept simple hostname", () => {
    expect(isValidHostname("localhost")).toBe(true);
  });

  it("should reject hostname with protocol", () => {
    expect(isValidHostname("http://example.com")).toBe(false);
    expect(isValidHostname("https://example.com")).toBe(false);
  });

  it("should reject empty hostname", () => {
    expect(isValidHostname("")).toBe(false);
    expect(isValidHostname("   ")).toBe(false);
  });

  it("should reject hostname starting with hyphen", () => {
    expect(isValidHostname("-example.com")).toBe(false);
  });
});

// ============================================
// API KEY VALIDATION TESTS
// ============================================

describe("unit: Multi-Tenant - API Key Validation", () => {
  it("should accept valid API key ID format", () => {
    expect(isValidApiKeyId("ak_hidros-it_aabbccddeeff")).toBe(true);
  });

  it("should accept API key with different tenant ID", () => {
    expect(isValidApiKeyId("ak_dfl-eventi-it_112233445566")).toBe(true);
  });

  it("should reject API key without prefix", () => {
    expect(isValidApiKeyId("hidros-it_aabbccddeeff")).toBe(false);
  });

  it("should reject API key with wrong hex length", () => {
    expect(isValidApiKeyId("ak_hidros-it_aabbcc")).toBe(false); // too short
    expect(isValidApiKeyId("ak_hidros-it_aabbccddeeff00")).toBe(false); // too long
  });

  it("should reject email as API key", () => {
    expect(isValidApiKeyId("admin@example.com")).toBe(false);
  });

  it("should reject empty API key", () => {
    expect(isValidApiKeyId("")).toBe(false);
  });
});

describe("unit: Multi-Tenant - API Secret Validation", () => {
  it("should accept valid API secret format", () => {
    expect(isValidApiSecret("sk_aabbccddeeff00112233445566778899")).toBe(true);
  });

  it("should reject secret without prefix", () => {
    expect(isValidApiSecret("aabbccddeeff00112233445566778899")).toBe(false);
  });

  it("should reject secret with wrong hex length", () => {
    expect(isValidApiSecret("sk_aabbccdd")).toBe(false); // too short
  });

  it("should reject empty secret", () => {
    expect(isValidApiSecret("")).toBe(false);
  });
});

// ============================================
// DOMAIN CONFIGURATION TESTS
// ============================================

describe("unit: Multi-Tenant - Domain Configuration", () => {
  interface TenantDomain {
    hostname: string;
    is_primary?: boolean;
    is_active?: boolean;
  }

  it("should allow single domain", () => {
    const domains: TenantDomain[] = [
      { hostname: "shop.example.com", is_primary: true, is_active: true },
    ];
    expect(domains.length).toBe(1);
    expect(domains[0].is_primary).toBe(true);
  });

  it("should allow multiple domains", () => {
    const domains: TenantDomain[] = [
      { hostname: "localhost:3000", is_primary: false, is_active: true },
      { hostname: "shop.example.com", is_primary: true, is_active: true },
    ];
    expect(domains.length).toBe(2);
    // Only one should be primary
    const primaryCount = domains.filter((d) => d.is_primary).length;
    expect(primaryCount).toBe(1);
  });

  it("should support inactive domains", () => {
    const domains: TenantDomain[] = [
      { hostname: "old.example.com", is_primary: false, is_active: false },
      { hostname: "new.example.com", is_primary: true, is_active: true },
    ];
    const activeDomains = domains.filter((d) => d.is_active !== false);
    expect(activeDomains.length).toBe(1);
  });

  it("should default is_active to true", () => {
    const domain: TenantDomain = { hostname: "example.com" };
    // When is_active is undefined, it should be treated as true
    expect(domain.is_active !== false).toBe(true);
  });
});

// ============================================
// API CONFIGURATION TESTS
// ============================================

describe("unit: Multi-Tenant - API Configuration", () => {
  interface TenantApiConfig {
    pim_api_url?: string;
    b2b_api_url?: string;
    api_key_id?: string;
    api_secret?: string;
  }

  it("should allow partial API config", () => {
    const apiConfig: TenantApiConfig = {
      pim_api_url: "http://localhost:3001",
    };
    expect(apiConfig.pim_api_url).toBeDefined();
    expect(apiConfig.b2b_api_url).toBeUndefined();
  });

  it("should allow full API config", () => {
    const apiConfig: TenantApiConfig = {
      pim_api_url: "http://localhost:3001",
      b2b_api_url: "https://b2b.example.com",
      api_key_id: "ak_test-tenant_aabbccddeeff",
      api_secret: "sk_aabbccddeeff00112233445566778899",
    };
    expect(apiConfig.pim_api_url).toBeDefined();
    expect(apiConfig.b2b_api_url).toBeDefined();
    expect(apiConfig.api_key_id).toBeDefined();
    expect(apiConfig.api_secret).toBeDefined();
  });

  it("should allow empty API config", () => {
    const apiConfig: TenantApiConfig = {};
    expect(Object.keys(apiConfig).length).toBe(0);
  });
});

// ============================================
// DATABASE CONFIGURATION TESTS
// ============================================

describe("unit: Multi-Tenant - Database Configuration", () => {
  interface TenantDbConfig {
    mongo_url?: string;
    mongo_db?: string;
  }

  it("should allow partial database config", () => {
    const dbConfig: TenantDbConfig = {
      mongo_db: "vinc-custom-db",
    };
    expect(dbConfig.mongo_db).toBe("vinc-custom-db");
    expect(dbConfig.mongo_url).toBeUndefined();
  });

  it("should allow full database config", () => {
    const dbConfig: TenantDbConfig = {
      mongo_url: "mongodb://custom-host:27017",
      mongo_db: "vinc-custom-db",
    };
    expect(dbConfig.mongo_url).toBeDefined();
    expect(dbConfig.mongo_db).toBeDefined();
  });

  it("should follow database naming convention", () => {
    const tenantId = "hidros-it";
    const expectedDbName = `vinc-${tenantId}`;
    expect(expectedDbName).toBe("vinc-hidros-it");
  });
});

// ============================================
// FULL TENANT CONFIGURATION TESTS
// ============================================

describe("unit: Multi-Tenant - Full Tenant Configuration", () => {
  interface TenantConfig {
    tenant_id: string;
    name: string;
    status: "active" | "suspended" | "pending";
    project_code?: string;
    domains?: Array<{
      hostname: string;
      is_primary?: boolean;
      is_active?: boolean;
    }>;
    api?: {
      pim_api_url?: string;
      b2b_api_url?: string;
      api_key_id?: string;
      api_secret?: string;
    };
    database?: {
      mongo_url?: string;
      mongo_db?: string;
    };
    require_login?: boolean;
  }

  it("should create minimal tenant config", () => {
    const tenant: TenantConfig = {
      tenant_id: "test-tenant",
      name: "Test Tenant",
      status: "active",
    };
    expect(tenant.tenant_id).toBe("test-tenant");
    expect(tenant.domains).toBeUndefined();
  });

  it("should create full tenant config", () => {
    const tenant: TenantConfig = {
      tenant_id: "hidros-it",
      name: "Hidros S.r.l",
      status: "active",
      project_code: "vinc-hidros-it",
      domains: [
        { hostname: "localhost:3000", is_primary: false, is_active: true },
        { hostname: "hidros-b2b.vendereincloud.it", is_primary: true, is_active: true },
      ],
      api: {
        pim_api_url: "http://localhost:3001",
        b2b_api_url: "https://b2b.hidros.com",
        api_key_id: "ak_hidros-it_aabbccddeeff",
        api_secret: "sk_aabbccddeeff00112233445566778899",
      },
      database: {
        mongo_db: "vinc-hidros-it",
      },
      require_login: true,
    };

    expect(tenant.project_code).toBe("vinc-hidros-it");
    expect(tenant.domains?.length).toBe(2);
    expect(tenant.api?.api_key_id).toMatch(/^ak_/);
    expect(tenant.require_login).toBe(true);
  });

  it("should find primary domain", () => {
    const tenant: TenantConfig = {
      tenant_id: "test",
      name: "Test",
      status: "active",
      domains: [
        { hostname: "dev.example.com", is_primary: false },
        { hostname: "prod.example.com", is_primary: true },
      ],
    };

    const primaryDomain = tenant.domains?.find((d) => d.is_primary);
    expect(primaryDomain?.hostname).toBe("prod.example.com");
  });

  it("should filter active domains", () => {
    const tenant: TenantConfig = {
      tenant_id: "test",
      name: "Test",
      status: "active",
      domains: [
        { hostname: "old.example.com", is_active: false },
        { hostname: "new.example.com", is_active: true },
        { hostname: "dev.example.com" }, // undefined = active
      ],
    };

    const activeDomains = tenant.domains?.filter((d) => d.is_active !== false);
    expect(activeDomains?.length).toBe(2);
  });
});

// ============================================
// DOMAIN LOOKUP SIMULATION TESTS
// ============================================

describe("unit: Multi-Tenant - Domain Lookup", () => {
  const tenants = [
    {
      tenant_id: "hidros-it",
      status: "active" as const,
      domains: [
        { hostname: "localhost:3000", is_active: true },
        { hostname: "hidros-b2b.vendereincloud.it", is_primary: true, is_active: true },
      ],
    },
    {
      tenant_id: "dfl-it",
      status: "active" as const,
      domains: [
        { hostname: "dfl.vendereincloud.it", is_primary: true, is_active: true },
      ],
    },
    {
      tenant_id: "suspended-tenant",
      status: "suspended" as const,
      domains: [
        { hostname: "suspended.example.com", is_primary: true, is_active: true },
      ],
    },
  ];

  function findTenantByHostname(hostname: string) {
    return tenants.find(
      (t) =>
        t.status === "active" &&
        t.domains?.some(
          (d) => d.hostname.toLowerCase() === hostname.toLowerCase() && d.is_active !== false
        )
    );
  }

  it("should find tenant by primary domain", () => {
    const tenant = findTenantByHostname("hidros-b2b.vendereincloud.it");
    expect(tenant?.tenant_id).toBe("hidros-it");
  });

  it("should find tenant by secondary domain", () => {
    const tenant = findTenantByHostname("localhost:3000");
    expect(tenant?.tenant_id).toBe("hidros-it");
  });

  it("should find different tenant by its domain", () => {
    const tenant = findTenantByHostname("dfl.vendereincloud.it");
    expect(tenant?.tenant_id).toBe("dfl-it");
  });

  it("should not find suspended tenant", () => {
    const tenant = findTenantByHostname("suspended.example.com");
    expect(tenant).toBeUndefined();
  });

  it("should not find non-existent domain", () => {
    const tenant = findTenantByHostname("unknown.example.com");
    expect(tenant).toBeUndefined();
  });

  it("should be case-insensitive for hostname lookup", () => {
    const tenant = findTenantByHostname("HIDROS-B2B.VENDEREINCLOUD.IT");
    expect(tenant?.tenant_id).toBe("hidros-it");
  });
});
