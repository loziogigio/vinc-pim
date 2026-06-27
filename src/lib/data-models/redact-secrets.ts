import type { DataModelField } from "@/lib/db/models/data-model-definition";

/**
 * Return a shallow-then-deep copy of `data` with every `secret`-typed field value
 * removed, recursing into `object` and `array_of_objects` fields. Credentials
 * (SMTP passwords, SMS/FCM API keys, VAPID private keys) must never be serialized
 * back to a client. Models without secret fields are returned effectively unchanged.
 */
export function redactSecretFields(
  data: unknown,
  fields: DataModelField[]
): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const out: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  for (const field of fields) {
    if (field.type === "secret") {
      delete out[field.slug];
    } else if (field.type === "object" && field.fields) {
      const child = out[field.slug];
      if (child && typeof child === "object" && !Array.isArray(child)) {
        out[field.slug] = redactSecretFields(child, field.fields);
      }
    } else if (field.type === "array_of_objects" && field.fields) {
      const arr = out[field.slug];
      if (Array.isArray(arr)) {
        const childFields = field.fields;
        out[field.slug] = arr.map((el) =>
          el && typeof el === "object" && !Array.isArray(el)
            ? redactSecretFields(el, childFields)
            : el
        );
      }
    }
  }
  return out;
}

/** Redact the `data` payload of a lean record document, preserving its other keys. */
export function redactRecordSecrets<T extends { data?: unknown }>(
  record: T,
  fields: DataModelField[]
): T {
  return { ...record, data: redactSecretFields(record.data, fields) };
}
