"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Save,
  RefreshCw,
  Hash,
  Settings2,
  Calendar,
  ArrowRight,
  Info,
  Building2,
  ExternalLink,
} from "lucide-react";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_PREFIXES,
  PAYMENT_TERMS,
  PAYMENT_TERMS_LABELS,
  DEFAULT_NUMBERING_FORMATS,
  DEFAULT_NUMBER_PADDING,
} from "@/lib/constants/document";
import type { DocumentType } from "@/lib/constants/document";

/** Client-side format preview (mirrors server-side formatDocumentNumber) */
function formatPreview(format: string, year: number, number: number, padding: number): string {
  return format
    .replaceAll("{YEAR}", String(year))
    .replaceAll("{NUMBER}", String(number).padStart(padding, "0"));
}

interface NumberingConfig {
  document_type: DocumentType;
  format: string;
  padding: number;
  reset_yearly: boolean;
}

interface Settings {
  numbering: NumberingConfig[];
  default_currency: string;
  default_payment_terms?: string;
  default_notes?: string;
  default_validity_days: number;
}

interface CounterEntry {
  type: DocumentType;
  value: number;
}

const TYPE_COLORS: Record<DocumentType, { bg: string; text: string; border: string }> = {
  quotation: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  proforma: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  invoice: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  credit_note: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
};

export default function DocumentSettingsPage() {
  const pathname = usePathname();
  const tenantPrefix = pathname?.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [settings, setSettings] = useState<Settings | null>(null);
  const [counters, setCounters] = useState<CounterEntry[]>([]);
  const [counterYear, setCounterYear] = useState(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingCounters, setIsLoadingCounters] = useState(false);
  const [savingCounterType, setSavingCounterType] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Editable state
  const [editNumbering, setEditNumbering] = useState<NumberingConfig[]>([]);
  const [editCurrency, setEditCurrency] = useState("EUR");
  const [editPaymentTerms, setEditPaymentTerms] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editValidityDays, setEditValidityDays] = useState(30);
  const [editCounterValues, setEditCounterValues] = useState<
    Record<string, string>
  >({});

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/b2b/documents/settings");
      const data = await res.json();
      if (data.success && data.settings) {
        const s = data.settings;
        setSettings(s);

        const numbering: NumberingConfig[] = DOCUMENT_TYPES.map((type) => {
          const existing = s.numbering?.find(
            (n: NumberingConfig) => n.document_type === type,
          );
          return {
            document_type: type,
            format: existing?.format || DEFAULT_NUMBERING_FORMATS[type],
            padding: existing?.padding ?? DEFAULT_NUMBER_PADDING,
            reset_yearly: existing?.reset_yearly ?? true,
          };
        });

        setEditNumbering(numbering);
        setEditCurrency(s.default_currency || "EUR");
        setEditPaymentTerms(s.default_payment_terms || "");
        setEditNotes(s.default_notes || "");
        setEditValidityDays(s.default_validity_days || 30);
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchCounters = useCallback(async () => {
    setIsLoadingCounters(true);
    try {
      const res = await fetch(
        `/api/b2b/documents/settings/counters?year=${counterYear}`,
      );
      const data = await res.json();
      if (data.success) {
        const raw = data.counters || {};
        const entries: CounterEntry[] = DOCUMENT_TYPES.map((type) => ({
          type,
          value: raw[`${type}_${counterYear}`] || 0,
        }));
        setCounters(entries);
        const vals: Record<string, string> = {};
        for (const c of entries) {
          vals[c.type] = String(c.value);
        }
        setEditCounterValues(vals);
      }
    } catch (err) {
      console.error("Failed to fetch counters:", err);
    } finally {
      setIsLoadingCounters(false);
    }
  }, [counterYear]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    fetchCounters();
  }, [fetchCounters]);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/b2b/documents/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numbering: editNumbering,
          default_currency: editCurrency,
          default_payment_terms: editPaymentTerms || undefined,
          default_notes: editNotes || undefined,
          default_validity_days: editValidityDays,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
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

  const handleSetCounter = async (type: DocumentType) => {
    const value = parseInt(editCounterValues[type] || "0");
    if (isNaN(value) || value < 0) {
      alert("Il valore deve essere un numero positivo");
      return;
    }
    setSavingCounterType(type);
    try {
      const res = await fetch(
        `/api/b2b/documents/settings/counters/${type}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value, year: counterYear }),
        },
      );
      const data = await res.json();
      if (data.success) {
        fetchCounters();
      } else {
        alert(data.error || "Errore");
      }
    } catch {
      alert("Errore di rete");
    } finally {
      setSavingCounterType("");
    }
  };

  const updateNumberingField = (
    type: DocumentType,
    field: keyof NumberingConfig,
    value: string | number | boolean,
  ) => {
    setEditNumbering(
      editNumbering.map((n) =>
        n.document_type === type ? { ...n, [field]: value } : n,
      ),
    );
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
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#5e5873]">
            Impostazioni Documenti
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configura numerazione, valori predefiniti e contatori per i tuoi
            documenti.
          </p>
        </div>
        <button
          onClick={handleSaveSettings}
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

      {/* Company Info Link */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <Building2 className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-amber-800">
            Le informazioni aziendali che appaiono nei documenti (ragione sociale, P.IVA, indirizzo, logo, ecc.) sono configurate nelle{" "}
            <strong>Impostazioni del Negozio</strong>.
          </p>
          <Link
            href={`${tenantPrefix}/b2b/home-settings`}
            className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-amber-700 hover:text-amber-900 transition-colors"
          >
            Vai alle Impostazioni Azienda
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Numbering Configuration */}
      <div className="bg-white rounded-lg border border-[#ebe9f1]">
        <div className="p-5 border-b border-[#ebe9f1]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#009688]/10">
              <Hash className="w-4 h-4 text-[#009688]" />
            </div>
            <div>
              <h2 className="font-semibold text-[#5e5873]">Numerazione Progressiva</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Formato per ogni tipo di documento. Usa{" "}
                <code className="px-1 py-0.5 bg-[#f8f8f8] rounded text-[10px] font-mono">
                  {"{YEAR}"}
                </code>{" "}
                per l&apos;anno e{" "}
                <code className="px-1 py-0.5 bg-[#f8f8f8] rounded text-[10px] font-mono">
                  {"{NUMBER}"}
                </code>{" "}
                per il progressivo.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 grid grid-cols-2 gap-4">
          {editNumbering.map((config) => {
            const colors = TYPE_COLORS[config.document_type];
            const previewNumber = formatPreview(
              config.format,
              new Date().getFullYear(),
              42,
              config.padding,
            );
            return (
              <div
                key={config.document_type}
                className={`rounded-lg border ${colors.border} ${colors.bg} p-4`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-sm font-semibold ${colors.text}`}>
                    {DOCUMENT_TYPE_LABELS[config.document_type]}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground bg-white/80 px-2 py-0.5 rounded">
                    {DOCUMENT_TYPE_PREFIXES[config.document_type]}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#5e5873]/70 mb-1">
                      Formato
                    </label>
                    <input
                      type="text"
                      value={config.format}
                      onChange={(e) =>
                        updateNumberingField(
                          config.document_type,
                          "format",
                          e.target.value,
                        )
                      }
                      className="w-full px-3 py-2 bg-white border border-[#ebe9f1] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                    />
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-[11px] font-medium text-[#5e5873]/70 mb-1">
                        Cifre (padding)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={config.padding}
                        onChange={(e) =>
                          updateNumberingField(
                            config.document_type,
                            "padding",
                            parseInt(e.target.value) || 5,
                          )
                        }
                        className="w-full px-3 py-2 bg-white border border-[#ebe9f1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                      />
                    </div>
                    <div className="flex-1 flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer py-2">
                        <input
                          type="checkbox"
                          checked={config.reset_yearly}
                          onChange={(e) =>
                            updateNumberingField(
                              config.document_type,
                              "reset_yearly",
                              e.target.checked,
                            )
                          }
                          className="rounded border-gray-300 text-[#009688] focus:ring-[#009688]"
                        />
                        <span className="text-xs text-[#5e5873]/70">
                          Reset annuale
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Live Preview */}
                  <div className="flex items-center gap-2 pt-1 border-t border-black/5">
                    <span className="text-[11px] text-muted-foreground">Anteprima:</span>
                    <span className="font-mono text-sm font-medium text-[#5e5873]">
                      {previewNumber}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Defaults */}
      <div className="bg-white rounded-lg border border-[#ebe9f1]">
        <div className="p-5 border-b border-[#ebe9f1]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#009688]/10">
              <Settings2 className="w-4 h-4 text-[#009688]" />
            </div>
            <div>
              <h2 className="font-semibold text-[#5e5873]">Valori Predefiniti</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Valori applicati automaticamente ai nuovi documenti.
              </p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-[#5e5873] mb-1.5">
                Valuta
              </label>
              <select
                value={editCurrency}
                onChange={(e) => setEditCurrency(e.target.value)}
                className="w-full px-3 py-2.5 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
              >
                <option value="EUR">EUR - Euro</option>
                <option value="USD">USD - Dollaro USA</option>
                <option value="GBP">GBP - Sterlina</option>
                <option value="CHF">CHF - Franco Svizzero</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5e5873] mb-1.5">
                Termini di Pagamento
              </label>
              <select
                value={editPaymentTerms}
                onChange={(e) => setEditPaymentTerms(e.target.value)}
                className="w-full px-3 py-2.5 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
              >
                <option value="">— Nessuno —</option>
                {PAYMENT_TERMS.map((t) => (
                  <option key={t} value={t}>
                    {PAYMENT_TERMS_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5e5873] mb-1.5">
                Validità Preventivo (giorni)
              </label>
              <input
                type="number"
                min={1}
                value={editValidityDays}
                onChange={(e) =>
                  setEditValidityDays(parseInt(e.target.value) || 30)
                }
                className="w-full px-3 py-2.5 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#5e5873] mb-1.5">
              Note Predefinite
            </label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={3}
              placeholder="Note che appariranno di default su ogni nuovo documento..."
              className="w-full px-3 py-2.5 border border-[#ebe9f1] rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
            />
          </div>
        </div>
      </div>

      {/* Counter Management */}
      <div className="bg-white rounded-lg border border-[#ebe9f1]">
        <div className="p-5 border-b border-[#ebe9f1]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-[#009688]/10">
                <Calendar className="w-4 h-4 text-[#009688]" />
              </div>
              <div>
                <h2 className="font-semibold text-[#5e5873]">
                  Contatori Numerazione
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Gestisci i contatori progressivi per ogni tipo di documento.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={counterYear}
                onChange={(e) => setCounterYear(parseInt(e.target.value))}
                className="px-3 py-2 border border-[#ebe9f1] rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
              >
                {Array.from(
                  { length: 5 },
                  (_, i) => new Date().getFullYear() - 2 + i,
                ).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <button
                onClick={fetchCounters}
                disabled={isLoadingCounters}
                className="p-2 rounded-lg hover:bg-[#f8f8f8] transition-colors"
                title="Aggiorna contatori"
              >
                <RefreshCw
                  className={`w-4 h-4 text-muted-foreground ${isLoadingCounters ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          </div>
        </div>

        {isLoadingCounters ? (
          <div className="p-8 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="p-5 grid grid-cols-2 gap-4">
            {DOCUMENT_TYPES.map((type) => {
              const colors = TYPE_COLORS[type];
              const currentValue = parseInt(editCounterValues[type] || "0");
              const config = editNumbering.find((n) => n.document_type === type);
              const nextPreview = config
                ? formatPreview(
                    config.format,
                    counterYear,
                    currentValue + 1,
                    config.padding,
                  )
                : "";

              return (
                <div
                  key={type}
                  className="rounded-lg border border-[#ebe9f1] p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}
                      >
                        {DOCUMENT_TYPE_LABELS[type]}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                        Ultimo numero emesso
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={editCounterValues[type] || "0"}
                        onChange={(e) =>
                          setEditCounterValues({
                            ...editCounterValues,
                            [type]: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-[#ebe9f1] rounded-lg text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                      />
                    </div>
                    <button
                      onClick={() => handleSetCounter(type)}
                      disabled={!!savingCounterType}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm border border-[#ebe9f1] rounded-lg hover:bg-[#f8f8f8] transition-colors disabled:opacity-50 font-medium text-[#5e5873]"
                    >
                      {savingCounterType === type ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        "Imposta"
                      )}
                    </button>
                  </div>

                  {/* Next number preview */}
                  <div className="mt-3 pt-3 border-t border-[#ebe9f1] flex items-center gap-2">
                    <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <span className="text-[11px] text-muted-foreground">
                      Prossimo:
                    </span>
                    <span className="text-xs font-mono font-medium text-[#5e5873]">
                      {nextPreview}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info box */}
        <div className="px-5 pb-5">
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Il contatore viene incrementato automaticamente alla finalizzazione
              di ogni documento. Modifica il valore solo se necessario allineare
              la numerazione.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
