import { describe, it, expect, vi, beforeEach } from "vitest";

const sendEmail = vi.fn();
const sendSms = vi.fn();
const sendPush = vi.fn();
const sendFCM = vi.fn();
vi.mock("@/lib/email", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }));
vi.mock("@/lib/sms", () => ({ sendSms: (...a: unknown[]) => sendSms(...a) }));
vi.mock("@/lib/push", () => ({ sendPush: (...a: unknown[]) => sendPush(...a) }));
vi.mock("@/lib/fcm", () => ({ sendFCM: (...a: unknown[]) => sendFCM(...a) }));

import { sendCustomNotification } from "@/lib/notifications/custom-send.service";

describe("sendCustomNotification", () => {
  beforeEach(() => { sendEmail.mockReset(); sendSms.mockReset(); sendPush.mockReset(); sendFCM.mockReset(); });

  it("dispatches email + sms with mapped inline content and aggregates ok", async () => {
    sendEmail.mockResolvedValue({ success: true, emailId: "e1", messageId: "m1" });
    sendSms.mockResolvedValue({ ok: true, logId: "s1" });
    const res = await sendCustomNotification({
      tenantDb: "vinc-acme", channel: "default", channels: ["email", "sms"],
      to: "x@a.it", sms_to: "+39333", immediate: true,
      message: { subject: "Hi", html: "<p>Hi</p>", text: "Hi sms" },
    });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "x@a.it", subject: "Hi", html: "<p>Hi</p>", immediate: true, tenantDb: "vinc-acme", channel: "default",
    }));
    expect(sendSms).toHaveBeenCalledWith(expect.objectContaining({
      to: "+39333", body: "Hi sms", tenantDb: "vinc-acme", channel: "default", immediate: true,
    }));
    expect(res.ok).toBe(true);
    expect(res.results.email).toMatchObject({ ok: true, logId: "e1", messageId: "m1" });
    expect(res.results.sms).toMatchObject({ ok: true, logId: "s1" });
  });

  it("marks ok=false when a channel fails", async () => {
    sendEmail.mockResolvedValue({ success: false, emailId: "e1", error: "smtp down" });
    const res = await sendCustomNotification({
      tenantDb: "vinc-acme", channel: "default", channels: ["email"],
      to: "x@a.it", immediate: true, message: { subject: "Hi", text: "B" },
    });
    expect(res.ok).toBe(false);
    expect(res.results.email).toMatchObject({ ok: false, error: "smtp down" });
  });

  it("captures a thrown send error as a failed channel result, without throwing", async () => {
    sendFCM.mockRejectedValue(new Error("boom"));
    const res = await sendCustomNotification({
      tenantDb: "vinc-acme", channel: "default", channels: ["fcm"],
      user_ids: ["u1"], immediate: false, message: { title: "T", body: "B" },
    });
    expect(res.ok).toBe(false);
    expect(res.results.fcm).toMatchObject({ ok: false, error: "boom" });
    expect(sendFCM).toHaveBeenCalledWith(expect.objectContaining({ queue: true, userIds: ["u1"] }));
  });
});
