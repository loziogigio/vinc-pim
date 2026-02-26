"use client";

import { useEffect, useState, useCallback } from "react";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { BackButton } from "@/components/b2b/BackButton";
import { Button } from "@/components/ui/button";
import {
  Truck,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Save,
  Globe,
  Package,
} from "lucide-react";
import type { IShippingZone, IShippingMethod, IShippingTier } from "@/lib/types/shipping";

// ============================================
// LOCAL STATE TYPE
// ============================================

type EditZone = IShippingZone & { _open: boolean };

// ============================================
// HELPERS
// ============================================

function emptyMethod(): IShippingMethod {
  return {
    method_id: "",
    name: "",
    carrier: "",
    tiers: [{ min_subtotal: 0, rate: 0 }],
    enabled: true,
  };
}

function emptyZone(): EditZone {
  return {
    zone_id: "",
    name: "",
    countries: [],
    methods: [emptyMethod()],
    _open: true,
  };
}

function parseDecimal(value: string): number {
  const normalized = value.replace(",", ".");
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
}

// ============================================
// SUB-COMPONENTS
// ============================================

function TierRow({
  tier,
  onChange,
  onRemove,
  canRemove,
}: {
  tier: IShippingTier;
  onChange: (field: keyof IShippingTier, value: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 flex-1">
        <span className="text-xs text-muted-foreground w-16">Min order</span>
        <input
          type="text"
          inputMode="decimal"
          value={tier.min_subtotal}
          onChange={(e) => onChange("min_subtotal", e.target.value)}
          className="w-24 rounded border border-input bg-background px-2 py-1 text-xs"
          placeholder="0"
        />
        <span className="text-xs text-muted-foreground">€ →</span>
        <span className="text-xs text-muted-foreground">Cost</span>
        <input
          type="text"
          inputMode="decimal"
          value={tier.rate}
          onChange={(e) => onChange("rate", e.target.value)}
          className="w-24 rounded border border-input bg-background px-2 py-1 text-xs"
          placeholder="0"
        />
        <span className="text-xs text-muted-foreground">€</span>
      </div>
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive"
          title="Remove tier"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function MethodCard({
  method,
  onChange,
  onRemove,
}: {
  method: IShippingMethod;
  onChange: (updated: IShippingMethod) => void;
  onRemove: () => void;
}) {
  function updateField<K extends keyof IShippingMethod>(
    key: K,
    value: IShippingMethod[K]
  ) {
    onChange({ ...method, [key]: value });
  }

  function updateTier(index: number, field: keyof IShippingTier, rawValue: string) {
    const newTiers = method.tiers.map((t, i) =>
      i === index ? { ...t, [field]: parseDecimal(rawValue) } : t
    );
    onChange({ ...method, tiers: newTiers });
  }

  function addTier() {
    onChange({ ...method, tiers: [...method.tiers, { min_subtotal: 0, rate: 0 }] });
  }

  function removeTier(index: number) {
    onChange({ ...method, tiers: method.tiers.filter((_, i) => i !== index) });
  }

  return (
    <div className="rounded border border-border bg-background p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Package className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <input
          type="text"
          value={method.name}
          onChange={(e) => updateField("name", e.target.value)}
          placeholder="Method name (e.g. Home delivery)"
          className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs font-medium"
        />
        <input
          type="text"
          value={method.carrier ?? ""}
          onChange={(e) => updateField("carrier", e.target.value)}
          placeholder="Carrier (optional)"
          className="w-28 rounded border border-input bg-background px-2 py-1 text-xs"
        />
        <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={method.enabled}
            onChange={(e) => updateField("enabled", e.target.checked)}
            className="h-3.5 w-3.5"
          />
          Active
        </label>
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive ml-1"
          title="Remove method"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Estimated days */}
      <div className="flex items-center gap-2 pl-5">
        <span className="text-xs text-muted-foreground">Delivery days:</span>
        <input
          type="number"
          value={method.estimated_days_min ?? ""}
          onChange={(e) =>
            updateField(
              "estimated_days_min",
              e.target.value ? parseInt(e.target.value) : undefined
            )
          }
          placeholder="min"
          min={0}
          className="w-14 rounded border border-input bg-background px-2 py-1 text-xs"
        />
        <span className="text-xs text-muted-foreground">–</span>
        <input
          type="number"
          value={method.estimated_days_max ?? ""}
          onChange={(e) =>
            updateField(
              "estimated_days_max",
              e.target.value ? parseInt(e.target.value) : undefined
            )
          }
          placeholder="max"
          min={0}
          className="w-14 rounded border border-input bg-background px-2 py-1 text-xs"
        />
      </div>

      {/* Tiers */}
      <div className="pl-5 space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Pricing tiers</p>
        {method.tiers.map((tier, i) => (
          <TierRow
            key={i}
            tier={tier}
            onChange={(field, value) => updateTier(i, field, value)}
            onRemove={() => removeTier(i)}
            canRemove={method.tiers.length > 1}
          />
        ))}
        <button
          type="button"
          onClick={addTier}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Plus className="h-3 w-3" /> Add tier
        </button>
      </div>
    </div>
  );
}

function ZoneCard({
  zone,
  onUpdate,
  onRemove,
}: {
  zone: EditZone;
  onUpdate: (updated: EditZone) => void;
  onRemove: () => void;
}) {
  const countryInput = zone.countries.join(", ");

  function setCountries(raw: string) {
    const codes = raw
      .split(/[\s,]+/)
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    onUpdate({ ...zone, countries: codes });
  }

  function addMethod() {
    onUpdate({ ...zone, methods: [...zone.methods, emptyMethod()] });
  }

  function updateMethod(index: number, updated: IShippingMethod) {
    const methods = zone.methods.map((m, i) => (i === index ? updated : m));
    onUpdate({ ...zone, methods });
  }

  function removeMethod(index: number) {
    onUpdate({ ...zone, methods: zone.methods.filter((_, i) => i !== index) });
  }

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      {/* Zone header */}
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <button
          type="button"
          onClick={() => onUpdate({ ...zone, _open: !zone._open })}
          className="text-muted-foreground hover:text-foreground"
        >
          {zone._open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <Globe className="h-4 w-4 text-primary flex-shrink-0" />
        <input
          type="text"
          value={zone.name}
          onChange={(e) => onUpdate({ ...zone, name: e.target.value })}
          placeholder="Zone name (e.g. Italy)"
          className="flex-1 rounded border border-input bg-background px-2 py-1 text-sm font-semibold"
        />
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Countries:</span>
          <input
            type="text"
            value={countryInput}
            onChange={(e) => setCountries(e.target.value)}
            placeholder="IT, DE, FR or * for all"
            className="w-40 rounded border border-input bg-background px-2 py-1 text-xs font-mono"
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive"
          title="Remove zone"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Zone body */}
      {zone._open && (
        <div className="p-3 space-y-2">
          {zone.methods.map((method, i) => (
            <MethodCard
              key={i}
              method={method}
              onChange={(updated) => updateMethod(i, updated)}
              onRemove={() => removeMethod(i)}
            />
          ))}
          <button
            type="button"
            onClick={addMethod}
            className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
          >
            <Plus className="h-3.5 w-3.5" /> Add shipping method
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function ShippingSettingsPage() {
  const [zones, setZones] = useState<EditZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/b2b/shipping-config");
      const json = await res.json();
      const fetchedZones: IShippingZone[] = json.data?.zones ?? [];
      setZones(fetchedZones.map((z) => ({ ...z, _open: false })));
    } catch {
      setMessage({ type: "error", text: "Failed to load shipping configuration" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      // Strip UI-only _open field before sending
      const cleanZones = zones.map(({ _open: _, ...zone }) => zone);
      const res = await fetch("/api/b2b/shipping-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zones: cleanZones }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: json.error || "Save failed" });
      } else {
        setMessage({ type: "success", text: "Shipping configuration saved" });
        // Reload to get server-generated IDs
        loadConfig();
      }
    } catch {
      setMessage({ type: "error", text: "Unexpected error while saving" });
    } finally {
      setSaving(false);
    }
  }

  function addZone() {
    setZones((prev) => [...prev, emptyZone()]);
  }

  function updateZone(index: number, updated: EditZone) {
    setZones((prev) => prev.map((z, i) => (i === index ? updated : z)));
  }

  function removeZone(index: number) {
    setZones((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-[1400px] px-4 py-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Breadcrumbs
              items={[
                { label: "Settings", href: "/b2b/settings" },
                { label: "Shipping" },
              ]}
            />
            <BackButton />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Shipping Configuration</h1>
              <p className="text-xs text-muted-foreground">
                Define delivery zones, methods, and tiered pricing for B2B orders
              </p>
            </div>
            <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>

          {message && (
            <div
              className={`rounded-lg px-3 py-2 text-xs ${
                message.type === "success"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {message.text}
            </div>
          )}

          {loading ? (
            <div className="rounded-lg bg-card p-6 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : (
            <div className="space-y-3">
              {/* Info banner */}
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
                <strong>Tip:</strong> Use country codes like <code>IT</code>, <code>DE</code>, <code>FR</code>{" "}
                (ISO 3166-1 alpha-2). Use <code>*</code> as a catch-all fallback zone.
                Tiers are evaluated from highest <em>Min order</em> downwards.
              </div>

              {/* Zones */}
              <div className="rounded-lg bg-card p-3.5 shadow-sm">
                <div className="flex items-center gap-1.5 mb-3">
                  <Truck className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold">Shipping Zones</h2>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {zones.length} zone{zones.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {zones.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No zones configured yet. Add a zone to get started.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {zones.map((zone, i) => (
                      <ZoneCard
                        key={i}
                        zone={zone}
                        onUpdate={(updated) => updateZone(i, updated)}
                        onRemove={() => removeZone(i)}
                      />
                    ))}
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addZone}
                    className="gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Zone
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
