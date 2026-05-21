/**
 * Validate (and lightly coerce) a record's `data` payload against a
 * DataModelDefinition's `fields[]`. Returns the coerced data on success,
 * throws a ValidationError carrying a per-path message on failure.
 *
 * Strict by default: unknown top-level keys raise a 400.
 */

import type {
  DataModelField,
  DataModelFieldOption,
} from "@/lib/db/models/data-model-definition";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class ValidationError extends Error {
  public readonly path: string;
  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.path = path;
    this.name = "ValidationError";
  }
}

export interface ValidateOptions {
  /** When true (default), unknown keys throw. When false, unknown keys are dropped. */
  strict?: boolean;
  /** When true (default for PATCH), missing required fields don't throw. */
  partial?: boolean;
}

/**
 * Validate `data` against `fields`. Returns the coerced payload (new object).
 */
export function validateRecordData(
  data: unknown,
  fields: DataModelField[],
  options: ValidateOptions = {}
): Record<string, unknown> {
  return validateObject(data, fields, options, "");
}

function validateObject(
  raw: unknown,
  fields: DataModelField[],
  opts: ValidateOptions,
  path: string
): Record<string, unknown> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ValidationError(path || "data", "must be an object");
  }
  const input = raw as Record<string, unknown>;
  const strict = opts.strict ?? true;
  const partial = opts.partial ?? false;

  const out: Record<string, unknown> = {};
  const knownSlugs = new Set(fields.map((f) => f.slug));

  if (strict) {
    for (const key of Object.keys(input)) {
      if (!knownSlugs.has(key)) {
        throw new ValidationError(joinPath(path, key), "unknown field");
      }
    }
  }

  for (const field of fields) {
    const here = joinPath(path, field.slug);
    const present = Object.prototype.hasOwnProperty.call(input, field.slug);
    const value = input[field.slug];

    if (!present || value === undefined || value === null || value === "") {
      if (field.required && !partial) {
        throw new ValidationError(here, "is required");
      }
      // For PATCH semantics, skip absent fields. For object/array_of_objects in
      // PATCH mode, the caller should pass the full nested payload anyway.
      continue;
    }

    out[field.slug] = validateField(value, field, opts, here);
  }

  return out;
}

function validateField(
  value: unknown,
  field: DataModelField,
  opts: ValidateOptions,
  path: string
): unknown {
  switch (field.type) {
    case "text":
    case "textarea":
      return coerceString(value, path);

    case "email": {
      const s = coerceString(value, path);
      if (!EMAIL_REGEX.test(s)) {
        throw new ValidationError(path, "must be a valid email");
      }
      return s;
    }

    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) {
        throw new ValidationError(path, "must be a finite number");
      }
      return n;
    }

    case "checkbox": {
      if (typeof value === "boolean") return value;
      if (value === "true" || value === 1) return true;
      if (value === "false" || value === 0) return false;
      throw new ValidationError(path, "must be a boolean");
    }

    case "date": {
      if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) {
          throw new ValidationError(path, "invalid date");
        }
        return value.toISOString();
      }
      if (typeof value !== "string" && typeof value !== "number") {
        throw new ValidationError(path, "must be a date (ISO string or epoch ms)");
      }
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) {
        throw new ValidationError(path, "invalid date");
      }
      return d.toISOString();
    }

    case "select": {
      const s = coerceString(value, path);
      const fieldOpts = field.options ?? [];
      if (!fieldOpts.some((o: DataModelFieldOption) => o.value === s)) {
        throw new ValidationError(
          path,
          `must be one of: ${fieldOpts.map((o: DataModelFieldOption) => o.value).join(", ")}`
        );
      }
      return s;
    }

    case "object": {
      return validateObject(value, field.fields ?? [], opts, path);
    }

    case "array_of_objects": {
      if (!Array.isArray(value)) {
        throw new ValidationError(path, "must be an array");
      }
      return value.map((el, i) =>
        validateObject(el, field.fields ?? [], opts, `${path}[${i}]`)
      );
    }
  }
}

function coerceString(value: unknown, path: string): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  throw new ValidationError(path, "must be a string");
}

function joinPath(parent: string, key: string): string {
  return parent ? `${parent}.${key}` : key;
}

/**
 * Extract the value of the external_ref field from a coerced data payload.
 * The external_ref field is always top-level.
 */
export function extractExternalRef(
  data: Record<string, unknown>,
  externalRefFieldSlug: string | undefined
): string | undefined {
  if (!externalRefFieldSlug) return undefined;
  const v = data[externalRefFieldSlug];
  if (v === undefined || v === null) return undefined;
  return String(v);
}
