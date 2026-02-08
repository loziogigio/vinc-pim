"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  Save,
  Settings2,
  CreditCard,
  CheckCircle2,
  XCircle,
  Shield,
} from "lucide-react";
import {
  PAYMENT_PROVIDERS,
  PAYMENT_PROVIDER_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PROVIDER_CAPABILITIES,
} from "@/lib/constants/payment";
import type { PaymentProvider, PaymentMethod } from "@/lib/constants/payment";

interface TenantConfig {
  tenant_id: string;
  providers: Record<string, Record<string, unknown>>;
  default_provider?: string;
  enabled_methods: string[];
  commission_rate: number;
}

export default function PaymentSettingsPage() {
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Editable state
  const [editDefaultProvider, setEditDefaultProvider] = useState("");
  const [editMethods, setEditMethods] = useState<Set<string>>(new Set());

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/b2b/payments/config");
      if (res.ok) {
        const data = await res.json();
        const cfg = data.config;
        setConfig(cfg);
        setEditDefaultProvider(cfg?.default_provider || "");
        setEditMethods(new Set(cfg?.enabled_methods || []));
      }
    } catch (err) {
      console.error("Error loading config:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const toggleMethod = (method: string) => {
    setEditMethods((prev) => {
      const next = new Set(prev);
      if (next.has(method)) next.delete(method);
      else next.add(method);
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/b2b/payments/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          default_provider: editDefaultProvider || undefined,
          enabled_methods: Array.from(editMethods),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert(data.error || "Errore nel salvataggio");
      }
    } catch {
      alert("Errore di rete");
    } finally {
      setIsSaving(false);
    }
  };

  const isProviderConfigured = (provider: PaymentProvider): boolean => {
    if (!config?.providers) return false;
    const pc = config.providers[provider];
    if (!pc) return false;
    return pc.enabled === true || pc.charges_enabled === true || pc.status === "active";
  };

  if (isLoading) {
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
            Impostazioni Pagamenti
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configura provider predefinito e metodi di pagamento accettati.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all disabled:opacity-50 ${
            saveSuccess
              ? "bg-green-500 text-white"
              : "bg-[#009688] text-white hover:bg-[#00796b]"
          }`}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saveSuccess ? (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saveSuccess ? "Salvato!" : "Salva Impostazioni"}
        </button>
      </div>

      {/* Default Provider */}
      <div className="bg-white rounded-lg border border-[#ebe9f1]">
        <div className="p-5 border-b border-[#ebe9f1]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#009688]/10">
              <Settings2 className="w-4 h-4 text-[#009688]" />
            </div>
            <div>
              <h2 className="font-semibold text-[#5e5873]">Provider Predefinito</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Il gateway utilizzato per i nuovi pagamenti quando non specificato.
              </p>
            </div>
          </div>
        </div>
        <div className="p-5">
          <select
            value={editDefaultProvider}
            onChange={(e) => setEditDefaultProvider(e.target.value)}
            className="w-full max-w-md px-3 py-2.5 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
          >
            <option value="">— Nessun provider predefinito —</option>
            {PAYMENT_PROVIDERS.filter((p) => p !== "manual").map((p) => (
              <option key={p} value={p}>
                {PAYMENT_PROVIDER_LABELS[p]}
                {isProviderConfigured(p) ? " ✓" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Enabled Methods */}
      <div className="bg-white rounded-lg border border-[#ebe9f1]">
        <div className="p-5 border-b border-[#ebe9f1]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#009688]/10">
              <CreditCard className="w-4 h-4 text-[#009688]" />
            </div>
            <div>
              <h2 className="font-semibold text-[#5e5873]">Metodi Accettati</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Seleziona i metodi di pagamento abilitati per il checkout.
              </p>
            </div>
          </div>
        </div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {PAYMENT_METHODS.map((method) => {
            const isEnabled = editMethods.has(method);
            return (
              <label
                key={method}
                className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                  isEnabled
                    ? "border-[#009688] bg-[#009688]/5"
                    : "border-[#ebe9f1] hover:border-[#009688]/30"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => toggleMethod(method)}
                  className="rounded border-gray-300 text-[#009688] focus:ring-[#009688]"
                />
                <span className="text-sm text-[#5e5873]">
                  {PAYMENT_METHOD_LABELS[method as PaymentMethod]}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Commission Rate (read-only) */}
      <div className="bg-white rounded-lg border border-[#ebe9f1]">
        <div className="p-5 border-b border-[#ebe9f1]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#009688]/10">
              <Shield className="w-4 h-4 text-[#009688]" />
            </div>
            <div>
              <h2 className="font-semibold text-[#5e5873]">Commissione Piattaforma</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Impostato dall&apos;amministratore.
              </p>
            </div>
          </div>
        </div>
        <div className="p-5">
          <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#f8f8f8] border border-[#ebe9f1] rounded-lg">
            <span className="text-lg font-bold text-[#5e5873]">
              {((config?.commission_rate || 0) * 100).toFixed(1)}%
            </span>
            <span className="text-sm text-muted-foreground">per transazione</span>
          </div>
        </div>
      </div>

      {/* Provider Status Cards */}
      <div className="bg-white rounded-lg border border-[#ebe9f1]">
        <div className="p-5 border-b border-[#ebe9f1]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#009688]/10">
              <CreditCard className="w-4 h-4 text-[#009688]" />
            </div>
            <div>
              <h2 className="font-semibold text-[#5e5873]">Stato Provider</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Stato di configurazione di ogni gateway.
              </p>
            </div>
          </div>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {PAYMENT_PROVIDERS.filter((p) => p !== "manual").map((provider) => {
            const configured = isProviderConfigured(provider);
            const caps = PROVIDER_CAPABILITIES[provider];
            return (
              <div
                key={provider}
                className={`p-3 rounded-lg border ${
                  configured ? "border-green-200 bg-green-50/50" : "border-[#ebe9f1]"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm text-[#5e5873]">
                    {PAYMENT_PROVIDER_LABELS[provider]}
                  </span>
                  {configured ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-300" />
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {caps.supportsOnClick && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-600 rounded">OnClick</span>
                  )}
                  {caps.supportsMoto && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-purple-50 text-purple-600 rounded">MOTO</span>
                  )}
                  {caps.supportsRecurring && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-cyan-50 text-cyan-600 rounded">Ricorrente</span>
                  )}
                  {caps.supportsAutomaticSplit && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-amber-50 text-amber-600 rounded">Split</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
