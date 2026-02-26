"use client";

import { useEffect, useState, useCallback } from "react";
import { Truck, Loader2, AlertCircle } from "lucide-react";
import type { ShippingMethodOption } from "@/lib/types/shipping";

interface ShippingMethodSelectorProps {
  orderId: string;
  currency: string;
  subtotalNet: number;
  currentShippingMethod?: string;
  onApplied: (result: {
    shipping_method: string;
    shipping_cost: number;
    order_total: number;
  }) => void;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: currency || "EUR",
  }).format(amount);
}

export function ShippingMethodSelector({
  orderId,
  currency,
  subtotalNet,
  currentShippingMethod,
  onApplied,
}: ShippingMethodSelectorProps) {
  const [zoneName, setZoneName] = useState<string | null>(null);
  const [options, setOptions] = useState<ShippingMethodOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/b2b/orders/${orderId}/shipping-options`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to load shipping options");
        return;
      }
      setZoneName(json.data.zone_name);
      setOptions(json.data.options ?? []);
    } catch {
      setError("Failed to load shipping options");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions, subtotalNet]);

  async function applyMethod(methodId: string) {
    setApplying(methodId);
    setError(null);
    try {
      const res = await fetch(`/api/b2b/orders/${orderId}/shipping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method_id: methodId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to apply shipping method");
        return;
      }
      onApplied(json.data);
      // Reload options to reflect updated computed costs
      loadOptions();
    } catch {
      setError("Failed to apply shipping method");
    } finally {
      setApplying(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading shipping options…
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
        <Truck className="h-3.5 w-3.5 flex-shrink-0" />
        {error
          ? error
          : "No shipping methods available for this address. Configure zones in Settings → Shipping."}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Truck className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold">
          Shipping
          {zoneName && (
            <span className="ml-1 font-normal text-muted-foreground">
              — {zoneName}
            </span>
          )}
        </span>
      </div>

      <div className="space-y-1.5">
        {options.map((opt) => {
          const isSelected = currentShippingMethod === opt.name;
          const isApplying = applying === opt.method_id;
          return (
            <button
              key={opt.method_id}
              type="button"
              onClick={() => applyMethod(opt.method_id)}
              disabled={isApplying || applying !== null}
              className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background hover:border-primary/40 hover:bg-muted/30"
              }`}
            >
              {/* Selection indicator */}
              <div
                className={`h-3.5 w-3.5 flex-shrink-0 rounded-full border-2 ${
                  isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                }`}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium">{opt.name}</span>
                  {opt.carrier && (
                    <span className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                      {opt.carrier}
                    </span>
                  )}
                  {opt.estimated_days_min != null && (
                    <span className="text-[10px] text-muted-foreground">
                      {opt.estimated_days_min}
                      {opt.estimated_days_max && opt.estimated_days_max !== opt.estimated_days_min
                        ? `–${opt.estimated_days_max}`
                        : ""}{" "}
                      days
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 text-right">
                {isApplying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : opt.is_free ? (
                  <span className="text-xs font-semibold text-emerald-600">Free</span>
                ) : (
                  <span className="text-xs font-semibold">
                    {formatCurrency(opt.computed_cost, currency)}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}
    </div>
  );
}
