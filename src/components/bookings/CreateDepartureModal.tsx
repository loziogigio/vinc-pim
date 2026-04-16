"use client";

import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { RESOURCE_TYPES, RESOURCE_TYPE_LABELS, type ResourceType } from "@/lib/constants/booking";
import { normalizeDecimalInput, parseDecimalValue, toDecimalInputValue } from "@/lib/utils/decimal-input";

interface ResourceInput {
  resource_type: ResourceType;
  child_entity_code: string;
  total_capacity: number;
  price_override?: string;
  currency: string;
}

interface CreateDepartureModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const emptyResource = (): ResourceInput => ({
  resource_type: "cabin",
  child_entity_code: "",
  total_capacity: 10,
  price_override: "",
  currency: "EUR",
});

export function CreateDepartureModal({ open, onClose, onCreated }: CreateDepartureModalProps) {
  const { t } = useTranslation();
  const [label, setLabel] = useState("");
  const [productEntityCode, setProductEntityCode] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [cutoffDate, setCutoffDate] = useState("");
  const [holdTtlMin, setHoldTtlMin] = useState("15");
  const [resources, setResources] = useState<ResourceInput[]>([emptyResource()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  function updateResource(idx: number, updates: Partial<ResourceInput>) {
    setResources((prev) => prev.map((r, i) => (i === idx ? { ...r, ...updates } : r)));
  }

  function removeResource(idx: number) {
    setResources((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    setError("");
    if (!label || !productEntityCode || !startsAt) {
      setError("Label, product, and start date are required.");
      return;
    }

    setSaving(true);
    try {
      const body = {
        label,
        product_entity_code: productEntityCode,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : undefined,
        booking_cutoff_at: cutoffDate ? new Date(cutoffDate).toISOString() : undefined,
        hold_ttl_ms: parseInt(holdTtlMin) * 60 * 1000,
        resources: resources
          .filter((r) => r.child_entity_code)
          .map((r) => ({
            resource_type: r.resource_type,
            child_entity_code: r.child_entity_code,
            total_capacity: r.total_capacity,
            price_override: r.price_override ? parseDecimalValue(r.price_override) : undefined,
            currency: r.currency,
          })),
      };

      const res = await fetch("/api/b2b/departures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        onCreated();
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create departure");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-[0.428rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebe9f1]">
          <div>
            <h2 className="text-lg font-bold text-[#5e5873]">{t("pages.bookings.departures.createTitle")}</h2>
            <p className="text-xs text-[#b9b9c3]">{t("pages.bookings.departures.createSubtitle")}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[#fafafc] transition">
            <X className="h-5 w-5 text-[#b9b9c3]" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="rounded-[0.358rem] bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          {/* Label + Product */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#5e5873] mb-1">{t("pages.bookings.departures.label")}</label>
              <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} className="w-full rounded-[0.358rem] border border-[#ebe9f1] px-3 py-2 text-sm text-[#5e5873] focus:border-[#009688] focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5e5873] mb-1">{t("pages.bookings.departures.product")}</label>
              <input type="text" value={productEntityCode} onChange={(e) => setProductEntityCode(e.target.value)} placeholder="ship-msc-..." className="w-full rounded-[0.358rem] border border-[#ebe9f1] px-3 py-2 text-sm text-[#5e5873] placeholder:text-[#d5d5dc] focus:border-[#009688] focus:outline-none" />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#5e5873] mb-1">{t("pages.bookings.departures.startsAt")}</label>
              <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="w-full rounded-[0.358rem] border border-[#ebe9f1] px-3 py-2 text-sm text-[#5e5873] focus:border-[#009688] focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5e5873] mb-1">{t("pages.bookings.departures.endsAt")}</label>
              <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="w-full rounded-[0.358rem] border border-[#ebe9f1] px-3 py-2 text-sm text-[#5e5873] focus:border-[#009688] focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5e5873] mb-1">{t("pages.bookings.departures.cutoffDate")}</label>
              <input type="datetime-local" value={cutoffDate} onChange={(e) => setCutoffDate(e.target.value)} className="w-full rounded-[0.358rem] border border-[#ebe9f1] px-3 py-2 text-sm text-[#5e5873] focus:border-[#009688] focus:outline-none" />
            </div>
          </div>

          {/* Hold TTL */}
          <div className="w-32">
            <label className="block text-xs font-medium text-[#5e5873] mb-1">{t("pages.bookings.departures.holdTtl")}</label>
            <input type="number" value={holdTtlMin} onChange={(e) => setHoldTtlMin(e.target.value)} min="1" className="w-full rounded-[0.358rem] border border-[#ebe9f1] px-3 py-2 text-sm text-[#5e5873] focus:border-[#009688] focus:outline-none" />
          </div>

          {/* Resources */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-[#5e5873]">{t("pages.bookings.departureDetail.resources")}</label>
              <button onClick={() => setResources((prev) => [...prev, emptyResource()])} className="flex items-center gap-1 text-xs text-[#009688] hover:underline">
                <Plus className="h-3 w-3" /> {t("pages.bookings.departures.addResource")}
              </button>
            </div>
            <div className="space-y-2">
              {resources.map((res, idx) => (
                <div key={idx} className="flex items-end gap-2 rounded-[0.358rem] border border-[#ebe9f1] p-3 bg-[#fafafc]">
                  <div className="flex-1">
                    <label className="block text-[10px] text-[#b9b9c3] mb-0.5">{t("pages.bookings.departures.resourceType")}</label>
                    <select value={res.resource_type} onChange={(e) => updateResource(idx, { resource_type: e.target.value as ResourceType })} className="w-full rounded-[0.258rem] border border-[#ebe9f1] px-2 py-1.5 text-xs text-[#5e5873] focus:outline-none">
                      {RESOURCE_TYPES.map((rt) => (
                        <option key={rt} value={rt}>{RESOURCE_TYPE_LABELS[rt]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-[2]">
                    <label className="block text-[10px] text-[#b9b9c3] mb-0.5">{t("pages.bookings.departures.childProduct")}</label>
                    <input type="text" value={res.child_entity_code} onChange={(e) => updateResource(idx, { child_entity_code: e.target.value })} placeholder="cabin-..." className="w-full rounded-[0.258rem] border border-[#ebe9f1] px-2 py-1.5 text-xs text-[#5e5873] placeholder:text-[#d5d5dc] focus:outline-none" />
                  </div>
                  <div className="w-20">
                    <label className="block text-[10px] text-[#b9b9c3] mb-0.5">{t("pages.bookings.departures.totalCapacity")}</label>
                    <input type="number" value={res.total_capacity} onChange={(e) => updateResource(idx, { total_capacity: parseInt(e.target.value) || 0 })} min="1" className="w-full rounded-[0.258rem] border border-[#ebe9f1] px-2 py-1.5 text-xs text-[#5e5873] focus:outline-none" />
                  </div>
                  <div className="w-24">
                    <label className="block text-[10px] text-[#b9b9c3] mb-0.5">{t("pages.bookings.departures.priceOverride")}</label>
                    <input type="text" inputMode="decimal" value={res.price_override || ""} onChange={(e) => { const n = normalizeDecimalInput(e.target.value); if (n !== null) updateResource(idx, { price_override: n }); }} placeholder="0.00" className="w-full rounded-[0.258rem] border border-[#ebe9f1] px-2 py-1.5 text-xs text-[#5e5873] placeholder:text-[#d5d5dc] focus:outline-none" />
                  </div>
                  <button onClick={() => removeResource(idx)} className="p-1.5 text-red-400 hover:text-red-600 transition" disabled={resources.length <= 1}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#ebe9f1]">
          <button onClick={onClose} className="rounded-[0.358rem] border border-[#ebe9f1] px-4 py-2 text-sm text-[#6e6b7b] hover:bg-[#fafafc] transition">
            {t("pages.bookings.departures.cancel")}
          </button>
          <button onClick={handleSubmit} disabled={saving} className="rounded-[0.358rem] bg-[#009688] px-4 py-2 text-sm font-medium text-white hover:bg-[#00796b] transition disabled:opacity-50">
            {saving ? "..." : t("pages.bookings.departures.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
