import { describe, it, expect } from "vitest";
import {
  getDemoAccess,
  DEMO_DOMAINS,
  DEMO_UFFICIO_URL,
  DEMO_REQUEST_PAGE_SLUG,
  getDemoPasswordsSafe,
  requireDemoPasswords,
} from "@/lib/demo/demo-access";
import { renderDemoAccessEmail } from "@/lib/email/templates/demo-access";

const PWDS = { admin: "AdminPw1", b2b: "B2bPw2", b2c: "B2cPw3" };

describe("demo-access contract", () => {
  it("exposes the demo request page slug", () => {
    expect(DEMO_REQUEST_PAGE_SLUG).toBe("richiedi-demo");
  });

  it("builds a 3-surface access matrix mapped to the right passwords", () => {
    const access = getDemoAccess(PWDS);
    expect(access).toHaveLength(3);
    const bySurface = Object.fromEntries(access.map((a) => [a.surface, a]));
    expect(bySurface["B2B Portal"].url).toContain(DEMO_DOMAINS.b2b);
    expect(bySurface["B2B Portal"].password).toBe(PWDS.b2b);
    expect(bySurface["B2C Shop"].password).toBe(PWDS.b2c);
    expect(bySurface["VINC Ufficio Digitale"].password).toBe(PWDS.admin);
    // CS admin = existing back-office panel for the demo tenant on the demo-ufficio host.
    expect(bySurface["VINC Ufficio Digitale"].url).toBe(DEMO_UFFICIO_URL);
    expect(DEMO_UFFICIO_URL).toContain("demo-ufficio");
  });

  it("getDemoPasswordsSafe returns null when env is incomplete", () => {
    const saved = { ...process.env };
    delete process.env.DEMO_ADMIN_PASSWORD;
    delete process.env.DEMO_B2B_PASSWORD;
    delete process.env.DEMO_B2C_PASSWORD;
    expect(getDemoPasswordsSafe()).toBeNull();
    expect(() => requireDemoPasswords()).toThrow(/DEMO_ADMIN_PASSWORD/);
    process.env = saved;
  });
});

describe("demo-access email", () => {
  const html = renderDemoAccessEmail({
    branding: { companyName: "VINC", primaryColor: "#16a34a", secondaryColor: "#0ea5e9" },
    leadName: "<script>Mario</script>",
    access: getDemoAccess(PWDS),
    hubUrl: `https://${DEMO_DOMAINS.hub}`,
  });

  it("includes every surface url and password", () => {
    expect(html).toContain(DEMO_DOMAINS.b2b);
    expect(html).toContain(DEMO_DOMAINS.b2c);
    expect(html).toContain(DEMO_UFFICIO_URL);
    expect(html).toContain(DEMO_DOMAINS.hub);
    expect(html).toContain(PWDS.admin);
    expect(html).toContain(PWDS.b2b);
    expect(html).toContain(PWDS.b2c);
  });

  it("escapes the lead name to prevent HTML injection", () => {
    expect(html).toContain("&lt;script&gt;Mario&lt;/script&gt;");
    expect(html).not.toContain("<script>Mario</script>");
  });

  it("renders a complete branded HTML document", () => {
    expect(html).toContain("<!DOCTYPE html>");
    expect(html.toLowerCase()).toContain("demo");
  });
});
