import { describe, it, expect } from "vitest";
import { B2BFormDefinitionSchema } from "@/lib/db/models/b2b-form-definition";
import { B2BFormSubmissionSchema } from "@/lib/db/models/b2b-form-submission";

describe("B2B form models", () => {
  it("B2BFormDefinition collection is b2bformdefinitions", () => {
    expect(B2BFormDefinitionSchema.get("collection")).toBe("b2bformdefinitions");
  });

  it("B2BFormDefinition uses portal_slug", () => {
    expect(B2BFormDefinitionSchema.paths.portal_slug).toBeDefined();
    expect(B2BFormDefinitionSchema.paths.storefront_slug).toBeUndefined();
  });

  it("B2BFormSubmission collection is b2bformsubmissions", () => {
    expect(B2BFormSubmissionSchema.get("collection")).toBe("b2bformsubmissions");
  });

  it("B2BFormSubmission uses portal_slug", () => {
    expect(B2BFormSubmissionSchema.paths.portal_slug).toBeDefined();
    expect(B2BFormSubmissionSchema.paths.storefront_slug).toBeUndefined();
  });
});
