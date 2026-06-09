import { describe, it, expect } from "vitest";
import {
  CHANNEL_RELATION_ID,
  isChannelRelation,
  applyChannelRelationDefaults,
  resolveRecordRelationId,
} from "@/lib/db/models/data-model-definition";

describe("unit: channel-relation helpers", () => {
  it("exposes the sentinel relation_id", () => {
    expect(CHANNEL_RELATION_ID).toBe("_channel");
  });

  it("detects the channel relation", () => {
    expect(isChannelRelation("channel")).toBe(true);
    expect(isChannelRelation("customer")).toBe(false);
    expect(isChannelRelation("portal_user")).toBe(false);
  });

  it("forces single cardinality and wildcard channel for channel models", () => {
    const out = applyChannelRelationDefaults({
      relation: "channel",
      cardinality: "multiple",
      channel: "default",
      name: "Channel settings",
    });
    expect(out.cardinality).toBe("single");
    expect(out.channel).toBe("*");
    expect(out.name).toBe("Channel settings");
  });

  it("leaves non-channel definitions untouched", () => {
    const input = { relation: "customer" as const, cardinality: "multiple" as const, channel: "default" };
    const out = applyChannelRelationDefaults(input);
    expect(out).toEqual(input);
  });

  it("pins relation_id to the sentinel for channel records, passes others through", () => {
    expect(resolveRecordRelationId("channel", "anything")).toBe("_channel");
    expect(resolveRecordRelationId("customer", "C-123")).toBe("C-123");
  });
});
