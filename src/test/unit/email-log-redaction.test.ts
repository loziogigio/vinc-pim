import { describe, it, expect } from "vitest";
import { redactEmailLogSecrets } from "@/lib/email/log-redaction";

describe("redactEmailLogSecrets", () => {
  it("strips transport_config (which carries the SMTP password) from metadata", () => {
    const log = {
      _id: "1",
      to: "x@acme.it",
      status: "sent",
      metadata: {
        notification_log_id: "n1",
        transport_config: { transport: "smtp", smtp: { host: "h", user: "u", password: "shh" } },
      },
    };
    const out = redactEmailLogSecrets(log);
    expect("transport_config" in (out.metadata as Record<string, unknown>)).toBe(false);
    expect((out.metadata as Record<string, unknown>).notification_log_id).toBe("n1"); // non-secret metadata kept
    expect(out.status).toBe("sent");
    // original object not mutated
    expect("transport_config" in (log.metadata as Record<string, unknown>)).toBe(true);
  });

  it("is a no-op when there is no metadata or no transport_config", () => {
    expect(redactEmailLogSecrets({ _id: "1" })).toEqual({ _id: "1" });
    expect(redactEmailLogSecrets({ _id: "1", metadata: { ip: "1.2.3.4" } }).metadata).toEqual({ ip: "1.2.3.4" });
  });
});
