"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  Wallet,
  Landmark,
  Smartphone,
  Terminal,
  HandCoins,
  Loader2,
  CheckCircle2,
  XCircle,
  Star,
} from "lucide-react";
import {
  PAYMENT_PROVIDERS,
  PAYMENT_PROVIDER_LABELS,
  PROVIDER_CAPABILITIES,
} from "@/lib/constants/payment";
import type { PaymentProvider } from "@/lib/constants/payment";

const PROVIDER_ICONS: Record<PaymentProvider, React.ElementType> = {
  stripe: CreditCard,
  paypal: Wallet,
  mangopay: Landmark,
  nexi: Terminal,
  axerve: Terminal,
  satispay: Smartphone,
  scalapay: Smartphone,
  manual: HandCoins,
};

interface TenantConfig {
  tenant_id: string;
  providers: Record<string, unknown>;
  default_provider?: string;
  enabled_methods: string[];
}

export default function GatewaysPage() {
  const pathname = usePathname();
  const tenantPrefix =
    pathname?.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/b2b/payments/config");
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config || null);
      }
    } catch (error) {
      console.error("Error loading config:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const isConfigured = (provider: PaymentProvider): boolean => {
    if (!config?.providers) return false;
    const providerConfig = config.providers[provider];
    if (!providerConfig) return false;
    const pc = providerConfig as Record<string, unknown>;
    return pc.enabled === true || pc.charges_enabled === true || pc.status === "active";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#5e5873]">Gateway di Pagamento</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Provider configurati e le loro capacità
          </p>
        </div>
        <Link
          href={`${tenantPrefix}/b2b/payments/settings`}
          className="px-4 py-2 bg-[#009688] text-white rounded-lg text-sm hover:bg-[#00796b] transition-colors"
        >
          Impostazioni
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PAYMENT_PROVIDERS.map((provider) => {
            const Icon = PROVIDER_ICONS[provider];
            const caps = PROVIDER_CAPABILITIES[provider];
            const configured = isConfigured(provider);
            const isDefault = config?.default_provider === provider;

            return (
              <div
                key={provider}
                className={`bg-white rounded-lg border p-4 ${
                  configured
                    ? "border-green-200"
                    : "border-[#ebe9f1]"
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-[#5e5873]" />
                    <span className="font-medium text-[#5e5873]">
                      {PAYMENT_PROVIDER_LABELS[provider]}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isDefault && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        <Star className="w-3 h-3" />
                        Default
                      </span>
                    )}
                    {configured ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <CheckCircle2 className="w-3 h-3" />
                        Attivo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                        <XCircle className="w-3 h-3" />
                        Non configurato
                      </span>
                    )}
                  </div>
                </div>

                {/* Capabilities */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {caps.supportsOnClick && (
                    <span className="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-600">OnClick</span>
                  )}
                  {caps.supportsMoto && (
                    <span className="px-2 py-0.5 rounded text-xs bg-purple-50 text-purple-600">MOTO</span>
                  )}
                  {caps.supportsRecurring && (
                    <span className="px-2 py-0.5 rounded text-xs bg-cyan-50 text-cyan-600">Ricorrente</span>
                  )}
                  {caps.supportsAutomaticSplit && (
                    <span className="px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-600">Split</span>
                  )}
                  {!caps.supportsOnClick && !caps.supportsMoto && !caps.supportsRecurring && (
                    <span className="px-2 py-0.5 rounded text-xs bg-gray-50 text-gray-400">Nessuna</span>
                  )}
                </div>

                {/* Action */}
                <Link
                  href={`${tenantPrefix}/b2b/payments/settings`}
                  className="text-sm text-[#009688] hover:underline"
                >
                  Configura →
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
