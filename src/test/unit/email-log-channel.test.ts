import { describe, it, expect, vi, beforeEach } from "vitest";
import { EmailLogSchema } from "@/lib/db/models/email-log";

// ─── Mocks (hoisted before imports) ───────────────────────────────────────────

const mockResolveNotificationConfig = vi.fn();
vi.mock("@/lib/notifications/resolve-config", () => ({
  resolveNotificationConfig: (...a: unknown[]) => mockResolveNotificationConfig(...a),
}));

// ─── Imports that depend on mocks ─────────────────────────────────────────────

import { fetchTenantEmailConfig, clearEmailConfigCache } from "@/lib/email";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockResolved = {
  channel: "default",
  email: {
    enabled: true,
    transport: "smtp" as const,
    from: "test@example.com",
    fromName: "Test Sender",
    smtp: { host: "smtp.example.com", port: 587, secure: false, user: "user", password: "pass" },
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("EmailLog schema — channel field", () => {
  it("has a channel path", () => {
    expect(EmailLogSchema.path("channel")).toBeDefined();
  });

  it("channel path is a String type", () => {
    const path = EmailLogSchema.path("channel");
    expect(path).toBeDefined();
    expect(path?.instance).toBe("String");
  });

  it("channel path has an index", () => {
    const indexes = EmailLogSchema.indexes();
    const hasChannelIndex = indexes.some(([fields]) => "channel" in (fields as Record<string, unknown>));
    expect(hasChannelIndex).toBe(true);
  });
});

describe("fetchTenantEmailConfig — cache re-keyed by (tenantDb, channel)", () => {
  beforeEach(() => {
    mockResolveNotificationConfig.mockReset();
    mockResolveNotificationConfig.mockResolvedValue(mockResolved);
    clearEmailConfigCache();
  });

  it("delegates to resolveNotificationConfig with the channel arg", async () => {
    await fetchTenantEmailConfig("vinc-acme", "b2b");
    expect(mockResolveNotificationConfig).toHaveBeenCalledWith("vinc-acme", "b2b");
  });

  it("defaults channel to 'default' when not provided", async () => {
    await fetchTenantEmailConfig("vinc-acme");
    expect(mockResolveNotificationConfig).toHaveBeenCalledWith("vinc-acme", "default");
  });

  it("caches per (tenantDb, channel) — same args hit cache on second call", async () => {
    await fetchTenantEmailConfig("vinc-acme", "b2b");
    await fetchTenantEmailConfig("vinc-acme", "b2b");
    expect(mockResolveNotificationConfig).toHaveBeenCalledTimes(1);
  });

  it("re-fetches when channel differs", async () => {
    await fetchTenantEmailConfig("vinc-acme", "b2b");
    await fetchTenantEmailConfig("vinc-acme", "b2c");
    expect(mockResolveNotificationConfig).toHaveBeenCalledTimes(2);
  });

  it("maps resolved email config to TenantEmailConfig (smtp path)", async () => {
    const result = await fetchTenantEmailConfig("vinc-acme", "b2b");
    expect(result.transport).toBe("smtp");
    expect(result.smtp.host).toBe("smtp.example.com");
    expect(result.smtp.from).toBe("test@example.com");
    expect(result.smtp.fromName).toBe("Test Sender");
  });
});
