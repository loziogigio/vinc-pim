import { describe, it, expect } from "vitest";
import { channelFieldGroups, channelStatus } from "@/lib/notifications/channel-status";
import { SECRET_MASK } from "@/lib/data-models/redact-secrets";
import { NOTIFICATION_SETTINGS_FIELDS } from "vinc-notifications";

describe("channelFieldGroups", () => {
  it("partitions every field into exactly one channel group", () => {
    const g = channelFieldGroups();
    const total = g.email.length + g.sms.length + g.webpush.length + g.fcm.length;
    // every NOTIFICATION_SETTINGS_FIELD is grouped (none dropped, none double-counted)
    expect(g.email.some((f) => f.slug === "smtp_host")).toBe(true);
    expect(g.email.some((f) => f.slug === "graph_client_secret")).toBe(true);
    expect(g.sms.some((f) => f.slug === "sms_api_key")).toBe(true);
    expect(g.webpush.some((f) => f.slug === "webpush_vapid_private_key")).toBe(true);
    expect(g.fcm.some((f) => f.slug === "fcm_private_key")).toBe(true);
    expect(total).toBe(NOTIFICATION_SETTINGS_FIELDS.length);
  });
});

describe("channelStatus", () => {
  it("reports off when a channel is disabled", () => {
    expect(channelStatus({}).email).toEqual({ enabled: false, state: "off" });
  });
  it("reports configured for enabled SMTP email with a host (secret backfilled)", () => {
    const s = channelStatus({ email_enabled: true, email_transport: "smtp", smtp_host: "smtp-relay.brevo.com" });
    expect(s.email).toEqual({ enabled: true, state: "configured" });
  });
  it("reports incomplete for enabled email missing host", () => {
    expect(channelStatus({ email_enabled: true, email_transport: "smtp" }).email.state).toBe("incomplete");
  });
  it("treats a masked secret as present for SMS", () => {
    const s = channelStatus({ sms_enabled: true, sms_sender_id: "Efakturuj", sms_api_key: SECRET_MASK });
    expect(s.sms).toEqual({ enabled: true, state: "configured" });
  });
  it("reports fcm incomplete when private key missing", () => {
    const s = channelStatus({ fcm_enabled: true, fcm_project_id: "p", fcm_client_email: "x@y" });
    expect(s.fcm.state).toBe("incomplete");
  });
});
