import { describe, it, expect } from "vitest";
import { NOTIFICATION_SETTINGS_BLUEPRINT } from "@/lib/data-models/blueprints/notification-settings";
import { NOTIFICATION_SETTINGS_FIELDS } from "vinc-notifications";

describe("NOTIFICATION_SETTINGS_BLUEPRINT", () => {
  it("is channel-scoped, single, not end-user readable", () => {
    const d = NOTIFICATION_SETTINGS_BLUEPRINT.definition;
    expect(d.slug).toBe("notification_settings");
    expect(d.relation).toBe("channel");
    expect(d.cardinality).toBe("single");
    expect(d.readable_by_end_user).toBe(false);
    expect(d.enabled).toBe(true);
  });
  it("builds one DataModelField per descriptor", () => {
    expect(NOTIFICATION_SETTINGS_BLUEPRINT.definition.fields).toHaveLength(NOTIFICATION_SETTINGS_FIELDS.length);
  });
});
