"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Truck,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Save,
  Globe,
  Loader2,
  Info,
} from "lucide-react";
import type { IShippingZone, IShippingMethod } from "@/lib/types/shipping";
import { Input } from "@/components/ui/input";
import { MethodCard } from "@/components/shipping/MethodCard";

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

// ============================================
// ZONE CARD
// ============================================

function ZoneCard({
  zone,
  enabledPaymentMethods,
  onUpdate,
  onRemove,
}: {
  zone: EditZone;
  enabledPaymentMethods: string[];
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
    <div className="py-4">
      {/* Zone header */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => onUpdate({ ...zone, _open: !zone._open })}
          className="text-muted-foreground hover:text-[#5e5873]"
        >
          {zone._open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <Globe className="h-4 w-4 text-[#009688] flex-shrink-0" />
        <Input
          value={zone.name}
          onChange={(e) => onUpdate({ ...zone, name: e.target.value })}
          placeholder="Nome zona (es. Italia)"
          className="flex-1 h-9 font-semibold"
        />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Paesi:</span>
          <Input
            value={countryInput}
            onChange={(e) => setCountries(e.target.value)}
            placeholder="IT, DE, FR o * per tutti"
            className="w-44 h-9 text-xs font-mono"
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-red-500 transition-colors"
          title="Rimuovi zona"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Zone body — each method in its own background card */}
      {zone._open && (
        <div className="mt-4 pl-7 space-y-3">
          {zone.methods.map((method, i) => (
            <MethodCard
              key={i}
              method={method}
              enabledPaymentMethods={enabledPaymentMethods}
              onChange={(updated) => updateMethod(i, updated)}
              onRemove={() => removeMethod(i)}
            />
          ))}
          <button
            type="button"
            onClick={addMethod}
            className="flex items-center gap-1.5 text-sm text-[#009688] hover:underline mt-2"
          >
            <Plus className="h-3.5 w-3.5" /> Aggiungi metodo di spedizione
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function ShippingConfigPage() {
  const [zones, setZones] = useState<EditZone[]>([]);
  const [enabledPaymentMethods, setEnabledPaymentMethods] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      const [shippingRes, paymentRes] = await Promise.all([
        fetch("/api/b2b/shipping-config"),
        fetch("/api/b2b/payments/config"),
      ]);

      const shippingJson = await shippingRes.json();
      const fetchedZones: IShippingZone[] = shippingJson.data?.zones ?? [];
      setZones(fetchedZones.map((z) => ({ ...z, _open: false })));

      const paymentJson = await paymentRes.json();
      setEnabledPaymentMethods(paymentJson.config?.enabled_methods ?? []);
    } catch {
      setError("Errore nel caricamento della configurazione");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      const cleanZones = zones.map(({ _open: _, ...zone }) => zone);
      const res = await fetch("/api/b2b/shipping-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zones: cleanZones }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Errore nel salvataggio");
      } else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        loadConfig();
      }
    } catch {
      setError("Errore di rete");
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#5e5873]">
            Configurazione Spedizioni
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Definisci zone di consegna, metodi e tariffe a scaglioni.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all disabled:opacity-50 ${
            saveSuccess
              ? "bg-green-500 text-white"
              : "bg-[#009688] text-white hover:bg-[#00796b]"
          }`}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saveSuccess ? (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saveSuccess ? "Salvato!" : "Salva Configurazione"}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* Info banner */}
      <div className="bg-white rounded-lg border border-[#ebe9f1]">
        <div className="px-5 py-3 flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-blue-50 mt-0.5">
            <Info className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-sm text-muted-foreground">
            Usa codici paese ISO come <code className="text-xs bg-[#f8f8f8] px-1 py-0.5 rounded border border-[#ebe9f1]">IT</code>,{" "}
            <code className="text-xs bg-[#f8f8f8] px-1 py-0.5 rounded border border-[#ebe9f1]">DE</code>,{" "}
            <code className="text-xs bg-[#f8f8f8] px-1 py-0.5 rounded border border-[#ebe9f1]">FR</code>.{" "}
            Usa <code className="text-xs bg-[#f8f8f8] px-1 py-0.5 rounded border border-[#ebe9f1]">*</code> come zona di fallback.
            Le tariffe sono valutate dal <em>Min ordine</em> più alto verso il basso.
          </div>
        </div>
      </div>

      {/* Zones */}
      <div className="bg-white rounded-lg border border-[#ebe9f1]">
        <div className="p-5 border-b border-[#ebe9f1]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-[#009688]/10">
                <Truck className="w-4 h-4 text-[#009688]" />
              </div>
              <div>
                <h2 className="font-semibold text-[#5e5873]">Zone di Spedizione</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {zones.length} zona{zones.length !== 1 ? "e" : ""} configurata{zones.length !== 1 ? "e" : ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={addZone}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#ebe9f1] text-sm font-medium text-[#5e5873] hover:border-[#009688]/30 hover:bg-[#009688]/5 transition-all"
            >
              <Plus className="h-4 w-4" />
              Aggiungi Zona
            </button>
          </div>
        </div>

        <div className="px-5 pb-5">
          {zones.length === 0 ? (
            <div className="text-center py-8">
              <Truck className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-muted-foreground">
                Nessuna zona configurata. Aggiungi una zona per iniziare.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#ebe9f1]">
              {zones.map((zone, i) => (
                <ZoneCard
                  key={i}
                  zone={zone}
                  enabledPaymentMethods={enabledPaymentMethods}
                  onUpdate={(updated) => updateZone(i, updated)}
                  onRemove={() => removeZone(i)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
