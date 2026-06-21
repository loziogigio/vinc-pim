import { describe, it, expect } from "vitest";
import {
  AGENT_TAG_PREFIX,
  normalizeAgentCode,
  agentFullTag,
  isAgentTag,
} from "@/lib/constants/customer-tag";

describe("unit: agent tag constants", () => {
  it("reserved prefix is 'agente'", () => {
    expect(AGENT_TAG_PREFIX).toBe("agente");
  });

  it("normalizeAgentCode lowercases and slugifies", () => {
    expect(normalizeAgentCode("M01")).toBe("m01");
    expect(normalizeAgentCode("AG 12")).toBe("ag-12");
    expect(normalizeAgentCode("Rossi/2")).toBe("rossi-2");
    expect(normalizeAgentCode("--A__B--")).toBe("a-b");
  });

  it("normalizeAgentCode returns null for blank/empty/junk", () => {
    expect(normalizeAgentCode("")).toBeNull();
    expect(normalizeAgentCode("   ")).toBeNull();
    expect(normalizeAgentCode(null)).toBeNull();
    expect(normalizeAgentCode(undefined)).toBeNull();
    expect(normalizeAgentCode("///")).toBeNull();
  });

  it("agentFullTag builds 'agente:<code>' or null", () => {
    expect(agentFullTag("M01")).toBe("agente:m01");
    expect(agentFullTag("")).toBeNull();
  });

  it("isAgentTag detects the reserved prefix", () => {
    expect(isAgentTag("agente:m01")).toBe(true);
    expect(isAgentTag("categoria-di-sconto:sconto-45")).toBe(false);
    expect(isAgentTag("agentecorp:x")).toBe(false); // must be the exact prefix segment
  });
});
