import { describe, it, expect, vi, beforeEach } from "vitest";

const resolve = vi.fn();
vi.mock("@/lib/notifications/resolve-config", () => ({ resolveNotificationConfig: (...a: unknown[]) => resolve(...a) }));
const senderSend = vi.fn();
vi.mock("vinc-notifications/server", () => ({ createSmsSender: () => ({ send: senderSend }) }));

// Mock the DB layer so tests don't need a real MongoDB connection
const mockSmsLogSave = vi.fn().mockResolvedValue(undefined);
const mockSmsLogCreate = vi.fn().mockResolvedValue({
  _id: "mock-log-id",
  status: "sending",
  attempts: 0,
  save: mockSmsLogSave,
});
vi.mock("@/lib/db/connection", () => ({
  connectWithModels: vi.fn().mockResolvedValue({
    SmsLog: { create: (...a: unknown[]) => mockSmsLogCreate(...a) },
  }),
}));

import { sendSmsNow, queueSms } from "@/lib/sms";

describe("sendSmsNow", () => {
  beforeEach(() => {
    resolve.mockReset();
    senderSend.mockReset();
    mockSmsLogCreate.mockClear();
    mockSmsLogSave.mockClear();
  });
  it("resolves config by channel and calls the package sender", async () => {
    resolve.mockResolvedValue({ channel: "b2b", sms: { enabled: true, provider: "brevo", apiKey: "k", senderId: "ACME" } });
    senderSend.mockResolvedValue({ ok: true, providerMessageId: "42" });
    const res = await sendSmsNow({ to: "+39333", body: "Ciao", tenantDb: "vinc-acme", channel: "b2b" });
    expect(resolve).toHaveBeenCalledWith("vinc-acme", "b2b");
    expect(senderSend).toHaveBeenCalledWith({ to: "+39333", body: "Ciao" });
    expect(res.ok).toBe(true);
  });
  it("skips when sms disabled for the channel", async () => {
    resolve.mockResolvedValue({ channel: "b2b", sms: { enabled: false, provider: "brevo" } });
    const res = await sendSmsNow({ to: "+39333", body: "x", tenantDb: "vinc-acme", channel: "b2b" });
    expect(res.ok).toBe(false);
    expect(senderSend).not.toHaveBeenCalled();
  });
});

describe("queueSms", () => {
  beforeEach(() => {
    resolve.mockReset();
    senderSend.mockReset();
    mockSmsLogCreate.mockClear();
    mockSmsLogSave.mockClear();
  });

  it("skips when sms disabled — no log created, no enqueue", async () => {
    resolve.mockResolvedValue({ channel: "b2b", sms: { enabled: false, provider: "brevo" } });
    const res = await queueSms({ to: "+39333", body: "x", tenantDb: "vinc-acme", channel: "b2b" });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("SMS disabled for channel");
    // No SmsLog should have been created
    expect(mockSmsLogCreate).not.toHaveBeenCalled();
  });
});
