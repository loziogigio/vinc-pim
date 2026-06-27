import { describe, it, expect } from "vitest";
import { redactSecretFields, redactRecordSecrets } from "@/lib/data-models/redact-secrets";
import type { DataModelField } from "@/lib/db/models/data-model-definition";

const fields: DataModelField[] = [
  { slug: "sms_enabled", label: "SMS", type: "checkbox" },
  { slug: "sms_sender_id", label: "Sender", type: "text" },
  { slug: "sms_api_key", label: "API key", type: "secret" },
  { slug: "smtp_password", label: "SMTP pw", type: "secret" },
];

describe("redactSecretFields", () => {
  it("removes secret-typed fields but keeps everything else", () => {
    const out = redactSecretFields(
      { sms_enabled: true, sms_sender_id: "Acme", sms_api_key: "tok123", smtp_password: "pw456" },
      fields
    );
    expect(out).toEqual({ sms_enabled: true, sms_sender_id: "Acme" });
    expect("sms_api_key" in out).toBe(false);
    expect("smtp_password" in out).toBe(false);
  });

  it("is a no-op when there are no secret fields", () => {
    const plain: DataModelField[] = [{ slug: "name", label: "Name", type: "text" }];
    expect(redactSecretFields({ name: "x" }, plain)).toEqual({ name: "x" });
  });

  it("recurses into object and array_of_objects fields", () => {
    const nested: DataModelField[] = [
      { slug: "cfg", label: "Cfg", type: "object", fields: [{ slug: "key", label: "Key", type: "secret" }] },
      {
        slug: "rows",
        label: "Rows",
        type: "array_of_objects",
        fields: [
          { slug: "label", label: "Label", type: "text" },
          { slug: "token", label: "Token", type: "secret" },
        ],
      },
    ];
    const out = redactSecretFields(
      { cfg: { key: "shh" }, rows: [{ label: "a", token: "t1" }, { label: "b", token: "t2" }] },
      nested
    );
    expect(out).toEqual({ cfg: {}, rows: [{ label: "a" }, { label: "b" }] });
  });

  it("returns {} for non-object input", () => {
    expect(redactSecretFields(null, fields)).toEqual({});
    expect(redactSecretFields("nope", fields)).toEqual({});
  });

  it("redactRecordSecrets preserves record metadata and only scrubs data", () => {
    const rec = { _id: "1", channel: "default", data: { sms_api_key: "tok123", sms_sender_id: "Acme" } };
    const out = redactRecordSecrets(rec, fields);
    expect(out._id).toBe("1");
    expect(out.channel).toBe("default");
    expect(out.data).toEqual({ sms_sender_id: "Acme" });
  });
});
