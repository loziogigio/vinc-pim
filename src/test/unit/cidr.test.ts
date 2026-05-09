/**
 * Unit tests for the CIDR allowlist matcher.
 */

import { describe, it, expect } from "vitest";
import { isValidCidr, matchesAnyCIDR } from "@/lib/utils/cidr";

describe("unit: cidr - isValidCidr", () => {
  it("accepts valid IPv4 CIDR", () => {
    expect(isValidCidr("10.0.0.0/8")).toBe(true);
    expect(isValidCidr("192.168.1.0/24")).toBe(true);
    expect(isValidCidr("0.0.0.0/0")).toBe(true);
  });

  it("accepts valid IPv6 CIDR", () => {
    expect(isValidCidr("2001:db8::/32")).toBe(true);
    expect(isValidCidr("::/0")).toBe(true);
  });

  it("rejects malformed CIDR", () => {
    expect(isValidCidr("10.0.0.0")).toBe(false);
    expect(isValidCidr("10.0.0.0/33")).toBe(false);
    expect(isValidCidr("not-an-ip")).toBe(false);
    expect(isValidCidr("")).toBe(false);
  });
});

describe("unit: cidr - matchesAnyCIDR", () => {
  it("matches IPv4 inside /8", () => {
    expect(matchesAnyCIDR("10.1.2.3", ["10.0.0.0/8"])).toBe(true);
  });

  it("matches IPv4 boundary", () => {
    expect(matchesAnyCIDR("10.255.255.255", ["10.0.0.0/8"])).toBe(true);
  });

  it("rejects IPv4 outside range", () => {
    expect(matchesAnyCIDR("11.0.0.1", ["10.0.0.0/8"])).toBe(false);
  });

  it("matches IPv6 inside /32", () => {
    expect(matchesAnyCIDR("2001:db8::1", ["2001:db8::/32"])).toBe(true);
  });

  it("rejects IPv6 outside /32", () => {
    expect(matchesAnyCIDR("2001:db9::1", ["2001:db8::/32"])).toBe(false);
  });

  it("does not throw on v4 vs v6 family mismatch", () => {
    expect(matchesAnyCIDR("10.0.0.1", ["2001:db8::/32"])).toBe(false);
    expect(matchesAnyCIDR("2001:db8::1", ["10.0.0.0/8"])).toBe(false);
  });

  it("skips malformed entries but still matches valid ones in same list", () => {
    expect(matchesAnyCIDR("10.0.0.1", ["bogus", "10.0.0.0/8", "also/bad"])).toBe(true);
  });

  it("returns false for empty list", () => {
    expect(matchesAnyCIDR("10.0.0.1", [])).toBe(false);
  });

  it("returns false for unknown IP", () => {
    expect(matchesAnyCIDR("unknown", ["0.0.0.0/0"])).toBe(false);
  });

  it("returns false for unparseable IP", () => {
    expect(matchesAnyCIDR("not-an-ip", ["10.0.0.0/8"])).toBe(false);
  });
});
