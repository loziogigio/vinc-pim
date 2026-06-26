import { describe, it, expect, vi, beforeEach } from "vitest";

const readRecord = vi.fn();
const readHomeSettings = vi.fn();
vi.mock("@/lib/notifications/resolve-config-io", () => ({
  readNotificationRecord: (...a: unknown[]) => readRecord(...a),
  readHomeSettings: (...a: unknown[]) => readHomeSettings(...a),
}));
vi.mock("@/lib/email", () => ({
  getEmailConfigFromEnv: () => ({ host: "env-host", port: 25 }),
}));

import { resolveNotificationConfig, clearNotificationConfigCache } from "@/lib/notifications/resolve-config";

describe("resolveNotificationConfig", () => {
  beforeEach(() => { readRecord.mockReset(); readHomeSettings.mockReset(); clearNotificationConfigCache(); });

  it("uses the channel record when present and enabled", async () => {
    readRecord.mockResolvedValue({ data: { email_enabled: true, email_transport: "smtp", smtp_host: "rec-host" } });
    readHomeSettings.mockResolvedValue({});
    const cfg = await resolveNotificationConfig("vinc-acme", "b2b");
    expect(cfg.channel).toBe("b2b");
    expect(cfg.email?.enabled).toBe(true);
    expect(cfg.email?.smtp?.host).toBe("rec-host");
  });

  it("falls back to homesettings when no record exists", async () => {
    readRecord.mockResolvedValue(null);
    readHomeSettings.mockResolvedValue({
      smtp_settings: { host: "home-host", port: 587, from: "h@acme.it" },
    });
    const cfg = await resolveNotificationConfig("vinc-acme", "default");
    expect(cfg.email?.smtp?.host).toBe("home-host");
  });

  it("never throws on an unknown channel with no record and no homesettings", async () => {
    readRecord.mockResolvedValue(null);
    readHomeSettings.mockResolvedValue({});
    const cfg = await resolveNotificationConfig("vinc-acme", "ghost-channel");
    expect(cfg.channel).toBe("ghost-channel");
    // email falls back to env as the last resort
    expect(cfg.email?.smtp?.host).toBe("env-host");
  });

  it("caches by (tenantDb, channel) — second call does not re-read", async () => {
    readRecord.mockResolvedValue({ data: { email_enabled: true } });
    readHomeSettings.mockResolvedValue({});
    await resolveNotificationConfig("vinc-acme", "b2b");
    await resolveNotificationConfig("vinc-acme", "b2b");
    expect(readRecord).toHaveBeenCalledTimes(1);
    await resolveNotificationConfig("vinc-acme", "b2c"); // different channel re-reads
    expect(readRecord).toHaveBeenCalledTimes(2);
  });

  it("falls back to homesettings for webPush when record has webpush_enabled:true but no VAPID keys", async () => {
    readRecord.mockResolvedValue({ data: { webpush_enabled: true } });
    readHomeSettings.mockResolvedValue({
      web_push_settings: {
        enabled: true,
        vapid_public_key: "home-vapid-pub",
        vapid_private_key: "home-vapid-priv",
        vapid_subject: "mailto:admin@acme.it",
      },
    });
    const cfg = await resolveNotificationConfig("vinc-acme", "b2b");
    expect(cfg.webPush?.vapidPublicKey).toBe("home-vapid-pub");
  });

  it("falls back to homesettings for mobilePush when record has fcm_enabled:true but no FCM creds", async () => {
    readRecord.mockResolvedValue({ data: { fcm_enabled: true } });
    readHomeSettings.mockResolvedValue({
      fcm_settings: {
        enabled: true,
        project_id: "home-project",
        client_email: "firebase@home.iam.gserviceaccount.com",
        private_key: "home-private-key",
      },
    });
    const cfg = await resolveNotificationConfig("vinc-acme", "b2b");
    expect(cfg.mobilePush?.projectId).toBe("home-project");
  });
});
