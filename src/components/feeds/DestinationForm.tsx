"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n/useTranslation";
import {
  normalizeDecimalInput,
  parseDecimalValue,
  toDecimalInputValue,
} from "@/lib/utils/decimal-input";

export interface DestinationFormValue {
  type: "google_merchant" | "meta_catalog" | "trovaprezzi";
  name: string; channel: string; lang: string; currency: string;
  product_url_template: string; in_stock_only: boolean;
  delta_interval_minutes: number; full_reconcile_hour: number;
  status: "active" | "paused";
  google_merchant_account_id?: string; google_service_account_json?: string;
  google_data_source?: string;
  meta_catalog_id?: string; meta_system_user_token?: string;
  shipping_cost?: number; notification_email?: string;
}

const EMPTY: DestinationFormValue = {
  type: "trovaprezzi", name: "", channel: "default", lang: "it", currency: "EUR",
  product_url_template: "", in_stock_only: false,
  delta_interval_minutes: 60, full_reconcile_hour: 2, status: "active",
};

/**
 * Module-level so its component identity is stable across parent re-renders.
 * Defining this inside DestinationForm would give React a brand-new
 * component type on every keystroke, unmounting/remounting the underlying
 * <Input> and losing focus/caret position after each character typed.
 */
function Field({
  label,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function DestinationForm({
  destinationId,
  initial,
}: {
  destinationId?: string;
  initial?: Partial<DestinationFormValue>;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [value, setValue] = useState<DestinationFormValue>({ ...EMPTY, ...initial });
  // Monetary field: local string state per CLAUDE.md decimal-input convention
  // (comma/dot tolerant, type="text" + inputMode="decimal" instead of type="number").
  const [shippingCostInput, setShippingCostInput] = useState(
    toDecimalInputValue(initial?.shipping_cost)
  );
  const [channels, setChannels] = useState<{ code: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/b2b/channels")
      .then((r) => r.json())
      // Real API shape is { success, channels } (see src/app/api/b2b/channels/route.ts),
      // not { data } as the brief guessed.
      .then((j) => setChannels(j.channels ?? []))
      .catch(() => setChannels([]));
  }, []);

  const set = <K extends keyof DestinationFormValue>(k: K, v: DestinationFormValue[K]) =>
    setValue((prev) => ({ ...prev, [k]: v }));

  const handleShippingCostChange = (raw: string) => {
    const normalized = normalizeDecimalInput(raw);
    if (normalized === null) return; // invalid input, ignore
    setShippingCostInput(normalized);
    set("shipping_cost", parseDecimalValue(normalized) as never);
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { ...value };
      if (destinationId) {
        // type is immutable after create (disabled below) and the PUT route
        // silently drops it anyway (see feed-destination.service.ts
        // PLAIN_FIELDS_UPDATE) — strip it explicitly to make that clear here.
        delete body.type;
      }
      const res = await fetch(
        destinationId ? `/api/b2b/feeds/destinations/${destinationId}` : "/api/b2b/feeds/destinations",
        {
          method: destinationId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      router.push(`/b2b/feeds/destinations/${json.data.destination_id}`);
      router.refresh();
    } catch (e) {
      // Surfaces API validation messages verbatim, e.g. the 400 from
      // validateDeltaIntervalMinutes ("delta_interval_minutes must be 5-59
      // or a multiple of 60 (max 1440)").
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="space-y-1">
        <Label>{t("pages.feeds.fields.type")}</Label>
        <select
          className="w-full rounded-md border border-border bg-background p-2 text-sm"
          value={value.type}
          disabled={!!destinationId}
          onChange={(e) => set("type", e.target.value as DestinationFormValue["type"])}
        >
          <option value="google_merchant">Google Merchant</option>
          <option value="meta_catalog">Meta Shops</option>
          <option value="trovaprezzi">TrovaPrezzi</option>
        </select>
      </div>

      <Field
        label={t("pages.feeds.fields.name")}
        value={String(value.name ?? "")}
        onChange={(v) => set("name", v)}
      />

      <div className="space-y-1">
        <Label>{t("pages.feeds.fields.channel")}</Label>
        <select
          className="w-full rounded-md border border-border bg-background p-2 text-sm"
          value={value.channel}
          onChange={(e) => set("channel", e.target.value)}
        >
          {channels.map((c) => (
            <option key={c.code} value={c.code}>{c.name || c.code}</option>
          ))}
          {channels.length === 0 && <option value="default">default</option>}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label={t("pages.feeds.fields.lang")}
          value={String(value.lang ?? "")}
          onChange={(v) => set("lang", v)}
        />
        <Field
          label={t("pages.feeds.fields.currency")}
          value={String(value.currency ?? "")}
          onChange={(v) => set("currency", v)}
        />
      </div>
      <Field
        label={`${t("pages.feeds.fields.productUrlTemplate")} — {slug} | {entity_code}`}
        value={String(value.product_url_template ?? "")}
        onChange={(v) => set("product_url_template", v)}
      />

      <div className="grid grid-cols-2 gap-3">
        <Field
          label={t("pages.feeds.fields.deltaInterval")}
          type="number"
          value={String(value.delta_interval_minutes ?? "")}
          onChange={(v) => set("delta_interval_minutes", Number(v))}
        />
        <Field
          label={t("pages.feeds.fields.fullHour")}
          type="number"
          value={String(value.full_reconcile_hour ?? "")}
          onChange={(v) => set("full_reconcile_hour", Number(v))}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={value.in_stock_only}
          onChange={(e) => set("in_stock_only", e.target.checked)}
        />
        {t("pages.feeds.fields.inStockOnly")}
      </label>

      {value.type === "google_merchant" && (
        <>
          <Field
            label={t("pages.feeds.fields.merchantAccountId")}
            value={String(value.google_merchant_account_id ?? "")}
            onChange={(v) => set("google_merchant_account_id", v)}
          />
          <Field
            label={t("pages.feeds.fields.dataSource")}
            value={String(value.google_data_source ?? "")}
            onChange={(v) => set("google_data_source", v)}
          />
          <div className="space-y-1">
            <Label>{t("pages.feeds.fields.serviceAccountJson")}</Label>
            <textarea
              className="w-full rounded-md border border-border bg-background p-2 text-sm font-mono"
              rows={4}
              value={value.google_service_account_json ?? ""}
              onChange={(e) => set("google_service_account_json", e.target.value)}
            />
          </div>
        </>
      )}

      {value.type === "meta_catalog" && (
        <>
          <Field
            label={t("pages.feeds.fields.catalogId")}
            value={String(value.meta_catalog_id ?? "")}
            onChange={(v) => set("meta_catalog_id", v)}
          />
          <Field
            label={t("pages.feeds.fields.systemUserToken")}
            type="password"
            value={String(value.meta_system_user_token ?? "")}
            onChange={(v) => set("meta_system_user_token", v)}
          />
        </>
      )}

      {value.type === "trovaprezzi" && (
        <div className="space-y-1">
          <Label>{t("pages.feeds.fields.shippingCost")}</Label>
          <Input
            type="text"
            inputMode="decimal"
            value={shippingCostInput}
            onChange={(e) => handleShippingCostChange(e.target.value)}
          />
        </div>
      )}

      <Field
        label={t("pages.feeds.fields.notificationEmail")}
        value={String(value.notification_email ?? "")}
        onChange={(v) => set("notification_email", v)}
      />

      <div className="space-y-1">
        <Label>{t("common.status")}</Label>
        <select
          className="w-full rounded-md border border-border bg-background p-2 text-sm"
          value={value.status}
          onChange={(e) => set("status", e.target.value as "active" | "paused")}
        >
          <option value="active">{t("pages.feeds.status.active")}</option>
          <option value="paused">{t("pages.feeds.status.paused")}</option>
        </select>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <Button onClick={submit} disabled={saving}>
        {t("pages.feeds.save")}
      </Button>
    </div>
  );
}
