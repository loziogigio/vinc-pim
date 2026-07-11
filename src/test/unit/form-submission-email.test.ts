import { describe, it, expect } from "vitest";
import { renderFormSubmissionEmail } from "@/lib/email/templates/b2c-form-submission";

const branding = { companyName: "VINC", primaryColor: "#0c7f8e", secondaryColor: "#10b981" };

describe("unit: hand-off email Lead-context panel", () => {
  it("renders the panel with attribution + CRM link", () => {
    const html = renderFormSubmissionEmail({
      branding,
      data: {
        pageSlug: "richiedi-demo", storefrontName: "VINC", fields: [{ label: "Email", value: "m@acme.it" }], submitterEmail: "m@acme.it",
        leadContext: { segmentLabel: "Fornitore / Distributore", demoUrl: "https://demo-b2b.vendereincloud.it", openingLine: "Ciao...", crmUrl: "https://vinc.crm.vendereincloud.it/object/opportunity/op1", attributionLines: ["Provenienza: paid_search / google"] },
      },
    });
    expect(html).toContain("Fornitore / Distributore");
    expect(html).toContain("Apri nel CRM");
    expect(html).toContain("paid_search / google");
  });

  it("renders without a leadContext (back-compat, no throw)", () => {
    const html = renderFormSubmissionEmail({ branding, data: { pageSlug: "contatti", storefrontName: "VINC", fields: [{ label: "Email", value: "x@y.z" }] } });
    expect(html).toContain("New Form Submission");
  });
});
