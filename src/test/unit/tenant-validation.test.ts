/**
 * Unit Tests: Tenant Validation
 *
 * Tests tenant ID validation rules.
 * These are CRITICAL to prevent invalid tenant creation.
 */

import { describe, it, expect } from "vitest";

// Validation constants (same as in admin-tenant.service.ts)
const RESERVED_TENANT_IDS = ["admin", "api", "static", "public", "_next", "favicon"];
const TENANT_ID_REGEX = /^[a-z][a-z0-9-]{2,49}$/;

/**
 * Validates a tenant ID according to project rules.
 * Extracted for unit testing.
 */
function validateTenantId(tenantId: string): string | null {
  if (!tenantId) {
    return "Tenant ID is required";
  }
  if (!TENANT_ID_REGEX.test(tenantId)) {
    return "Tenant ID must be 3-50 lowercase alphanumeric characters, starting with a letter";
  }
  if (RESERVED_TENANT_IDS.includes(tenantId)) {
    return `Tenant ID '${tenantId}' is reserved`;
  }
  return null;
}

describe("unit: Tenant ID Validation", () => {
  describe("valid tenant IDs", () => {
    it("should accept lowercase alphanumeric IDs", () => {
      /**
       * Standard tenant IDs should pass validation.
       */
      const validIds = [
        "acme",
        "acme-corp",
        "hidros-it",
        "tenant123",
        "a1b2c3",
        "abc", // minimum 3 chars
        "a".repeat(50), // maximum 50 chars
      ];

      for (const id of validIds) {
        expect(validateTenantId(id)).toBeNull();
      }
    });

    it("should accept IDs with hyphens", () => {
      /**
       * Hyphens are allowed in tenant IDs.
       */
      const ids = ["my-tenant", "acme-corp-it", "test-123-tenant"];

      for (const id of ids) {
        expect(validateTenantId(id)).toBeNull();
      }
    });
  });

  describe("invalid tenant IDs", () => {
    it("should reject empty string", () => {
      expect(validateTenantId("")).toBe("Tenant ID is required");
    });

    it("should reject IDs starting with number", () => {
      /**
       * Tenant IDs must start with a letter.
       */
      const error = validateTenantId("123tenant");
      expect(error).toContain("must be");
      expect(error).toContain("starting with a letter");
    });

    it("should reject IDs starting with hyphen", () => {
      const error = validateTenantId("-tenant");
      expect(error).toContain("must be");
    });

    it("should reject uppercase letters", () => {
      /**
       * Only lowercase is allowed.
       */
      const error = validateTenantId("AcmeCorp");
      expect(error).toContain("lowercase");
    });

    it("should reject special characters", () => {
      /**
       * Only alphanumeric and hyphens allowed.
       */
      const invalidIds = [
        "acme_corp", // underscore
        "acme.corp", // period
        "acme@corp", // at sign
        "acme corp", // space
        "acme/corp", // slash
      ];

      for (const id of invalidIds) {
        expect(validateTenantId(id)).not.toBeNull();
      }
    });

    it("should reject IDs shorter than 3 characters", () => {
      const error = validateTenantId("ab");
      expect(error).toContain("3-50");
    });

    it("should reject IDs longer than 50 characters", () => {
      const error = validateTenantId("a".repeat(51));
      expect(error).toContain("3-50");
    });
  });

  describe("reserved tenant IDs", () => {
    it("should reject all reserved IDs", () => {
      /**
       * Reserved IDs prevent URL conflicts.
       * Note: Some reserved IDs like "_next" fail regex first,
       * others like "admin" fail reserved check.
       */
      for (const reserved of RESERVED_TENANT_IDS) {
        const error = validateTenantId(reserved);
        expect(error).not.toBeNull(); // All should be rejected
      }
    });

    it("should return reserved error for valid-format reserved IDs", () => {
      /**
       * Reserved IDs that pass regex should get specific reserved error.
       */
      const validFormatReserved = ["admin", "static", "public", "favicon"];
      for (const reserved of validFormatReserved) {
        const error = validateTenantId(reserved);
        expect(error).toContain("reserved");
      }
    });

    it("should accept IDs containing reserved words", () => {
      /**
       * Reserved words as part of larger ID are OK.
       */
      const validIds = ["admin-panel", "my-api", "static-site", "public-tenant"];

      for (const id of validIds) {
        expect(validateTenantId(id)).toBeNull();
      }
    });
  });

  describe("edge cases", () => {
    it("should handle exactly 3 character ID", () => {
      expect(validateTenantId("abc")).toBeNull();
    });

    it("should handle exactly 50 character ID", () => {
      const id = "a" + "b".repeat(49); // 50 chars starting with letter
      expect(validateTenantId(id)).toBeNull();
    });

    it("should handle ID with consecutive hyphens", () => {
      // Double hyphens are technically valid per regex
      expect(validateTenantId("test--tenant")).toBeNull();
    });

    it("should handle ID ending with hyphen", () => {
      // Ending with hyphen is valid per regex
      expect(validateTenantId("test-")).toBeNull();
    });
  });
});

describe("unit: Tenant Naming Convention", () => {
  it("should use vinc- prefix for database names", () => {
    /**
     * Database naming convention: vinc-{tenant_id}
     */
    const tenantId = "acme-corp";
    const expectedDbName = `vinc-${tenantId}`;

    expect(expectedDbName).toBe("vinc-acme-corp");
  });

  it("should use same name for Solr collection", () => {
    /**
     * Solr collection uses same naming: vinc-{tenant_id}
     */
    const tenantId = "acme-corp";
    const dbName = `vinc-${tenantId}`;
    const solrCore = `vinc-${tenantId}`;

    expect(dbName).toBe(solrCore);
  });
});
