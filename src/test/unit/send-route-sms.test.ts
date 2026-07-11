import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/tenant-auth", () => ({
  requireTenantAuth: async () => ({ success: true, tenantDb: "vinc-acme", tenantId: "acme", userId: "u" }),
}));
const send = vi.fn();
vi.mock("@/lib/notifications/send.service", () => ({
  sendNotification: (...a: unknown[]) => send(...a),
}));
vi.mock("@/lib/notifications/template.service", () => ({ listTemplates: vi.fn(async () => []) }));

import { POST } from "@/app/api/b2b/notifications/send/route";

function req(body: unknown) {
  return new Request("http://x/api/b2b/notifications/send", {
    method: "POST",
    body: JSON.stringify(body),
  }) as never;
}

describe("POST /api/b2b/notifications/send — sms_to forwarding", () => {
  beforeEach(() => send.mockReset());

  it("forwards sms_to to sendNotification as smsTo", async () => {
    send.mockResolvedValue({ success: true, emailId: "e1" });
    const res = await POST(
      req({
        trigger: "order_confirmation",
        to: "buyer@acme.it",
        sms_to: "+393929819914",
        variables: { order_number: "1234" },
      }),
    );
    expect((res as Response).status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({
      trigger: "order_confirmation",
      to: "buyer@acme.it",
      smsTo: "+393929819914",
    });
  });

  it("omits smsTo when sms_to is not provided", async () => {
    send.mockResolvedValue({ success: true, emailId: "e1" });
    await POST(req({ trigger: "order_confirmation", to: "buyer@acme.it", variables: {} }));
    expect(send.mock.calls[0][0].smsTo).toBeUndefined();
  });
});
