"use client";

/**
 * Recursive editor for DataModelDefinition fields[].
 *
 * Supports all field types including object / array_of_objects (which expand
 * to a nested editor on the same component). Tracks per-field slug locking
 * via `lockedSlugs` (top-level path slugs persisted by the server on the
 * last save — when locked, the slug input is disabled).
 */

import { useState } from "react";
import {
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  KeyRound,
  Filter as FilterIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { slugify } from "@/lib/data-models/slugify";
import type {
  DataModelField,
  DataModelFieldOption,
  DataModelFieldType,
} from "@/lib/db/models/data-model-definition";

const FIELD_TYPES: { value: DataModelFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "textarea", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
  { value: "object", label: "Object (nested)" },
  { value: "array_of_objects", label: "Array of objects" },
];

const EXTERNAL_REF_ELIGIBLE: DataModelFieldType[] = ["text", "email", "number", "date"];

const COLOR_SWATCHES = [
  { label: "Gray", value: "#64748b" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Green", value: "#10b981" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Red", value: "#f43f5e" },
  { label: "Purple", value: "#8b5cf6" },
  { label: "Teal", value: "#14b8a6" },
];

interface FieldsEditorProps {
  fields: DataModelField[];
  onChange: (fields: DataModelField[]) => void;
  /** Top-level field paths whose slugs are locked (already persisted on the server). */
  lockedSlugs?: Set<string>;
  /** Path prefix when this editor is nested (used to compute locked paths). */
  pathPrefix?: string;
  /** Whether to show the is_external_ref toggle (top-level only). */
  showExternalRefToggle?: boolean;
}

export function FieldsEditor({
  fields,
  onChange,
  lockedSlugs,
  pathPrefix = "",
  showExternalRefToggle = true,
}: FieldsEditorProps) {
  const update = (next: DataModelField[]) => onChange(next);

  const addField = () => {
    const next: DataModelField = {
      slug: "",
      label: "",
      type: "text",
    };
    update([...fields, next]);
  };

  const removeField = (idx: number) =>
    update(fields.filter((_, i) => i !== idx));

  const moveField = (idx: number, dir: "up" | "down") => {
    const newIdx = dir === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= fields.length) return;
    const next = [...fields];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    update(next);
  };

  const patchField = (idx: number, patch: Partial<DataModelField>) =>
    update(fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)));

  const externalRefOwnerIdx = fields.findIndex((f) => f.is_external_ref);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          Fields ({fields.length})
        </span>
        <Button type="button" variant="outline" size="sm" onClick={addField}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add field
        </Button>
      </div>

      {fields.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
          No fields yet — click <strong>Add field</strong> to start.
        </div>
      )}

      <div className="space-y-3">
        {fields.map((field, idx) => {
          const fullPath = pathPrefix ? `${pathPrefix}.${field.slug}` : field.slug;
          const slugLocked = !!field.slug && !!lockedSlugs?.has(fullPath);
          const canBeExternalRef = EXTERNAL_REF_ELIGIBLE.includes(field.type);
          const isExternalRef = !!field.is_external_ref;
          const otherIsExternalRef =
            externalRefOwnerIdx !== -1 && externalRefOwnerIdx !== idx;

          return (
            <div
              key={idx}
              className="rounded-lg border border-border bg-muted/30 p-4"
            >
              <div className="flex items-start gap-2">
                {/* Move controls */}
                <div className="flex flex-col items-center gap-0.5 pt-1">
                  <button
                    type="button"
                    onClick={() => moveField(idx, "up")}
                    disabled={idx === 0}
                    className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Move up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveField(idx, "down")}
                    disabled={idx === fields.length - 1}
                    className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Move down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex-1 space-y-3">
                  {/* Row 1: Label + Type + Required */}
                  <div className="grid grid-cols-[1fr_180px_80px] gap-2">
                    <Input
                      value={field.label}
                      onChange={(e) => {
                        const label = e.target.value;
                        // Auto-derive slug from label only while slug is unlocked and either empty or matches the previous auto-slug
                        const prevAutoSlug = slugify(field.label || "");
                        const slugIsAuto =
                          !field.slug || field.slug === prevAutoSlug;
                        patchField(idx, {
                          label,
                          slug:
                            !slugLocked && slugIsAuto ? slugify(label) : field.slug,
                        });
                      }}
                      placeholder="Field label"
                    />
                    <select
                      value={field.type}
                      onChange={(e) => {
                        const newType = e.target.value as DataModelFieldType;
                        const patch: Partial<DataModelField> = { type: newType };
                        // Reset shape-specific props when changing type
                        if (newType !== "select") patch.options = undefined;
                        if (newType !== "object" && newType !== "array_of_objects") {
                          patch.fields = undefined;
                        }
                        if (newType === "select" && !field.options) {
                          patch.options = [{ label: "", value: "" }];
                        }
                        if (
                          (newType === "object" || newType === "array_of_objects") &&
                          !field.fields
                        ) {
                          patch.fields = [];
                        }
                        if (!EXTERNAL_REF_ELIGIBLE.includes(newType)) {
                          patch.is_external_ref = false;
                        }
                        patchField(idx, patch);
                      }}
                      disabled={slugLocked}
                      className="rounded-md border border-input bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
                      title={slugLocked ? "Type is locked after first save" : undefined}
                    >
                      {FIELD_TYPES.map((ft) => (
                        <option key={ft.value} value={ft.value}>
                          {ft.label}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1.5 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={!!field.required}
                        onChange={(e) =>
                          patchField(idx, { required: e.target.checked })
                        }
                        className="rounded"
                      />
                      Req.
                    </label>
                  </div>

                  {/* Row 2: Slug + filterable + external_ref */}
                  <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">
                        Slug (key in JSON)
                      </label>
                      <Input
                        value={field.slug}
                        onChange={(e) =>
                          patchField(idx, { slug: slugify(e.target.value) })
                        }
                        disabled={slugLocked}
                        placeholder="field_slug"
                        className="mt-1 font-mono text-xs"
                      />
                    </div>
                    <label
                      className="flex items-center gap-1.5 text-xs text-foreground"
                      title="When checked, this field can be used in filter[…] query params"
                    >
                      <input
                        type="checkbox"
                        checked={!!field.filterable}
                        onChange={(e) =>
                          patchField(idx, { filterable: e.target.checked })
                        }
                        className="rounded"
                        disabled={
                          field.type === "object" ||
                          field.type === "array_of_objects"
                        }
                      />
                      <FilterIcon className="h-3 w-3" />
                      Filterable
                    </label>
                    {showExternalRefToggle && (
                      <label
                        className={`flex items-center gap-1.5 text-xs ${
                          canBeExternalRef && !otherIsExternalRef
                            ? "text-foreground"
                            : "text-muted-foreground/40"
                        }`}
                        title={
                          !canBeExternalRef
                            ? "Only text / email / number fields can be the external_ref"
                            : otherIsExternalRef
                            ? "Another field is already marked as external_ref"
                            : "When checked, this field acts as the idempotency key on batch upserts"
                        }
                      >
                        <input
                          type="checkbox"
                          checked={isExternalRef}
                          onChange={(e) =>
                            patchField(idx, { is_external_ref: e.target.checked })
                          }
                          disabled={
                            !canBeExternalRef ||
                            (otherIsExternalRef && !isExternalRef)
                          }
                          className="rounded"
                        />
                        <KeyRound className="h-3 w-3" />
                        external_ref
                      </label>
                    )}
                  </div>

                  {/* Select options */}
                  {field.type === "select" && (
                    <SelectOptionsEditor
                      options={field.options ?? []}
                      onChange={(options) => patchField(idx, { options })}
                    />
                  )}

                  {/* Nested fields */}
                  {(field.type === "object" || field.type === "array_of_objects") && (
                    <div className="rounded-md border border-border bg-card p-3">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Nested fields ({field.type === "array_of_objects" ? "per item" : ""})
                      </p>
                      <FieldsEditor
                        fields={field.fields ?? []}
                        onChange={(next) => patchField(idx, { fields: next })}
                        lockedSlugs={lockedSlugs}
                        pathPrefix={fullPath || field.slug}
                        showExternalRefToggle={false}
                      />
                    </div>
                  )}
                </div>

                {/* Delete */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeField(idx)}
                  className="mt-0.5 h-8 w-8 p-0 text-muted-foreground hover:text-rose-500"
                  title="Remove field"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Select options editor ----------

interface SelectOptionsEditorProps {
  options: DataModelFieldOption[];
  onChange: (options: DataModelFieldOption[]) => void;
}

function SelectOptionsEditor({ options, onChange }: SelectOptionsEditorProps) {
  const [openLocalesIdx, setOpenLocalesIdx] = useState<number | null>(null);

  const update = (idx: number, patch: Partial<DataModelFieldOption>) =>
    onChange(options.map((o, i) => (i === idx ? { ...o, ...patch } : o)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Options</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange([...options, { label: "", value: "" }])}
          className="h-6 px-2 text-xs"
        >
          <Plus className="mr-1 h-3 w-3" />
          Add
        </Button>
      </div>

      {options.map((opt, idx) => (
        <div key={idx} className="rounded-md border border-border bg-card p-2">
          <div className="grid grid-cols-[1fr_140px_36px_28px] items-center gap-2">
            <Input
              value={opt.label}
              onChange={(e) => {
                const label = e.target.value;
                const wasAuto = !opt.value || opt.value === slugify(opt.label || "");
                update(idx, {
                  label,
                  value: wasAuto ? slugify(label) : opt.value,
                });
              }}
              placeholder="Label"
              className="text-sm"
            />
            <Input
              value={opt.value}
              onChange={(e) => update(idx, { value: slugify(e.target.value) })}
              placeholder="value"
              className="font-mono text-xs"
            />
            <ColorPicker
              value={opt.color}
              onChange={(color) => update(idx, { color })}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                onChange(options.filter((_, i) => i !== idx))
              }
              className="h-9 w-9 p-0 text-muted-foreground hover:text-rose-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* i18n labels */}
          <button
            type="button"
            onClick={() => setOpenLocalesIdx(openLocalesIdx === idx ? null : idx)}
            className="mt-1 text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            {openLocalesIdx === idx ? "Hide" : "Edit"} locale labels (
            {Object.keys(opt.i18n_labels ?? {}).length})
          </button>

          {openLocalesIdx === idx && (
            <I18nLabelsEditor
              labels={opt.i18n_labels ?? {}}
              onChange={(i18n_labels) => update(idx, { i18n_labels })}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value?: string;
  onChange: (v: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-9 w-9 rounded-md border border-input"
        style={{ backgroundColor: value || "transparent" }}
        title={value || "no color"}
      />
      {open && (
        <div className="absolute right-0 top-10 z-10 grid grid-cols-4 gap-1 rounded-md border border-border bg-popover p-2 shadow-md">
          <button
            type="button"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
            className="h-6 w-6 rounded border border-border bg-card text-xs text-muted-foreground"
            title="No color"
          >
            ×
          </button>
          {COLOR_SWATCHES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => {
                onChange(s.value);
                setOpen(false);
              }}
              className="h-6 w-6 rounded border border-border"
              style={{ backgroundColor: s.value }}
              title={s.label}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function I18nLabelsEditor({
  labels,
  onChange,
}: {
  labels: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const [newLocale, setNewLocale] = useState("");
  const entries = Object.entries(labels);

  return (
    <div className="mt-2 space-y-1.5 rounded-md bg-muted/50 p-2">
      {entries.map(([locale, label]) => (
        <div key={locale} className="grid grid-cols-[60px_1fr_28px] items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{locale}</span>
          <Input
            value={label}
            onChange={(e) => onChange({ ...labels, [locale]: e.target.value })}
            placeholder="Localised label"
            className="text-xs"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const next = { ...labels };
              delete next[locale];
              onChange(next);
            }}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <div className="grid grid-cols-[60px_1fr_28px] items-center gap-2 pt-1">
        <Input
          value={newLocale}
          onChange={(e) => setNewLocale(e.target.value.toLowerCase())}
          placeholder="it"
          maxLength={5}
          className="font-mono text-xs"
        />
        <Input
          placeholder="Add locale label and press +"
          className="text-xs"
          disabled
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            if (newLocale && !labels[newLocale]) {
              onChange({ ...labels, [newLocale]: "" });
              setNewLocale("");
            }
          }}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-emerald-600"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
