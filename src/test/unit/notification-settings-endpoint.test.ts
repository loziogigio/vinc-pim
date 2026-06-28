import { describe, it, expect } from "vitest";
import { composeStatus } from "@/lib/notifications/settings-status";

describe("composeStatus fallback overrides", () => {
  it("marks email configured when homesettings fallback is enabled even if record is empty", () => {
    const s = composeStatus({}, { emailFallback: true, fcmFallback: false });
    expect(s.email.state).toBe("configured");
    expect(s.fcm.state).toBe("off");
  });
  it("keeps record-based status when no fallback", () => {
    const s = composeStatus({ sms_enabled: true, sms_sender_id: "X", sms_api_key: "k" }, { emailFallback: false, fcmFallback: false });
    expect(s.sms.state).toBe("configured");
    expect(s.email.state).toBe("off");
  });
  it("marks fcm configured via fallback", () => {
    expect(composeStatus({}, { emailFallback: false, fcmFallback: true }).fcm.state).toBe("configured");
  });
});
