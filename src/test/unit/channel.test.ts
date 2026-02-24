import { describe, it, expect } from "vitest";
import { DEFAULT_CHANNEL, isValidChannelCode } from "@/lib/constants/channel";

describe("unit: Sales Channel Constants", () => {
  it("should define 'default' as default channel", () => {
    expect(DEFAULT_CHANNEL).toBe("default");
  });

  it("should validate kebab-case channel codes", () => {
    expect(isValidChannelCode("b2b")).toBe(true);
    expect(isValidChannelCode("b2c")).toBe(true);
    expect(isValidChannelCode("ebay")).toBe(true);
    expect(isValidChannelCode("amazon")).toBe(true);
    expect(isValidChannelCode("slovakia")).toBe(true);
    expect(isValidChannelCode("czech-republic")).toBe(true);
    expect(isValidChannelCode("default")).toBe(true);
  });

  it("should reject invalid channel codes", () => {
    expect(isValidChannelCode("")).toBe(false);
    expect(isValidChannelCode("B2B")).toBe(false);
    expect(isValidChannelCode("my channel")).toBe(false);
    expect(isValidChannelCode("my_channel")).toBe(false);
    expect(isValidChannelCode("channel:code")).toBe(false);
    expect(isValidChannelCode("-starts-with-dash")).toBe(false);
    expect(isValidChannelCode("ends-with-dash-")).toBe(false);
  });
});
