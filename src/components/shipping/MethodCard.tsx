"use client";

import { useState, useCallback } from "react";
import { Plus, Trash2, Package, CreditCard, AlertTriangle, Clock, BarChart3 } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { Input } from "@/components/ui/input";
import type { IShippingMethod, IShippingTier } from "@/lib/types/shipping";
import {
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from "@/lib/constants/payment";
import {
  normalizeDecimalInput,
  parseDecimalValue,
  toDecimalInputValue,
} from "@/lib/utils/decimal-input";

type TierWarningData = {
  min: number;
  rate: number;
  prevMin: number;
  prevRate: number;
} | null;

/** Check if tiers have a logical issue: a higher subtotal should not have a higher rate */
function getTierWarningData(tiers: IShippingTier[]): TierWarningData {
  if (tiers.length < 2) return null;
  const sorted = [...tiers].sort((a, b) => a.min_subtotal - b.min_subtotal);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].rate > sorted[i - 1].rate && sorted[i].min_subtotal > sorted[i - 1].min_subtotal) {
      return {
        min: sorted[i].min_subtotal,
        rate: sorted[i].rate,
        prevMin: sorted[i - 1].min_subtotal,
        prevRate: sorted[i - 1].rate,
      };
    }
  }
  return null;
}

// ============================================
// METHOD CARD
// ============================================

interface MethodCardProps {
  method: IShippingMethod;
  enabledPaymentMethods: string[];
  onChange: (updated: IShippingMethod) => void;
  onRemove: () => void;
}

export function MethodCard({
  method,
  enabledPaymentMethods,
  onChange,
  onRemove,
}: MethodCardProps) {
  const { t } = useTranslation();
  // Local string state for tier decimal inputs
  const [tierInputs, setTierInputs] = useState<Record<string, string>>(() => {
    const inputs: Record<string, string> = {};
    method.tiers.forEach((tier, i) => {
      inputs[`${i}_min_subtotal`] = toDecimalInputValue(tier.min_subtotal);
      inputs[`${i}_rate`] = toDecimalInputValue(tier.rate);
    });
    return inputs;
  });

  // Sync local inputs when tiers change externally (add/remove tier)
  const syncInputs = useCallback((tiers: IShippingTier[]) => {
    const inputs: Record<string, string> = {};
    tiers.forEach((tier, i) => {
      inputs[`${i}_min_subtotal`] = toDecimalInputValue(tier.min_subtotal);
      inputs[`${i}_rate`] = toDecimalInputValue(tier.rate);
    });
    setTierInputs(inputs);
  }, []);

  function updateField<K extends keyof IShippingMethod>(
    key: K,
    value: IShippingMethod[K]
  ) {
    onChange({ ...method, [key]: value });
  }

  function getTierInputValue(index: number, field: keyof IShippingTier): string {
    return tierInputs[`${index}_${field}`] ?? toDecimalInputValue((method.tiers[index] as Record<string, number>)?.[field]);
  }

  function updateTier(index: number, field: keyof IShippingTier, rawValue: string) {
    const normalized = normalizeDecimalInput(rawValue);
    if (normalized === null) return;
    setTierInputs(prev => ({ ...prev, [`${index}_${field}`]: normalized }));
    const numValue = parseDecimalValue(normalized) ?? 0;
    const newTiers = method.tiers.map((t, i) =>
      i === index ? { ...t, [field]: numValue } : t
    );
    onChange({ ...method, tiers: newTiers });
  }

  function addTier() {
    const lastTier = method.tiers[method.tiers.length - 1];
    const nextMin = lastTier ? lastTier.min_subtotal + 50 : 0;
    const newTiers = [...method.tiers, { min_subtotal: nextMin, rate: 0 }];
    syncInputs(newTiers);
    onChange({ ...method, tiers: newTiers });
  }

  function removeTier(index: number) {
    const newTiers = method.tiers.filter((_, i) => i !== index);
    syncInputs(newTiers);
    onChange({ ...method, tiers: newTiers });
  }

  function togglePaymentMethod(pm: string, checked: boolean) {
    const current = method.allowed_payment_methods ?? [];
    const updated = checked
      ? [...current, pm]
      : current.filter((m) => m !== pm);
    updateField("allowed_payment_methods", updated.length > 0 ? updated : undefined);
  }

  const tierWarningData = getTierWarningData(method.tiers);
  const tierWarning = tierWarningData
    ? t("components.shippingMethodCard.tierWarning", {
        min: String(tierWarningData.min),
        rate: String(tierWarningData.rate),
        prevMin: String(tierWarningData.prevMin),
        prevRate: String(tierWarningData.prevRate),
      })
    : null;

  return (
    <div className="rounded-lg bg-[#f8f8f8] p-4">
      {/* ── Header: method name, carrier, status, remove ── */}
      <div className="flex items-center gap-3">
        <Package className="h-4 w-4 text-[#009688] flex-shrink-0" />
        <Input
          value={method.name}
          onChange={(e) => updateField("name", e.target.value)}
          placeholder={t("components.shippingMethodCard.methodNamePlaceholder")}
          className="flex-1 h-9 font-medium"
        />
        <Input
          value={method.carrier ?? ""}
          onChange={(e) => updateField("carrier", e.target.value)}
          placeholder={t("components.shippingMethodCard.carrierPlaceholder")}
          className="w-32 h-9"
        />
        <label className="flex items-center gap-2 text-sm text-[#5e5873] cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={method.enabled}
            onChange={(e) => updateField("enabled", e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          {t("components.shippingMethodCard.active")}
        </label>
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-red-500 transition-colors"
          title={t("components.shippingMethodCard.removeMethod")}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* ── 2-column layout: left (consegna + pagamenti) | right (tariffe table) ── */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">

        {/* LEFT COLUMN: Consegna + Pagamenti stacked */}
        <div className="space-y-4">
          {/* Delivery time */}
          <div className="rounded-lg bg-white p-3">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-3.5 w-3.5 text-[#009688]" />
              <span className="text-xs font-semibold text-[#5e5873] uppercase tracking-wide">{t("components.shippingMethodCard.deliverySection")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={method.estimated_days_min ?? ""}
                onChange={(e) =>
                  updateField("estimated_days_min", e.target.value ? parseInt(e.target.value) : undefined)
                }
                placeholder={t("components.shippingMethodCard.minPlaceholder")}
                min={0}
                className="w-16 h-9 text-center"
              />
              <span className="text-sm text-muted-foreground">–</span>
              <Input
                type="number"
                value={method.estimated_days_max ?? ""}
                onChange={(e) =>
                  updateField("estimated_days_max", e.target.value ? parseInt(e.target.value) : undefined)
                }
                placeholder={t("components.shippingMethodCard.maxPlaceholder")}
                min={0}
                className="w-16 h-9 text-center"
              />
              <span className="text-sm text-muted-foreground">{t("components.shippingMethodCard.days")}</span>
            </div>
          </div>

          {/* Payment methods */}
          <div className="rounded-lg bg-white p-3">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="h-3.5 w-3.5 text-[#009688]" />
              <span className="text-xs font-semibold text-[#5e5873] uppercase tracking-wide">{t("components.shippingMethodCard.paymentsSection")}</span>
            </div>
            {enabledPaymentMethods.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {enabledPaymentMethods.map((pm) => {
                    const isChecked = method.allowed_payment_methods?.includes(pm) ?? false;
                    return (
                      <label
                        key={pm}
                        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 cursor-pointer text-xs transition-all ${
                          isChecked
                            ? "border-[#009688] bg-[#009688]/5 text-[#5e5873]"
                            : "border-input hover:border-[#009688]/30 text-[#5e5873]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => togglePaymentMethod(pm, e.target.checked)}
                          className="w-3 h-3 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        {PAYMENT_METHOD_LABELS[pm as PaymentMethod] ?? pm}
                      </label>
                    );
                  })}
                </div>
                {(!method.allowed_payment_methods || method.allowed_payment_methods.length === 0) && (
                  <p className="text-[11px] text-muted-foreground italic mt-2">
                    {t("components.shippingMethodCard.allPaymentMethodsAccepted")}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                {t("components.shippingMethodCard.noPaymentMethods")}
              </p>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Tier pricing table */}
        <div className="rounded-lg bg-white p-3">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-3.5 w-3.5 text-[#009688]" />
            <span className="text-xs font-semibold text-[#5e5873] uppercase tracking-wide">{t("components.shippingMethodCard.tiersSection")}</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#ebe9f1]">
                <th className="text-left pb-2 text-xs font-medium text-muted-foreground">{t("components.shippingMethodCard.minOrderCol")}</th>
                <th className="text-left pb-2 text-xs font-medium text-muted-foreground">{t("components.shippingMethodCard.shippingCostCol")}</th>
                <th className="text-left pb-2 text-xs font-medium text-muted-foreground">{t("components.shippingMethodCard.notesCol")}</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {method.tiers.map((tier, i) => (
                <tr key={i} className="border-b border-[#ebe9f1] last:border-0">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">€</span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={getTierInputValue(i, "min_subtotal")}
                        onChange={(e) => updateTier(i, "min_subtotal", e.target.value)}
                        className="w-24 h-8"
                        placeholder="0"
                      />
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">€</span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={getTierInputValue(i, "rate")}
                        onChange={(e) => updateTier(i, "rate", e.target.value)}
                        className="w-24 h-8 font-medium"
                        placeholder="0"
                      />
                    </div>
                  </td>
                  <td className="py-2 pr-2">
                    {tier.rate === 0 && tier.min_subtotal > 0 && (
                      <span className="inline-block rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold text-green-600">{t("components.shippingMethodCard.free")}</span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    {method.tiers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTier(i)}
                        className="text-muted-foreground hover:text-red-500 transition-colors"
                        title={t("components.shippingMethodCard.removeTier")}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tierWarning && (
            <div className="flex items-start gap-1.5 mt-2 text-xs text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>{tierWarning}</span>
            </div>
          )}
          <button
            type="button"
            onClick={addTier}
            className="flex items-center gap-1 text-xs text-[#009688] hover:underline mt-2"
          >
            <Plus className="h-3 w-3" /> {t("components.shippingMethodCard.addTier")}
          </button>
        </div>
      </div>
    </div>
  );
}
