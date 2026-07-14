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

  const F = ({ k, label, type = "text" }: { k: keyof DestinationFormValue; label: string; type?: string }) => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        type={type}
        value={String(value[k] ?? "")}
        onChange={(e) =>
          set(k, (type === "number" ? Number(e.target.value) : e.target.value) as never)
        }
      />
    </div>
  );

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

      <F k="name" label={t("pages.feeds.fields.name")} />

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
        <F k="lang" label={t("pages.feeds.fields.lang")} />
        <F k="currency" label={t("pages.feeds.fields.currency")} />
      </div>
      <F k="product_url_template" label={`${t("pages.feeds.fields.productUrlTemplate")} — {slug} | {entity_code}`} />

      <div className="grid grid-cols-2 gap-3">
        <F k="delta_interval_minutes" label={t("pages.feeds.fields.deltaInterval")} type="number" />
        <F k="full_reconcile_hour" label={t("pages.feeds.fields.fullHour")} type="number" />
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
          <F k="google_merchant_account_id" label={t("pages.feeds.fields.merchantAccountId")} />
          <F k="google_data_source" label={t("pages.feeds.fields.dataSource")} />
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
          <F k="meta_catalog_id" label={t("pages.feeds.fields.catalogId")} />
          <F k="meta_system_user_token" label={t("pages.feeds.fields.systemUserToken")} type="password" />
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

      <F k="notification_email" label={t("pages.feeds.fields.notificationEmail")} />

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
