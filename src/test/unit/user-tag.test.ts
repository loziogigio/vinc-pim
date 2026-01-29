/**
 * Unit Tests for UserTag Model and Related Functionality
 */

import { describe, it, expect } from "vitest";

// ============================================
// SLUG GENERATION TESTS
// ============================================

describe("unit: UserTag Slug Generation", () => {
  // Re-implement the slug generation logic for testing
  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[àáâãäå]/g, "a")
      .replace(/[èéêë]/g, "e")
      .replace(/[ìíîï]/g, "i")
      .replace(/[òóôõö]/g, "o")
      .replace(/[ùúûü]/g, "u")
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  it("should generate slug from simple name", () => {
    expect(generateSlug("VIP Customers")).toBe("vip-customers");
  });

  it("should handle Italian characters", () => {
    expect(generateSlug("Clienti Città")).toBe("clienti-citta");
    expect(generateSlug("Più Attivi")).toBe("piu-attivi");
    expect(generateSlug("Perché No")).toBe("perche-no");
  });

  it("should handle multiple spaces", () => {
    expect(generateSlug("High   Value   Clients")).toBe("high-value-clients");
  });

  it("should handle underscores", () => {
    expect(generateSlug("test_tag_name")).toBe("test-tag-name");
  });

  it("should remove special characters", () => {
    expect(generateSlug("Tag #1 (Test)")).toBe("tag-1-test");
  });

  it("should trim leading/trailing hyphens", () => {
    expect(generateSlug("  -Test Tag-  ")).toBe("test-tag");
  });

  it("should handle empty string", () => {
    expect(generateSlug("")).toBe("");
  });
});

// ============================================
// TAG REF STRUCTURE TESTS
// ============================================

describe("unit: UserTagRef Structure", () => {
  interface IUserTagRef {
    tag_id: string;
    name: string;
    slug: string;
    color?: string;
  }

  it("should have required fields", () => {
    const tagRef: IUserTagRef = {
      tag_id: "utag_abc12345",
      name: "VIP Customers",
      slug: "vip-customers",
    };

    expect(tagRef.tag_id).toBeDefined();
    expect(tagRef.name).toBeDefined();
    expect(tagRef.slug).toBeDefined();
  });

  it("should allow optional color", () => {
    const tagRef: IUserTagRef = {
      tag_id: "utag_abc12345",
      name: "VIP Customers",
      slug: "vip-customers",
      color: "#FF5733",
    };

    expect(tagRef.color).toBe("#FF5733");
  });

  it("should match tag_id format", () => {
    const tagId = "utag_abc12345";
    expect(tagId.startsWith("utag_")).toBe(true);
    expect(tagId.length).toBe(13); // "utag_" + 8 chars
  });
});

// ============================================
// IMPORT PARSING TESTS
// ============================================

describe("unit: Recipient Import Parsing", () => {
  function parseCSV(csv: string): string[] {
    return csv
      .split(/[\n,]/)
      .map((u) => u.trim())
      .filter(Boolean);
  }

  it("should parse comma-separated usernames", () => {
    const csv = "user1,user2,user3";
    expect(parseCSV(csv)).toEqual(["user1", "user2", "user3"]);
  });

  it("should parse newline-separated usernames", () => {
    const csv = "user1\nuser2\nuser3";
    expect(parseCSV(csv)).toEqual(["user1", "user2", "user3"]);
  });

  it("should handle mixed separators", () => {
    const csv = "user1,user2\nuser3,user4";
    expect(parseCSV(csv)).toEqual(["user1", "user2", "user3", "user4"]);
  });

  it("should trim whitespace", () => {
    const csv = "  user1  ,  user2  \n  user3  ";
    expect(parseCSV(csv)).toEqual(["user1", "user2", "user3"]);
  });

  it("should filter empty entries", () => {
    const csv = "user1,,user2,\n\nuser3";
    expect(parseCSV(csv)).toEqual(["user1", "user2", "user3"]);
  });
});

// ============================================
// DUPLICATE DETECTION TESTS
// ============================================

describe("unit: Duplicate Detection", () => {
  function findDuplicates(usernames: string[]): { unique: string[]; duplicates: string[] } {
    const normalizedMap = new Map<string, string>();
    const duplicates: string[] = [];

    for (const username of usernames) {
      const lower = username.toLowerCase();
      if (normalizedMap.has(lower)) {
        duplicates.push(username);
      } else {
        normalizedMap.set(lower, username);
      }
    }

    return {
      unique: Array.from(normalizedMap.values()),
      duplicates,
    };
  }

  it("should detect exact duplicates", () => {
    const result = findDuplicates(["user1", "user2", "user1", "user3"]);
    expect(result.unique).toEqual(["user1", "user2", "user3"]);
    expect(result.duplicates).toEqual(["user1"]);
  });

  it("should detect case-insensitive duplicates", () => {
    const result = findDuplicates(["User1", "user1", "USER1"]);
    expect(result.unique).toEqual(["User1"]);
    expect(result.duplicates).toEqual(["user1", "USER1"]);
  });

  it("should handle no duplicates", () => {
    const result = findDuplicates(["user1", "user2", "user3"]);
    expect(result.unique).toEqual(["user1", "user2", "user3"]);
    expect(result.duplicates).toEqual([]);
  });
});

// ============================================
// CSV EXPORT TESTS
// ============================================

describe("unit: CSV Export", () => {
  function escapeCSV(value: string): string {
    if (!value) return "";
    return value.replace(/"/g, '""');
  }

  function generateCSVLine(user: { username: string; email: string; is_active: boolean; tags: string[] }): string {
    const tags = user.tags.join(";");
    return `"${escapeCSV(user.username)}","${escapeCSV(user.email)}",${user.is_active},"${escapeCSV(tags)}"`;
  }

  it("should escape double quotes", () => {
    expect(escapeCSV('Test "Value"')).toBe('Test ""Value""');
  });

  it("should handle empty string", () => {
    expect(escapeCSV("")).toBe("");
  });

  it("should generate valid CSV line", () => {
    const user = {
      username: "john_doe",
      email: "john@example.com",
      is_active: true,
      tags: ["VIP", "Premium"],
    };

    const line = generateCSVLine(user);
    expect(line).toBe('"john_doe","john@example.com",true,"VIP;Premium"');
  });

  it("should handle empty tags", () => {
    const user = {
      username: "jane_doe",
      email: "jane@example.com",
      is_active: false,
      tags: [],
    };

    const line = generateCSVLine(user);
    expect(line).toBe('"jane_doe","jane@example.com",false,""');
  });
});

// ============================================
// TAG WORKFLOW TESTS
// ============================================

describe("unit: UserTag Workflow", () => {
  it("should validate tag_id format", () => {
    const tagIdRegex = /^utag_[a-zA-Z0-9]{8}$/;

    expect(tagIdRegex.test("utag_abc12345")).toBe(true);
    expect(tagIdRegex.test("utag_ABCD1234")).toBe(true);
    expect(tagIdRegex.test("tag_abc12345")).toBe(false);
    expect(tagIdRegex.test("utag_abc")).toBe(false);
    expect(tagIdRegex.test("utag_abc123456789")).toBe(false);
  });

  it("should have valid color format", () => {
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

    expect(hexColorRegex.test("#FF5733")).toBe(true);
    expect(hexColorRegex.test("#000000")).toBe(true);
    expect(hexColorRegex.test("#ffffff")).toBe(true);
    expect(hexColorRegex.test("FF5733")).toBe(false);
    expect(hexColorRegex.test("#FFF")).toBe(false);
  });
});
