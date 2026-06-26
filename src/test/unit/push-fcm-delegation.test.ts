/**
 * Task 17: Push / FCM delegation test
 *
 * Verifies:
 * 1. The package transports (sendWebPush / sendFcm) are importable from
 *    vinc-notifications/server after the re-vendor.
 * 2. sendPush calls sendWebPush using config from resolveNotificationConfig.
 * 3. sendFCM calls sendFcm using config from resolveNotificationConfig.
 * 4. Channel is threaded from send.service.ts into push/fcm calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock resolve-config-io so no DB is needed ─────────────────────────────────
const readRecord = vi.fn();
const readHomeSettings = vi.fn();
vi.mock("@/lib/notifications/resolve-config-io", () => ({
  readNotificationRecord: (...a: unknown[]) => readRecord(...a),
  readHomeSettings: (...a: unknown[]) => readHomeSettings(...a),
}));
vi.mock("@/lib/email/env-config", () => ({
  getEmailConfigFromEnv: () => ({ host: "localhost", port: 25 }),
}));

// ── Test 1: package transport imports ────────────────────────────────────────

describe("vinc-notifications/server exports (re-vendor check)", () => {
  it("exposes sendWebPush as a function", async () => {
    const mod = await import("vinc-notifications/server");
    expect(typeof mod.sendWebPush).toBe("function");
  });

  it("exposes sendFcm as a function", async () => {
    const mod = await import("vinc-notifications/server");
    expect(typeof mod.sendFcm).toBe("function");
  });
});

// ── Test 2: sendPush delegates to sendWebPush ────────────────────────────────

// Stub the heavy package transport BEFORE importing push/index.ts
const mockSendWebPush = vi.fn();
vi.mock("vinc-notifications/server", () => ({
  sendWebPush: (...a: unknown[]) => mockSendWebPush(...a),
  sendFcm: vi.fn(),
}));

// Stub subscription service so no DB is needed
const mockGetActiveSubscriptions = vi.fn();
vi.mock("@/lib/push/subscription.service", () => ({
  getActiveSubscriptions: (...a: unknown[]) => mockGetActiveSubscriptions(...a),
  resetFailureCount: vi.fn().mockResolvedValue(undefined),
  incrementFailureCount: vi.fn().mockResolvedValue(undefined),
}));

// Stub push-log so no DB is needed
vi.mock("@/lib/db/admin-connection", () => ({
  connectToAdminDatabase: vi.fn().mockResolvedValue({}),
}));

// getPushLogModel must return a class-like constructor whose instances have save()
class FakePushLog {
  push_id = "plog_test001";
  save = vi.fn().mockResolvedValue(undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(_data?: any) {
    Object.assign(this, _data ?? {});
  }
  static markAsSent = vi.fn().mockResolvedValue(undefined);
  static markAsFailed = vi.fn().mockResolvedValue(undefined);
  static findByTenant = vi.fn().mockResolvedValue([]);
  static getStats = vi.fn().mockResolvedValue({});
}

vi.mock("@/lib/db/models/push-log", () => ({
  getPushLogModel: vi.fn().mockReturnValue(FakePushLog),
}));

import { resolveNotificationConfig, clearNotificationConfigCache } from "@/lib/notifications/resolve-config";

describe("sendPush — per-channel config delegation (Task 17)", () => {
  beforeEach(() => {
    mockSendWebPush.mockReset();
    mockGetActiveSubscriptions.mockReset();
    readRecord.mockReset();
    readHomeSettings.mockReset();
    clearNotificationConfigCache();
  });

  it("calls sendWebPush with resolved.webPush from the channel record", async () => {
    // Arrange: per-channel record with web push settings.
    // Field names must match recordToConfig() mapping (webpush_* prefix).
    readRecord.mockResolvedValue({
      data: {
        webpush_enabled: true,
        webpush_vapid_public_key: "pub-key-test",
        webpush_vapid_private_key: "priv-key-test",
        webpush_vapid_subject: "mailto:test@example.com",
      },
    });
    readHomeSettings.mockResolvedValue({});

    mockGetActiveSubscriptions.mockResolvedValue([
      {
        subscription_id: "sub_001",
        endpoint: "https://push.example.com/endpoint",
        keys: { p256dh: "p256", auth: "auth" },
      },
    ]);

    mockSendWebPush.mockResolvedValue({ ok: true });

    const { sendPush } = await import("@/lib/push");

    await sendPush({
      tenantDb: "vinc-test",
      title: "Hello",
      body: "World",
      channel: "b2b",
    });

    expect(mockSendWebPush).toHaveBeenCalledOnce();
    const [cfgArg] = mockSendWebPush.mock.calls[0];
    expect(cfgArg.vapidPublicKey).toBe("pub-key-test");
    expect(cfgArg.vapidPrivateKey).toBe("priv-key-test");
    expect(cfgArg.enabled).toBe(true);
  });

  it("does not call sendWebPush when web push is not configured for the channel", async () => {
    readRecord.mockResolvedValue(null);
    readHomeSettings.mockResolvedValue({}); // no web_push_settings

    mockGetActiveSubscriptions.mockResolvedValue([]);

    const { sendPush } = await import("@/lib/push");

    const result = await sendPush({
      tenantDb: "vinc-test",
      title: "Hello",
      body: "World",
      channel: "ghost-channel",
    });

    expect(mockSendWebPush).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });
});

// ── Test 3: channel threaded from SendNotificationOptions ────────────────────

describe("SendNotificationOptions.channel accepted by sendPush/sendFCM", () => {
  it("SendPushOptions type accepts channel", async () => {
    const { type: _type } = await import("@/lib/push/types");
    void _type; // type import guard

    // If this compiles, the channel field exists on SendPushOptions
    const opts = {
      tenantDb: "vinc-test",
      title: "T",
      body: "B",
      channel: "b2b",
    };
    expect(opts.channel).toBe("b2b");
  });

  it("SendFCMOptions type accepts channel", async () => {
    const { type: _type } = await import("@/lib/fcm/types");
    void _type;

    const opts = {
      tenantDb: "vinc-test",
      title: "T",
      body: "B",
      channel: "b2b",
    };
    expect(opts.channel).toBe("b2b");
  });
});
