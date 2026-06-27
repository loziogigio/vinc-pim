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

/**
 * Sentinel returned to admin editors in place of a stored secret. It lets the form
 * show a "configured" state without receiving the real credential, and is treated
 * as "keep the existing value" when it round-trips back on save.
 */
export const SECRET_MASK = "__VINC_SECRET_SET__";

/**
 * Mask (rather than remove) set top-level secret values with {@link SECRET_MASK} so
 * an admin editor can tell a credential IS configured without ever receiving it.
 * Unset/empty secrets are left absent. Secrets are top-level credential config in
 * practice (e.g. notification_settings); nested secrets are not part of this contract.
 */
export function maskSecretFields(
  data: unknown,
  fields: DataModelField[]
): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const out: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  for (const field of fields) {
    if (field.type === "secret" && out[field.slug]) out[field.slug] = SECRET_MASK;
  }
  return out;
}

/** Mask the `data` payload of a lean record document for admin reads/responses. */
export function maskRecordSecrets<T extends { data?: unknown }>(
  record: T,
  fields: DataModelField[]
): T {
  return { ...record, data: maskSecretFields(record.data, fields) };
}

/**
 * Server-side secret preservation. Mutates `incoming`: for each top-level secret
 * field whose incoming value is blank/absent OR still the {@link SECRET_MASK}
 * sentinel (an unchanged field round-tripped from a masked GET), restore the
 * previously stored value rather than overwriting it. With no prior value, the
 * blank/sentinel field is dropped so it is never persisted as the mask string.
 */
export function preserveSecrets(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown> | null | undefined,
  fields: DataModelField[]
): void {
  for (const field of fields) {
    if (field.type !== "secret") continue;
    const v = incoming[field.slug];
    if (v === undefined || v === null || v === "" || v === SECRET_MASK) {
      const prev = existing?.[field.slug];
      if (prev !== undefined && prev !== null && prev !== "") {
        incoming[field.slug] = prev;
      } else {
        delete incoming[field.slug];
      }
    }
  }
}
