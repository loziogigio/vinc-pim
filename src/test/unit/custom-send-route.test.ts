import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/tenant-auth", () => ({
  requireTenantAuth: async () => ({ success: true, tenantDb: "vinc-acme", tenantId: "acme", userId: "u" }),
}));
const cap = vi.fn();
vi.mock("@/lib/notifications/custom-send-cap", () => ({ enforceCustomSendCap: (...a: unknown[]) => cap(...a) }));
const send = vi.fn();
vi.mock("@/lib/notifications/custom-send.service", async (orig) => {
  const actual = await (orig as () => Promise<Record<string, unknown>>)();
  return { ...actual, sendCustomNotification: (...a: unknown[]) => send(...a) };
});

import { POST } from "@/app/api/b2b/notifications/custom/route";

function req(body: unknown) {
  return new Request("http://x/api/b2b/notifications/custom", { method: "POST", body: JSON.stringify(body) }) as never;
}

describe("POST /api/b2b/notifications/custom", () => {
  beforeEach(() => { cap.mockReset(); send.mockReset(); cap.mockResolvedValue({ allowed: true, retryAfter: 0 }); });

  it("400 on invalid body (no channels)", async () => {
    const res = await POST(req({ message: {} }));
    expect((res as Response).status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("429 when the rate cap blocks", async () => {
    cap.mockResolvedValue({ allowed: false, retryAfter: 42 });
    const res = await POST(req({ channels: ["sms"], sms_to: "+39333", message: { text: "B" } }));
    expect((res as Response).status).toBe(429);
    const json = await (res as Response).json();
    expect(json.retry_after).toBe(42);
    expect(send).not.toHaveBeenCalled();
  });

  it("200 and returns results on success, forwarding tenantDb", async () => {
    send.mockResolvedValue({ ok: true, results: { sms: { ok: true, logId: "s1" } } });
    const res = await POST(req({ channels: ["sms"], sms_to: "+39333", message: { text: "B" } }));
    expect((res as Response).status).toBe(200);
    const json = await (res as Response).json();
    expect(json.ok).toBe(true);
    expect(json.results.sms.logId).toBe("s1");
    expect(send.mock.calls[0][0]).toMatchObject({ tenantDb: "vinc-acme", sms_to: "+39333" });
  });
});
