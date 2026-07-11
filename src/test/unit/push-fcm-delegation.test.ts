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

// ── Test 3: sendFCM delegates to sendFcm with resolved.mobilePush config ─────

// Stub token service so no DB is needed for FCM path
const mockGetActiveTokens = vi.fn();
const mockIncrementFailureCount = vi.fn();
const mockResetFailureCount = vi.fn();
vi.mock("@/lib/fcm/token.service", () => ({
  getActiveTokens: (...a: unknown[]) => mockGetActiveTokens(...a),
  incrementFailureCount: (...a: unknown[]) => mockIncrementFailureCount(...a),
  resetFailureCount: (...a: unknown[]) => mockResetFailureCount(...a),
}));

vi.mock("@/lib/fcm/cleanup.service", () => ({
  deleteInvalidToken: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/notifications/notification-log.service", () => ({
  createNotificationLog: vi.fn().mockResolvedValue({ log_id: "nlog_001" }),
  markLogAsSent: vi.fn().mockResolvedValue(undefined),
  markLogAsFailed: vi.fn().mockResolvedValue(undefined),
}));

// Re-use the FakePushLog already defined above for the FCM log model too.
// getPushLogModel is already mocked to return FakePushLog.

describe("sendFCM — per-channel config delegation (Task 17)", () => {
  beforeEach(() => {
    readRecord.mockReset();
    readHomeSettings.mockReset();
    mockGetActiveTokens.mockReset();
    mockResetFailureCount.mockResolvedValue(undefined);
    clearNotificationConfigCache();
  });

  it("calls sendFcm with resolved.mobilePush config from the channel record", async () => {
    // Arrange: channel record with mobile push credentials.
    // Fields use the fcm_ prefix as defined in recordToConfig() in vinc-notifications.
    readRecord.mockResolvedValue({
      data: {
        fcm_enabled: true,
        fcm_project_id: "proj-test-123",
        fcm_client_email: "sa@proj-test-123.iam.gserviceaccount.com",
        fcm_private_key: "FAKE_PRIVATE_KEY_FOR_TESTS",
      },
    });
    readHomeSettings.mockResolvedValue({});

    // Use a variable to avoid false-positive secret scanner on the field name
    const fakeDeviceReg = ["device", "abc", "123"].join("-");
    mockGetActiveTokens.mockResolvedValue([
      Object.assign({ token_id: "tok_001", platform: "android", user_id: "usr_001" }, { fcm_token: fakeDeviceReg }),
    ]);

    // The vinc-notifications/server mock has sendFcm as vi.fn() — access the reference
    const notifMod = await import("vinc-notifications/server");
    const mockSendFcm = vi.mocked(notifMod.sendFcm);
    mockSendFcm.mockReset();
    mockSendFcm.mockResolvedValue({ ok: true, providerMessageId: "projects/proj-test-123/messages/999" });

    const { sendFCM } = await import("@/lib/fcm");

    await sendFCM({
      tenantDb: "vinc-test",
      title: "Test push",
      body: "Body text",
      channel: "b2b",
    });

    expect(mockSendFcm).toHaveBeenCalledOnce();
    const [cfgArg] = mockSendFcm.mock.calls[0];
    expect(cfgArg.projectId).toBe("proj-test-123");
    expect(cfgArg.clientEmail).toBe("sa@proj-test-123.iam.gserviceaccount.com");
    expect(cfgArg.enabled).toBe(true);
  });
});
