import { describe, it, expect } from "vitest";
import { mergeSecretOnSave } from "@/components/data-models/secret-utils";

describe("mergeSecretOnSave", () => {
  it("keeps the existing value when the secret input is left blank", () => {
    const out = mergeSecretOnSave({ smtp_password: "" }, { smtp_password: "stored" }, ["smtp_password"]);
    expect(out.smtp_password).toBe("stored");
  });
  it("overwrites when a new secret value is provided", () => {
    const out = mergeSecretOnSave({ smtp_password: "new" }, { smtp_password: "stored" }, ["smtp_password"]);
    expect(out.smtp_password).toBe("new");
  });
  it("leaves non-secret fields untouched", () => {
    const out = mergeSecretOnSave({ smtp_host: "h", smtp_password: "" }, { smtp_password: "stored" }, ["smtp_password"]);
    expect(out.smtp_host).toBe("h");
  });
});
