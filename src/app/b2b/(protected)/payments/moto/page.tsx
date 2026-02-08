"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Phone,
  Loader2,
  CheckCircle2,
  AlertCircle,
  CreditCard,
} from "lucide-react";
import {
  PAYMENT_PROVIDERS,
  PAYMENT_PROVIDER_LABELS,
  PROVIDER_CAPABILITIES,
} from "@/lib/constants/payment";
import type { PaymentProvider } from "@/lib/constants/payment";

const MOTO_PROVIDERS = PAYMENT_PROVIDERS.filter(
  (p) => PROVIDER_CAPABILITIES[p].supportsMoto
);

interface MotoResult {
  success: boolean;
  message: string;
  transactionId?: string;
}

export default function MotoTerminalPage() {
  const pathname = usePathname();
  const tenantPrefix =
    pathname?.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [configuredProviders, setConfiguredProviders] = useState<PaymentProvider[]>([]);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  // Form state
  const [orderId, setOrderId] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [amount, setAmount] = useState(0);
  const [provider, setProvider] = useState<PaymentProvider | "">("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [cvv, setCvv] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<MotoResult | null>(null);

  const loadConfig = useCallback(async () => {
    setIsLoadingConfig(true);
    try {
      const res = await fetch("/api/b2b/payments/config");
      if (res.ok) {
        const data = await res.json();
        const config = data.config;
        if (config?.providers) {
          const active = MOTO_PROVIDERS.filter((p) => {
            const pc = config.providers[p] as Record<string, unknown> | undefined;
            return pc && (pc.enabled === true || pc.charges_enabled === true || pc.status === "active");
          });
          setConfiguredProviders(active);
          if (active.length === 1) setProvider(active[0]);
        }
      }
    } catch (err) {
      console.error("Error loading config:", err);
    } finally {
      setIsLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const updateAmountInput = (value: string) => {
    const normalized = value.replace(",", ".");
    if (normalized === "" || /^[0-9]*\.?[0-9]*$/.test(normalized)) {
      setAmountInput(normalized);
      const parsed = parseFloat(normalized);
      setAmount(isNaN(parsed) ? 0 : parsed);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provider || amount <= 0 || !cardNumber || !expiryMonth || !expiryYear || !cvv) return;

    setIsSubmitting(true);
    setResult(null);

    try {
      const res = await fetch("/api/b2b/payments/moto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          amount,
          currency: "EUR",
          order_id: orderId || undefined,
          card: {
            number: cardNumber.replace(/\s/g, ""),
            expiry_month: expiryMonth,
            expiry_year: expiryYear,
            cvv,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({
          success: true,
          message: "Pagamento MOTO eseguito con successo",
          transactionId: data.transaction_id,
        });
        // Clear card data on success
        setCardNumber("");
        setExpiryMonth("");
        setExpiryYear("");
        setCvv("");
      } else {
        setResult({
          success: false,
          message: data.error || "Pagamento fallito",
        });
      }
    } catch {
      setResult({ success: false, message: "Errore di rete" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };

  if (isLoadingConfig) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#5e5873]">Terminale MOTO</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pagamento Mail Order / Telephone Order — inserimento dati carta lato operatore
        </p>
      </div>

      {MOTO_PROVIDERS.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#ebe9f1] p-8 text-center">
          <Phone className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="text-muted-foreground">
            Nessun provider supporta pagamenti MOTO.
          </p>
        </div>
      ) : configuredProviders.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#ebe9f1] p-8 text-center">
          <Phone className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="text-muted-foreground mb-2">
            Nessun provider MOTO configurato.
          </p>
          <p className="text-sm text-muted-foreground">
            Provider compatibili: {MOTO_PROVIDERS.map((p) => PAYMENT_PROVIDER_LABELS[p]).join(", ")}
          </p>
          <Link
            href={`${tenantPrefix}/b2b/payments/settings`}
            className="inline-block mt-3 text-sm text-[#009688] hover:underline"
          >
            Vai alle impostazioni
          </Link>
        </div>
      ) : (
        <div className="max-w-2xl">
          {/* Result Banner */}
          {result && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg text-sm mb-4 ${
                result.success
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {result.success ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{result.message}</span>
              {result.transactionId && (
                <Link
                  href={`${tenantPrefix}/b2b/payments/transactions/${result.transactionId}`}
                  className="ml-auto text-sm font-medium underline"
                >
                  Dettaglio
                </Link>
              )}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-lg border border-[#ebe9f1]"
          >
            {/* Order + Amount */}
            <div className="p-5 border-b border-[#ebe9f1] space-y-4">
              <h2 className="font-medium text-[#5e5873] flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#009688]" />
                Dati Pagamento
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#5e5873] mb-1">
                    ID Ordine (opzionale)
                  </label>
                  <input
                    type="text"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    placeholder="ORD-..."
                    className="w-full px-3 py-2.5 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#5e5873] mb-1">
                    Importo (EUR) *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amountInput}
                    onChange={(e) => updateAmountInput(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full px-3 py-2.5 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#5e5873] mb-1">
                  Provider *
                </label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as PaymentProvider)}
                  required
                  className="w-full px-3 py-2.5 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                >
                  <option value="">Seleziona provider</option>
                  {configuredProviders.map((p) => (
                    <option key={p} value={p}>
                      {PAYMENT_PROVIDER_LABELS[p]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Card Details */}
            <div className="p-5 space-y-4">
              <h2 className="font-medium text-[#5e5873] flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#009688]" />
                Dati Carta
              </h2>
              <div>
                <label className="block text-sm font-medium text-[#5e5873] mb-1">
                  Numero Carta *
                </label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  placeholder="4242 4242 4242 4242"
                  maxLength={19}
                  required
                  className="w-full px-3 py-2.5 border border-[#ebe9f1] rounded-lg text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#5e5873] mb-1">
                    Mese *
                  </label>
                  <select
                    value={expiryMonth}
                    onChange={(e) => setExpiryMonth(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                  >
                    <option value="">MM</option>
                    {Array.from({ length: 12 }, (_, i) =>
                      String(i + 1).padStart(2, "0")
                    ).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#5e5873] mb-1">
                    Anno *
                  </label>
                  <select
                    value={expiryYear}
                    onChange={(e) => setExpiryYear(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                  >
                    <option value="">YYYY</option>
                    {Array.from(
                      { length: 10 },
                      (_, i) => new Date().getFullYear() + i
                    ).map((y) => (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#5e5873] mb-1">
                    CVV *
                  </label>
                  <input
                    type="password"
                    value={cvv}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setCvv(digits);
                    }}
                    placeholder="•••"
                    maxLength={4}
                    required
                    className="w-full px-3 py-2.5 border border-[#ebe9f1] rounded-lg text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="px-5 pb-5">
              <button
                type="submit"
                disabled={isSubmitting || amount <= 0 || !provider}
                className="w-full px-4 py-3 bg-[#009688] text-white rounded-lg font-medium hover:bg-[#00796b] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Phone className="w-4 h-4" />
                )}
                {isSubmitting
                  ? "Elaborazione..."
                  : amount > 0
                  ? `Addebita €${amount.toFixed(2)}`
                  : "Inserisci importo"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
