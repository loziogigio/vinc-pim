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
import { ChannelSelect } from "@/components/shared/ChannelSelect";
import {
  CHANNEL_RELATION_ID,
  type DataModelField,
  type DataModelRelation,
} from "@/lib/db/models/data-model-definition";
import { mergeSecretOnSave } from "@/components/data-models/secret-utils";
import { useTranslation } from "@/lib/i18n/useTranslation";

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
  /** Relation of the parent definition — drives channel-scoped UI. */
  relation: DataModelRelation;
  busy?: boolean;
  error?: string | null;
  /**
   * Optional endpoint (e.g. "/api/b2b/notifications/test-send") from the
   * definition's `test_action` field. When provided a "Test" button is shown
   * that lets the user fire a live test notification via the saved config.
   */
  testAction?: string;
  onSubmit: (input: {
    relation_id: string;
    channel: string;
    data: Record<string, unknown>;
  }) => void;
  onClose: () => void;
}

function withCheckboxDefaults(
  fields: DataModelField[],
  data: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...data };
  for (const f of fields) {
    if (f.type === "checkbox" && (out[f.slug] === undefined || out[f.slug] === null)) {
      out[f.slug] = false;
    }
  }
  return out;
}

/**
 * Always initialize secret fields to "" in the form state. This ensures the
 * password input starts empty and `mergeSecretOnSave` can correctly preserve
 * the stored value when the field is left blank on submit.
 */
function withSecretDefaults(
  fields: DataModelField[],
  data: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...data };
  for (const f of fields) {
    if (f.type === "secret") {
      out[f.slug] = "";
    }
  }
  return out;
}

type DeliveryChannel = "email" | "sms" | "fcm";

export function RecordFormModal({
  open,
  title,
  fields,
  initial,
  definitionChannel,
  relation,
  busy,
  error,
  testAction,
  onSubmit,
  onClose,
}: RecordFormModalProps) {
  const [relationId, setRelationId] = useState(initial?.relation_id ?? "");
  const [channel, setChannel] = useState(
    initial?.channel ?? (definitionChannel === "*" ? "" : definitionChannel)
  );
  const [data, setData] = useState<Record<string, unknown>>(
    withSecretDefaults(fields, withCheckboxDefaults(fields, initial?.data ?? {}))
  );
  const isChannel = relation === "channel";

  // Test action state
  const [testOpen, setTestOpen] = useState(false);
  const [testDelivery, setTestDelivery] = useState<DeliveryChannel>("email");
  const [testTo, setTestTo] = useState("");
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; skipped?: boolean; error?: string } | null>(null);

  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    setRelationId(initial?.relation_id ?? "");
    setChannel(initial?.channel ?? (definitionChannel === "*" ? "" : definitionChannel));
    setData(withSecretDefaults(fields, withCheckboxDefaults(fields, initial?.data ?? {})));
    // reset test panel when modal re-opens
    setTestOpen(false);
    setTestResult(null);
    setTestTo("");
  }, [open, initial, definitionChannel, fields]);

  const runTest = async () => {
    if (!testAction || !channel || !testTo) return;
    setTestBusy(true);
    setTestResult(null);
    try {
      const res = await fetch(testAction, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, deliveryChannel: testDelivery, to: testTo }),
      });
      const json = await res.json();
      setTestResult(json);
    } catch (e) {
      setTestResult({ ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setTestBusy(false);
    }
  };

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
          {isChannel ? (
            <div>
              <label className="text-xs font-medium text-muted-foreground">channel</label>
              <ChannelSelect
                value={channel}
                onChange={setChannel}
                required
                showLabel={false}
                disabled={!!initial?.channel}
                className="mt-1"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                One config record per channel.
              </p>
            </div>
          ) : (
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
          )}

          <div className="mt-4 space-y-3">
            {fields.map((f) => (
              <FieldInput
                key={f.slug}
                field={f}
                value={data[f.slug]}
                onChange={(v) => setField(f.slug, v)}
                existingHasValue={f.type === "secret" ? !!initial?.data?.[f.slug] : false}
              />
            ))}
          </div>

          {error && (
            <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>
          )}
        </div>

        {/* Test action panel — shown only when definition has test_action and user clicked Test */}
        {testAction && testOpen && (
          <div className="border-t border-border px-5 py-4 bg-muted/30">
            <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t("components.recordFormModal.testPanel")}
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={testDelivery}
                onChange={(e) => setTestDelivery(e.target.value as DeliveryChannel)}
                className="rounded-md border border-input bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="email">email</option>
                <option value="sms">sms</option>
                <option value="fcm">fcm</option>
              </select>
              <Input
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder={t("components.recordFormModal.testToPlaceholder")}
                className="flex-1 text-xs"
              />
              <Button
                variant="outline"
                onClick={runTest}
                disabled={testBusy || !testTo || !channel}
                className="shrink-0"
              >
                {testBusy ? t("common.sending") : t("components.recordFormModal.testSend")}
              </Button>
            </div>
            {testResult && (
              <p className={`mt-2 text-xs ${testResult.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {testResult.ok
                  ? t("components.recordFormModal.testSent")
                  : testResult.skipped
                    ? `${t("components.recordFormModal.testSkipped")}: ${testResult.error ?? ""}`
                    : `${t("components.recordFormModal.testFailed")}: ${testResult.error ?? ""}`}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          {testAction && (
            <Button
              variant="outline"
              onClick={() => { setTestOpen((v) => !v); setTestResult(null); }}
              disabled={busy}
            >
              {t("components.recordFormModal.test")}
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => {
              const secretSlugs = fields
                .filter((f) => f.type === "secret")
                .map((f) => f.slug);
              const mergedData = mergeSecretOnSave(
                data,
                initial?.data ?? {},
                secretSlugs
              );
              onSubmit({
                relation_id: isChannel ? CHANNEL_RELATION_ID : relationId,
                channel,
                data: mergedData,
              });
            }}
            disabled={busy || (!isChannel && !relationId) || !channel}
          >
            {busy ? t("common.saving") : t("common.save")}
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
  existingHasValue = false,
}: {
  field: DataModelField;
  value: unknown;
  onChange: (v: unknown) => void;
  /** For secret fields: true when the stored record already has a value. */
  existingHasValue?: boolean;
}) {
  const { t } = useTranslation();
  const label = field.label || field.slug;

  switch (field.type) {
    case "secret":
      return (
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {label}
            {field.required && <span className="text-rose-500"> *</span>}
          </label>
          <Input
            type="password"
            autoComplete="new-password"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={
              existingHasValue
                ? `•••••• — ${t("components.recordFormModal.secretKeepPlaceholder")}`
                : ""
            }
            className="mt-1 text-sm"
          />
        </div>
      );

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
