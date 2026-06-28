import { describe, it, expect } from "vitest";
import { validateCustomRequest } from "@/lib/notifications/custom-send.service";

const base = { channels: ["email"], to: "x@a.it", message: { subject: "Hi", text: "Body" } };

describe("validateCustomRequest", () => {
  it("accepts a valid email request and defaults channel/immediate", () => {
    const r = validateCustomRequest(base);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.value.channel).toBe("default"); expect(r.value.immediate).toBe(true); }
  });
  it("rejects empty channels", () => {
    expect(validateCustomRequest({ ...base, channels: [] }).ok).toBe(false);
  });
  it("rejects an unknown channel", () => {
    expect(validateCustomRequest({ ...base, channels: ["pigeon"] }).ok).toBe(false);
  });
  it("rejects email without a recipient", () => {
    expect(validateCustomRequest({ channels: ["email"], message: { subject: "Hi", text: "B" } }).ok).toBe(false);
  });
  it("rejects sms without sms_to", () => {
    expect(validateCustomRequest({ channels: ["sms"], message: { text: "B" } }).ok).toBe(false);
  });
  it("rejects webpush without user_ids", () => {
    expect(validateCustomRequest({ channels: ["webpush"], message: { title: "T", body: "B" } }).ok).toBe(false);
  });
  it("rejects an oversize subject", () => {
    expect(validateCustomRequest({ ...base, message: { subject: "x".repeat(201), text: "B" } }).ok).toBe(false);
  });
  it("honors explicit immediate=false", () => {
    const r = validateCustomRequest({ ...base, immediate: false });
    expect(r.ok && r.value.immediate).toBe(false);
  });
  it("rejects fcm without user_ids (independent of webpush)", () => {
    expect(validateCustomRequest({ channels: ["fcm"], message: { title: "T", body: "B" } }).ok).toBe(false);
  });
  it("rejects webpush/fcm when user_ids is an empty array", () => {
    expect(validateCustomRequest({ channels: ["webpush"], user_ids: [], message: { title: "T", body: "B" } }).ok).toBe(false);
  });
  it("does not throw on a non-object body and rejects it", () => {
    expect(() => validateCustomRequest("evil string")).not.toThrow();
    expect(validateCustomRequest("evil string").ok).toBe(false);
    expect(validateCustomRequest(null).ok).toBe(false);
  });
});
