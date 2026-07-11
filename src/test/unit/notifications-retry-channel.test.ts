/**
 * Task 12: Channel-aware retry + availability routes
 *
 * Tests:
 *   1. isEmailEnabledAsync passes channelCode through to fetchTenantEmailConfig /
 *      resolveNotificationConfig (readNotificationRecord called with the right channel).
 *   2. isEmailEnabledAsync defaults to "default" channel when none supplied.
 *   3. Different channels are resolved independently (no cross-channel cache bleed).
 *   4. Graph transport: isEmailEnabledAsync returns true when all Graph credentials set.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock resolve-config-io so no DB is needed ────────────────────────────────
const readRecord = vi.fn();
const readHomeSettings = vi.fn();
vi.mock("@/lib/notifications/resolve-config-io", () => ({
  readNotificationRecord: (...a: unknown[]) => readRecord(...a),
  readHomeSettings: (...a: unknown[]) => readHomeSettings(...a),
}));
vi.mock("@/lib/email/env-config", () => ({
  getEmailConfigFromEnv: () => ({
    host: "",
    port: 587,
    secure: false,
    user: "",
    password: "",
    from: "",
    fromName: "VINC",
  }),
}));

import { isEmailEnabledAsync, clearEmailConfigCache } from "@/lib/email";
import { clearNotificationConfigCache } from "@/lib/notifications/resolve-config";

function resetCaches() {
  clearEmailConfigCache();
  clearNotificationConfigCache();
}

describe("isEmailEnabledAsync — channel passthrough (Task 12)", () => {
  beforeEach(() => {
    readRecord.mockReset();
    readHomeSettings.mockReset();
    resetCaches();
  });

  it("passes the channelCode to readNotificationRecord", async () => {
    readRecord.mockResolvedValue({
      data: {
        email_enabled: true,
        email_transport: "smtp",
        smtp_host: "mail.acme.it",
        smtp_user: "u",
        smtp_password: "p",
        email_from: "shop@acme.it",
      },
    });
    readHomeSettings.mockResolvedValue({});

    await isEmailEnabledAsync("vinc-acme", "b2b");

    expect(readRecord).toHaveBeenCalledWith("vinc-acme", "b2b");
  });

  it("returns true for a fully-configured SMTP channel", async () => {
    readRecord.mockResolvedValue({
      data: {
        email_enabled: true,
        email_transport: "smtp",
        smtp_host: "mail.acme.it",
        smtp_user: "u",
        smtp_password: "p",
        email_from: "shop@acme.it",
      },
    });
    readHomeSettings.mockResolvedValue({});

    const result = await isEmailEnabledAsync("vinc-acme", "b2b");
    expect(result).toBe(true);
  });

  it("defaults to 'default' channel when channelCode is omitted", async () => {
    readRecord.mockResolvedValue(null);
    readHomeSettings.mockResolvedValue({
      smtp_settings: { host: "mail.acme.it", from: "h@acme.it", user: "u", password: "p" },
    });

    await isEmailEnabledAsync("vinc-acme");

    expect(readRecord).toHaveBeenCalledWith("vinc-acme", "default");
  });

  it("returns true for Graph transport when all credentials are present", async () => {
    readRecord.mockResolvedValue({
      data: {
        email_enabled: true,
        email_transport: "graph",
        graph_azure_tenant_id: "aad-tenant-id",
        graph_client_id: "app-client-id",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ["graph_client_secret" as any]: "test-only-value",
        graph_sender_email: "no-reply@acme.onmicrosoft.com",
      },
    });
    readHomeSettings.mockResolvedValue({});

    const result = await isEmailEnabledAsync("vinc-acme", "graph-channel");
    expect(result).toBe(true);
  });

  it("returns false when no SMTP is configured (no host, no env fallback)", async () => {
    // No record → falls back to homeSettings → no smtp → falls back to env → env has no host
    readRecord.mockResolvedValue(null);
    readHomeSettings.mockResolvedValue({});

    const result = await isEmailEnabledAsync("vinc-acme", "unconfigured");
    expect(result).toBe(false);
  });

  it("resolves different channels independently — no cross-channel cache bleed", async () => {
    readRecord.mockImplementation((_db: unknown, channel: unknown) =>
      channel === "b2b"
        ? Promise.resolve({
            data: {
              email_enabled: true,
              email_transport: "smtp",
              smtp_host: "b2b.acme.it",
              smtp_user: "u",
              smtp_password: "p",
              email_from: "b2b@acme.it",
            },
          })
        : Promise.resolve(null) // other channels → not configured
    );
    readHomeSettings.mockResolvedValue({});

    const b2bEnabled = await isEmailEnabledAsync("vinc-acme", "b2b");
    const b2cEnabled = await isEmailEnabledAsync("vinc-acme", "b2c");

    expect(b2bEnabled).toBe(true);
    expect(b2cEnabled).toBe(false); // b2c → null record → env fallback → no host → false
  });
});
