import { describe, it, expect } from "vitest";
import { homeSettingsToRecord } from "@/scripts/seed-data-model-notification-settings";

describe("homeSettingsToRecord", () => {
  it("flattens homesettings into notification_settings slugs", () => {
    const rec = homeSettingsToRecord({
      email_transport: "smtp",
      smtp_settings: { host: "h", port: 587, secure: false, user: "u", password: "p", from: "f@x.it", from_name: "Shop" },
      graph_settings: { client_id: "cid", azure_tenant_id: "tid", client_secret: "cs", sender_email: "s@x.it" },
      web_push_settings: { enabled: true, vapid_public_key: "pub", vapid_private_key: "priv", vapid_subject: "mailto:a@x.it" },
      fcm_settings: { enabled: true, project_id: "proj", client_email: "svc@proj", private_key: "PK" },
    });
    expect(rec.smtp_host).toBe("h");
    expect(rec.smtp_port).toBe(587);
    expect(rec.email_from).toBe("f@x.it");
    expect(rec.graph_client_id).toBe("cid");
    expect(rec.webpush_enabled).toBe(true);
    expect(rec.webpush_vapid_private_key).toBe("priv");
    expect(rec.fcm_enabled).toBe(true);
    expect(rec.fcm_private_key).toBe("PK");
    expect(rec.email_enabled).toBe(true); // any email config present → enabled
  });
});
