import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/tenant-auth", () => ({
  requireTenantAuth: async () => ({ success: true, tenantDb: "vinc-acme", tenantId: "acme", userId: "u" }),
}));
const resolve = vi.fn();
vi.mock("@/lib/notifications/resolve-config", () => ({ resolveNotificationConfig: (...a: unknown[]) => resolve(...a) }));
const smtp = vi.fn();
const smsSend = vi.fn();
vi.mock("vinc-notifications/server", () => ({
  sendEmailViaSmtp: (...a: unknown[]) => smtp(...a),
  sendEmailViaGraph: vi.fn(),
  createSmsSender: () => ({ send: (...a: unknown[]) => smsSend(...a) }),
  sendWebPush: vi.fn(), sendFcm: vi.fn(),
}));

import { POST } from "@/app/api/b2b/notifications/test-send/route";

function req(body: unknown) {
  return new Request("http://x/api/b2b/notifications/test-send", { method: "POST", body: JSON.stringify(body) }) as never;
}

describe("POST /api/b2b/notifications/test-send", () => {
  beforeEach(() => { resolve.mockReset(); smtp.mockReset(); smsSend.mockReset(); });

  it("sends a test email via the resolved channel config", async () => {
    resolve.mockResolvedValue({ channel: "b2b", email: { enabled: true, transport: "smtp", from: "s@x.it", smtp: { host: "h", port: 587 } } });
    smtp.mockResolvedValue({ ok: true, providerMessageId: "<m>" });
    const res = await POST(req({ channel: "b2b", deliveryChannel: "email", to: "x@acme.it" }));
    const json = await (res as Response).json();
    expect(resolve).toHaveBeenCalledWith("vinc-acme", "b2b");
    expect(json.ok).toBe(true);
  });

  it("returns skipped when email is disabled", async () => {
    resolve.mockResolvedValue({ email: { enabled: false } });
    const res = await POST(req({ channel: "b2b", deliveryChannel: "email", to: "x@acme.it" }));
    const json = await (res as Response).json();
    expect(json.ok).toBe(false);
    expect(json.skipped).toBe(true);
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await POST(req({ channel: "b2b", deliveryChannel: "email" }));
    expect((res as Response).status).toBe(400);
  });

  it("returns 422 for webpush", async () => {
    resolve.mockResolvedValue({});
    const res = await POST(req({ channel: "b2b", deliveryChannel: "webpush", to: "device-token" }));
    expect((res as Response).status).toBe(422);
    const json = await (res as Response).json();
    expect(json.ok).toBe(false);
  });

  it("returns 400 for unknown deliveryChannel", async () => {
    resolve.mockResolvedValue({});
    const res = await POST(req({ channel: "b2b", deliveryChannel: "carrier-pigeon", to: "somewhere" }));
    expect((res as Response).status).toBe(400);
  });

  it("sends a test SMS via the resolved channel config", async () => {
    resolve.mockResolvedValue({ channel: "b2b", sms: { enabled: true, provider: "brevo", apiKey: "k", senderId: "ACME" } });
    smsSend.mockResolvedValue({ ok: true });
    const res = await POST(req({ channel: "b2b", deliveryChannel: "sms", to: "+39333" }));
    const json = await (res as Response).json();
    expect(json.ok).toBe(true);
    expect(smsSend).toHaveBeenCalled();
  });
});
