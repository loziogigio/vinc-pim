"use client";

/**
 * Create/edit a single record. Renders one input per field based on type.
 * For object / array_of_objects, falls back to a JSON textarea — the
 * point-and-click nested editor is out of scope for v1.
 */

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DataModelField } from "@/lib/db/models/data-model-definition";

interface RecordFormModalProps {
  open: boolean;
  title: string;
  fields: DataModelField[];
  initial?: {
    relation_id?: string;
    channel?: string;
    data?: Record<string, unknown>;
  };
  /** Default channel from the definition; when "*" the form requires a value. */
  definitionChannel: string;
  busy?: boolean;
  error?: string | null;
  onSubmit: (input: {
    relation_id: string;
    channel: string;
    data: Record<string, unknown>;
  }) => void;
  onClose: () => void;
}

export function RecordFormModal({
  open,
  title,
  fields,
  initial,
  definitionChannel,
  busy,
  error,
  onSubmit,
  onClose,
}: RecordFormModalProps) {
  const [relationId, setRelationId] = useState(initial?.relation_id ?? "");
  const [channel, setChannel] = useState(
    initial?.channel ?? (definitionChannel === "*" ? "" : definitionChannel)
  );
  const [data, setData] = useState<Record<string, unknown>>(initial?.data ?? {});

  useEffect(() => {
    if (!open) return;
    setRelationId(initial?.relation_id ?? "");
    setChannel(initial?.channel ?? (definitionChannel === "*" ? "" : definitionChannel));
    setData(initial?.data ?? {});
  }, [open, initial, definitionChannel]);

  if (!open) return null;

  const setField = (slug: string, value: unknown) =>
    setData((d) => ({ ...d, [slug]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                relation_id <span className="text-rose-500">*</span>
              </label>
              <Input
                value={relationId}
                onChange={(e) => setRelationId(e.target.value)}
                placeholder="C-… or PU-…"
                className="mt-1 font-mono text-xs"
                disabled={!!initial?.relation_id}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                channel
                {definitionChannel === "*" && <span className="text-rose-500"> *</span>}
              </label>
              <Input
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="default"
                className="mt-1 text-xs"
                disabled={definitionChannel !== "*"}
              />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {fields.map((f) => (
              <FieldInput
                key={f.slug}
                field={f}
                value={data[f.slug]}
                onChange={(v) => setField(f.slug, v)}
              />
            ))}
          </div>

          {error && (
            <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit({ relation_id: relationId, channel, data })}
            disabled={busy || !relationId || (definitionChannel === "*" && !channel)}
          >
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: DataModelField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const label = field.label || field.slug;

  switch (field.type) {
    case "text":
    case "email":
      return (
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {label}
            {field.required && <span className="text-rose-500"> *</span>}
          </label>
          <Input
            type={field.type === "email" ? "email" : "text"}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 text-sm"
          />
        </div>
      );

    case "textarea":
      return (
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {label}
            {field.required && <span className="text-rose-500"> *</span>}
          </label>
          <textarea
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      );

    case "number":
      return (
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {label}
            {field.required && <span className="text-rose-500"> *</span>}
          </label>
          <Input
            type="number"
            value={value === undefined || value === null ? "" : String(value)}
            onChange={(e) => {
              const v = e.target.value;
              onChange(v === "" ? undefined : Number(v));
            }}
            className="mt-1 text-sm"
          />
        </div>
      );

    case "date":
      return (
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {label}
            {field.required && <span className="text-rose-500"> *</span>}
          </label>
          <Input
            type="date"
            value={
              typeof value === "string" && value
                ? value.slice(0, 10)
                : ""
            }
            onChange={(e) => onChange(e.target.value || undefined)}
            className="mt-1 text-sm"
          />
        </div>
      );

    case "select":
      return (
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {label}
            {field.required && <span className="text-rose-500"> *</span>}
          </label>
          <select
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value || undefined)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">—</option>
            {(field.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label || o.value}
              </option>
            ))}
          </select>
        </div>
      );

    case "checkbox":
      return (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded"
          />
          {label}
        </label>
      );

    case "object":
    case "array_of_objects":
      return (
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {label} ({field.type})
            {field.required && <span className="text-rose-500"> *</span>}
          </label>
          <textarea
            value={
              value === undefined
                ? ""
                : JSON.stringify(value, null, 2)
            }
            onChange={(e) => {
              const raw = e.target.value;
              if (raw.trim() === "") return onChange(undefined);
              try {
                onChange(JSON.parse(raw));
              } catch {
                // keep the previous parsed value; server validation will catch
                // structural errors when submit is clicked
              }
            }}
            rows={6}
            placeholder={
              field.type === "array_of_objects" ? "[]" : "{}"
            }
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            JSON. Schema is validated server-side against the nested fields.
          </p>
        </div>
      );
  }
}
