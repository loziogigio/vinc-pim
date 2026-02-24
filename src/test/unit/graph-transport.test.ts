import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isGraphConfigured,
  toRecipientList,
  toGraphAttachments,
  sendViaGraph,
  clearGraphTokenCache,
} from "@/lib/email/graph-transport";
import type { GraphSettings } from "@/lib/types/home-settings";

// ============================================
// isGraphConfigured
// ============================================

describe("unit: isGraphConfigured", () => {
  it("should return false for undefined settings", () => {
    expect(isGraphConfigured(undefined)).toBe(false);
  });

  it("should return false for empty settings", () => {
    expect(isGraphConfigured({})).toBe(false);
  });

  it("should return false for partial settings (missing sender_email)", () => {
    expect(
      isGraphConfigured({
        client_id: "abc",
        azure_tenant_id: "def",
        client_secret: "ghi",
      })
    ).toBe(false);
  });

  it("should return false for partial settings (missing client_secret)", () => {
    expect(
      isGraphConfigured({
        client_id: "abc",
        azure_tenant_id: "def",
        sender_email: "test@example.com",
      })
    ).toBe(false);
  });

  it("should return true for complete settings", () => {
    expect(
      isGraphConfigured({
        client_id: "abc",
        azure_tenant_id: "def",
        client_secret: "ghi",
        sender_email: "test@example.com",
      })
    ).toBe(true);
  });

  it("should return true even without optional fields", () => {
    expect(
      isGraphConfigured({
        client_id: "abc",
        azure_tenant_id: "def",
        client_secret: "ghi",
        sender_email: "test@example.com",
        // sender_name and save_to_sent_items are optional
      })
    ).toBe(true);
  });
});

// ============================================
// toRecipientList
// ============================================

describe("unit: toRecipientList", () => {
  it("should return undefined for undefined input", () => {
    expect(toRecipientList(undefined)).toBeUndefined();
  });

  it("should return undefined for empty array", () => {
    expect(toRecipientList([])).toBeUndefined();
  });

  it("should convert a single string to recipient list", () => {
    const result = toRecipientList("test@example.com");
    expect(result).toEqual([
      { emailAddress: { address: "test@example.com" } },
    ]);
  });

  it("should convert an array of strings to recipient list", () => {
    const result = toRecipientList(["a@test.com", "b@test.com"]);
    expect(result).toEqual([
      { emailAddress: { address: "a@test.com" } },
      { emailAddress: { address: "b@test.com" } },
    ]);
  });

  it("should trim whitespace from addresses", () => {
    const result = toRecipientList("  test@example.com  ");
    expect(result).toEqual([
      { emailAddress: { address: "test@example.com" } },
    ]);
  });
});

// ============================================
// toGraphAttachments
// ============================================

describe("unit: toGraphAttachments", () => {
  it("should return undefined for undefined input", () => {
    expect(toGraphAttachments(undefined)).toBeUndefined();
  });

  it("should return undefined for empty array", () => {
    expect(toGraphAttachments([])).toBeUndefined();
  });

  it("should convert string content to base64 attachment", () => {
    const result = toGraphAttachments([
      {
        filename: "test.txt",
        content: "Hello World",
        contentType: "text/plain",
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result![0]["@odata.type"]).toBe(
      "#microsoft.graph.fileAttachment"
    );
    expect(result![0].name).toBe("test.txt");
    expect(result![0].contentType).toBe("text/plain");
    expect(result![0].contentBytes).toBe(
      Buffer.from("Hello World").toString("base64")
    );
  });

  it("should convert Buffer content to base64 attachment", () => {
    const buf = Buffer.from("PDF content here");
    const result = toGraphAttachments([
      {
        filename: "doc.pdf",
        content: buf,
        contentType: "application/pdf",
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result![0].contentBytes).toBe(buf.toString("base64"));
  });

  it("should use default contentType when not provided", () => {
    const result = toGraphAttachments([
      { filename: "file.bin", content: "data" },
    ]);
    expect(result![0].contentType).toBe("application/octet-stream");
  });
});

// ============================================
// sendViaGraph (validation only, no network)
// ============================================

describe("unit: sendViaGraph", () => {
  it("should return error for incomplete config", async () => {
    const result = await sendViaGraph(
      { client_id: "abc" } as GraphSettings,
      { to: "test@example.com", subject: "Test" }
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("Incomplete Graph API configuration");
  });

  it("should return error for empty settings", async () => {
    const result = await sendViaGraph({}, {
      to: "test@example.com",
      subject: "Test",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Incomplete Graph API configuration");
  });
});

// ============================================
// Token cache behavior
// ============================================

describe("unit: Graph token cache", () => {
  const settings: GraphSettings = {
    client_id: "test-client",
    azure_tenant_id: "test-tenant",
    client_secret: "test-secret",
    sender_email: "test@example.com",
  };

  beforeEach(() => {
    clearGraphTokenCache(settings);
    vi.restoreAllMocks();
  });

  it("clearGraphTokenCache should not throw for unknown settings", () => {
    expect(() =>
      clearGraphTokenCache({
        client_id: "unknown",
        azure_tenant_id: "unknown",
      })
    ).not.toThrow();
  });
});
