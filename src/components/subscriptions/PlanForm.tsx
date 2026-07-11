"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChannelSelect } from "@/components/shared/ChannelSelect";
import { LanguageTabs } from "@/components/common/LanguageTabs";
import { useTranslation } from "@/lib/i18n/useTranslation";
import {
  normalizeDecimalInput,
  parseDecimalValue,
  toDecimalInputValue,
} from "@/lib/utils/decimal-input";
import {
  BILLING_INTERVALS,
  METRIC_AGGREGATIONS,
  PLAN_KINDS,
  CHECKOUT_MODES,
} from "@/lib/constants/subscription";
import type { ISubscriptionPlan } from "@/lib/types/subscription";

const LOCALES = [
  { code: "en", name: "English", nativeName: "English", flag: "🇬🇧" },
  { code: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹" },
  { code: "sk", name: "Slovak", nativeName: "Slovenčina", flag: "🇸🇰" },
];

type LangMap = Record<string, string>;
interface BillingRow { interval: string; interval_count: number; base_price: string }
interface MetricRow {
  metric_key: string;
  included_quantity: string;
  overage_unit_price: string;
  hard_cap: string;
  aggregation: string;
}

function toLangMap(v: ISubscriptionPlan["name"] | undefined): LangMap {
  if (!v) return {};
  if (typeof v === "string") return { en: v };
  return { ...v };
}

export function PlanForm({ existing }: { existing?: ISubscriptionPlan }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const tenantMatch = pathname?.match(/^\/([^/]+)\/b2b/);
  const tenantPrefix = tenantMatch ? `/${tenantMatch[1]}` : "";
  const listHref = `${tenantPrefix}/b2b/store/subscriptions`;

  const [activeLocale, setActiveLocale] = useState("en");
  const [channel, setChannel] = useState(existing?.channel ?? "default");
  const [code, setCode] = useState(existing?.code ?? "");
  const [name, setName] = useState<LangMap>(toLangMap(existing?.name));
  const [description, setDescription] = useState<LangMap>(toLangMap(existing?.description));
  const [bullets, setBullets] = useState(
    (existing?.feature_bullets ?? [])
      .map((b) => (typeof b === "string" ? b : b.en ?? ""))
      .join("\n")
  );
  const [billing, setBilling] = useState<BillingRow[]>(
    (existing?.billing_options ?? [{ interval: "month", interval_count: 1, base_price: 0 }]).map((o) => ({
      interval: o.interval,
      interval_count: o.interval_count ?? 1,
      base_price: toDecimalInputValue(o.base_price),
    }))
  );
  const [metrics, setMetrics] = useState<MetricRow[]>(
    (existing?.metrics ?? []).map((m) => ({
      metric_key: m.metric_key,
      included_quantity: toDecimalInputValue(m.included_quantity),
      overage_unit_price: toDecimalInputValue(m.overage_unit_price),
      hard_cap: m.hard_cap == null ? "" : toDecimalInputValue(m.hard_cap),
      aggregation: m.aggregation,
    }))
  );
  const [trialDays, setTrialDays] = useState(existing?.trial_days == null ? "" : String(existing.trial_days));
  const [sandbox, setSandbox] = useState(existing?.sandbox_included ?? false);
  const [kind, setKind] = useState(existing?.kind ?? "standard");
  const [checkoutMode, setCheckoutMode] = useState(existing?.checkout_mode ?? "self_serve");
  const [featured, setFeatured] = useState(existing?.is_featured ?? false);
  const [isPublic, setIsPublic] = useState(existing?.public ?? false);
  const [status, setStatus] = useState(existing?.status ?? "active");
  const [currency, setCurrency] = useState(existing?.currency ?? "EUR");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setDecimal(value: string, apply: (v: string) => void) {
    const normalized = normalizeDecimalInput(value);
    if (normalized === null) return;
    apply(normalized);
  }

  async function handleSubmit() {
    setSaving(true);
    setError("");
    try {
      const payload = {
        channel,
        code,
        name,
        description: Object.keys(description).length ? description : undefined,
        feature_bullets: bullets.split("\n").map((s) => s.trim()).filter(Boolean),
        is_featured: featured,
        public: isPublic,
        currency,
        billing_options: billing.map((b) => ({
          interval: b.interval,
          interval_count: b.interval_count ?? 1,
          base_price: parseDecimalValue(b.base_price) ?? 0,
        })),
        metrics: metrics.map((m) => ({
          metric_key: m.metric_key,
          included_quantity: parseDecimalValue(m.included_quantity) ?? 0,
          overage_unit_price: parseDecimalValue(m.overage_unit_price) ?? 0,
          hard_cap: m.hard_cap === "" ? null : parseDecimalValue(m.hard_cap) ?? null,
          aggregation: m.aggregation,
        })),
        trial_days: trialDays === "" ? null : parseInt(trialDays, 10),
        sandbox_included: sandbox,
        kind,
        checkout_mode: checkoutMode,
        status,
      };

      const url = existing
        ? `/api/b2b/subscription-plans/${existing.plan_id}`
        : "/api/b2b/subscription-plans";
      const method = existing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        router.push(listHref);
      } else {
        setError(data.error || t("pages.store.subscriptionForm.saveError"));
      }
    } catch {
      setError(t("pages.store.subscriptionForm.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.push(listHref)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("pages.store.subscriptionForm.back")}
        </Button>
        <h1 className="text-2xl font-bold">
          {existing ? t("pages.store.subscriptionForm.editTitle") : t("pages.store.subscriptionForm.newTitle")}
        </h1>
      </div>

      {error && <div className="rounded-md bg-rose-50 text-rose-700 px-3 py-2 text-sm">{error}</div>}

      {/* Basic info */}
      <section className="space-y-3 border border-border rounded-lg p-4">
        <h2 className="font-semibold">{t("pages.store.subscriptionForm.basicInfo")}</h2>
        <ChannelSelect value={channel} onChange={setChannel} required />
        <div>
          <label className="block text-sm font-medium mb-1">{t("pages.store.subscriptionForm.codeLabel")}</label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t("pages.store.subscriptionForm.codePlaceholder")} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("pages.store.subscriptionForm.nameLabel")}</label>
          <LanguageTabs languages={LOCALES} active={activeLocale} onChange={setActiveLocale} />
          <Input
            className="mt-2"
            value={name[activeLocale] ?? ""}
            onChange={(e) => setName({ ...name, [activeLocale]: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("pages.store.subscriptionForm.descriptionLabel")}</label>
          <Input
            value={description[activeLocale] ?? ""}
            onChange={(e) => setDescription({ ...description, [activeLocale]: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("pages.store.subscriptionForm.bulletsLabel")}</label>
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            rows={4}
            value={bullets}
            onChange={(e) => setBullets(e.target.value)}
          />
        </div>
      </section>

      {/* Pricing */}
      <section className="space-y-3 border border-border rounded-lg p-4">
        <h2 className="font-semibold">{t("pages.store.subscriptionForm.pricingSection")}</h2>
        {billing.map((row, i) => (
          <div key={i} className="flex items-end gap-2">
            <div>
              <label className="block text-xs mb-1">{t("pages.store.subscriptionForm.interval")}</label>
              <select
                className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                value={row.interval}
                onChange={(e) => setBilling(billing.map((b, j) => (j === i ? { ...b, interval: e.target.value } : b)))}
              >
                {BILLING_INTERVALS.map((iv) => (
                  <option key={iv} value={iv}>
                    {iv === "year" ? t("pages.store.subscriptionForm.intervalYear") : t("pages.store.subscriptionForm.intervalMonth")}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs mb-1">{t("pages.store.subscriptionForm.basePrice")} ({currency})</label>
              <Input
                type="text"
                inputMode="decimal"
                value={row.base_price}
                onChange={(e) => setDecimal(e.target.value, (v) => setBilling(billing.map((b, j) => (j === i ? { ...b, base_price: v } : b))))}
              />
            </div>
            {billing.length > 1 && (
              <Button variant="outline" size="sm" onClick={() => setBilling(billing.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setBilling([...billing, { interval: "year", interval_count: 1, base_price: "" }])}>
          <Plus className="h-4 w-4 mr-1" />
          {t("pages.store.subscriptionForm.addBillingOption")}
        </Button>
      </section>

      {/* Metrics */}
      <section className="space-y-3 border border-border rounded-lg p-4">
        <h2 className="font-semibold">{t("pages.store.subscriptionForm.metricsSection")}</h2>
        {metrics.map((row, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 border-b border-border pb-3">
            <div>
              <label className="block text-xs mb-1">{t("pages.store.subscriptionForm.metricKey")}</label>
              <Input value={row.metric_key} onChange={(e) => setMetrics(metrics.map((m, j) => (j === i ? { ...m, metric_key: e.target.value } : m)))} />
            </div>
            <div>
              <label className="block text-xs mb-1">{t("pages.store.subscriptionForm.aggregation")}</label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={row.aggregation}
                onChange={(e) => setMetrics(metrics.map((m, j) => (j === i ? { ...m, aggregation: e.target.value } : m)))}
              >
                {METRIC_AGGREGATIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1">{t("pages.store.subscriptionForm.includedQuantity")}</label>
              <Input type="text" inputMode="decimal" value={row.included_quantity}
                onChange={(e) => setDecimal(e.target.value, (v) => setMetrics(metrics.map((m, j) => (j === i ? { ...m, included_quantity: v } : m))))} />
            </div>
            <div>
              <label className="block text-xs mb-1">{t("pages.store.subscriptionForm.overagePrice")} ({currency})</label>
              <Input type="text" inputMode="decimal" value={row.overage_unit_price}
                onChange={(e) => setDecimal(e.target.value, (v) => setMetrics(metrics.map((m, j) => (j === i ? { ...m, overage_unit_price: v } : m))))} />
            </div>
            <div>
              <label className="block text-xs mb-1">{t("pages.store.subscriptionForm.hardCap")}</label>
              <Input type="text" inputMode="decimal" value={row.hard_cap}
                onChange={(e) => setDecimal(e.target.value, (v) => setMetrics(metrics.map((m, j) => (j === i ? { ...m, hard_cap: v } : m))))} />
            </div>
            <div className="flex items-end">
              <Button variant="outline" size="sm" onClick={() => setMetrics(metrics.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4 mr-1" />{t("pages.store.subscriptionForm.removeRow")}
              </Button>
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm"
          onClick={() => setMetrics([...metrics, { metric_key: "", included_quantity: "", overage_unit_price: "", hard_cap: "", aggregation: "sum" }])}>
          <Plus className="h-4 w-4 mr-1" />
          {t("pages.store.subscriptionForm.addMetric")}
        </Button>
      </section>

      {/* Options */}
      <section className="space-y-3 border border-border rounded-lg p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t("pages.store.subscriptionForm.trialDays")}</label>
            <Input type="number" value={trialDays} onChange={(e) => setTrialDays(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("pages.store.subscriptionForm.kind")}</label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              {PLAN_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k === "standard" ? t("pages.store.subscriptionForm.kindStandard") : k === "enterprise" ? t("pages.store.subscriptionForm.kindEnterprise") : t("pages.store.subscriptionForm.kindWholesale")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("pages.store.subscriptionForm.checkoutMode")}</label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={checkoutMode} onChange={(e) => setCheckoutMode(e.target.value as typeof checkoutMode)}>
              {CHECKOUT_MODES.map((c) => (
                <option key={c} value={c}>
                  {c === "self_serve" ? t("pages.store.subscriptionForm.checkoutSelfServe") : t("pages.store.subscriptionForm.checkoutContactSales")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("pages.store.subscriptionForm.statusLabel")}</label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="active">{t("pages.store.subscriptions.active")}</option>
              <option value="archived">{t("pages.store.subscriptions.archived")}</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sandbox} onChange={(e) => setSandbox(e.target.checked)} />{t("pages.store.subscriptionForm.sandboxIncluded")}</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />{t("pages.store.subscriptionForm.featured")}</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />{t("pages.store.subscriptionForm.publicLabel")}</label>
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? t("pages.store.subscriptionForm.saving") : existing ? t("pages.store.subscriptionForm.update") : t("pages.store.subscriptionForm.create")}
        </Button>
      </div>
    </div>
  );
}
