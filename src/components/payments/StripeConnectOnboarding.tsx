"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  RefreshCw,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

interface ConnectStatus {
  connected: boolean;
  account_id?: string;
  account_status?: "pending" | "active" | "restricted";
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  requirements_pending?: number;
  current_deadline?: string;
  onboarded_at?: string;
  already_onboarded?: boolean;
}

// ============================================
// COMPONENT
// ============================================

export default function StripeConnectOnboarding() {
  const searchParams = useSearchParams();
  const connectAction = searchParams.get("connect");

  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================
  // FETCH STATUS
  // ============================================

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/b2b/payments/connect/status");
      const data = await res.json();
      if (data.success) {
        setStatus(data.data);
      } else {
        setError(data.error || "Errore nel caricamento dello stato");
      }
    } catch {
      setError("Errore di rete");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Handle return from Stripe onboarding
  useEffect(() => {
    if (connectAction === "return") {
      fetchStatus();
    } else if (connectAction === "refresh") {
      handleRefresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectAction]);

  // ============================================
  // ACTIONS
  // ============================================

  const handleOnboard = async () => {
    setIsActioning(true);
    setError(null);
    try {
      const res = await fetch("/api/b2b/payments/connect/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success && data.data.onboarding_url) {
        window.location.href = data.data.onboarding_url;
      } else if (data.success && data.data.already_onboarded) {
        await fetchStatus();
      } else {
        setError(data.error || "Errore durante l'onboarding");
      }
    } catch {
      setError("Errore di rete");
    } finally {
      setIsActioning(false);
    }
  };

  const handleRefresh = async () => {
    setIsActioning(true);
    setError(null);
    try {
      const res = await fetch("/api/b2b/payments/connect/refresh", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success && data.data.onboarding_url) {
        window.location.href = data.data.onboarding_url;
      } else {
        setError(data.error || "Errore nel refresh del link");
      }
    } catch {
      setError("Errore di rete");
    } finally {
      setIsActioning(false);
    }
  };

  const handleDashboard = async () => {
    setIsActioning(true);
    setError(null);
    try {
      const res = await fetch("/api/b2b/payments/connect/dashboard", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success && data.data.dashboard_url) {
        window.open(data.data.dashboard_url, "_blank");
      } else {
        setError(data.error || "Errore nell'apertura della dashboard");
      }
    } catch {
      setError("Errore di rete");
    } finally {
      setIsActioning(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-[#ebe9f1] p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Caricamento stato Stripe Connect...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-[#ebe9f1] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#ebe9f1] bg-gradient-to-r from-[#635bff]/5 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#635bff] flex items-center justify-center">
            <CreditCard className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-[#5e5873]">Stripe Connect</h3>
            <p className="text-xs text-muted-foreground">
              Collegamento Express Account
            </p>
          </div>
        </div>
      </div>

      <div className="p-5">
        {/* Error */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* STATE: Not connected */}
        {(!status || !status.connected) && (
          <div className="space-y-4">
            <p className="text-sm text-[#5e5873]">
              Collega il tuo account Stripe per ricevere pagamenti direttamente
              sul tuo conto bancario. Stripe gestisce la verifica dell&apos;identità
              e la conformità KYC.
            </p>
            <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 space-y-1">
              <p className="font-medium">Cosa succede:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Verrai reindirizzato su Stripe</li>
                <li>Inserisci i dati aziendali e il conto bancario</li>
                <li>Stripe verifica l&apos;identità</li>
                <li>Inizi a ricevere pagamenti</li>
              </ol>
            </div>
            <button
              onClick={handleOnboard}
              disabled={isActioning}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium bg-[#635bff] text-white hover:bg-[#5046e5] transition-colors disabled:opacity-50"
            >
              {isActioning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4" />
              )}
              Connetti con Stripe
            </button>
          </div>
        )}

        {/* STATE: Pending */}
        {status?.connected && status.account_status === "pending" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-amber-50 rounded-lg p-4">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Onboarding in corso
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Completa la registrazione su Stripe per iniziare a ricevere
                  pagamenti.
                </p>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <span className="font-medium">Account ID:</span>{" "}
                <code className="bg-gray-100 px-1.5 py-0.5 rounded">
                  {status.account_id}
                </code>
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleRefresh}
                disabled={isActioning}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#635bff] text-white hover:bg-[#5046e5] transition-colors disabled:opacity-50"
              >
                {isActioning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4" />
                )}
                Riprendi Onboarding
              </button>
              <button
                onClick={fetchStatus}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-[#ebe9f1] hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Verifica Stato
              </button>
            </div>
          </div>
        )}

        {/* STATE: Restricted */}
        {status?.connected && status.account_status === "restricted" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-orange-50 rounded-lg p-4">
              <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-orange-800">
                  Verifica richiesta
                </p>
                <p className="text-xs text-orange-700 mt-1">
                  {status.requirements_pending
                    ? `${status.requirements_pending} requisiti da completare.`
                    : "Completa la verifica per abilitare i pagamenti."}
                  {status.current_deadline &&
                    ` Scadenza: ${new Date(status.current_deadline).toLocaleDateString("it-IT")}`}
                </p>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <span className="font-medium">Account ID:</span>{" "}
                <code className="bg-gray-100 px-1.5 py-0.5 rounded">
                  {status.account_id}
                </code>
              </p>
              <p>
                <span className="font-medium">Pagamenti:</span>{" "}
                {status.charges_enabled ? "Abilitati" : "Disabilitati"}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleRefresh}
                disabled={isActioning}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {isActioning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4" />
                )}
                Completa Verifica
              </button>
              <button
                onClick={fetchStatus}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-[#ebe9f1] hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Aggiorna
              </button>
            </div>
          </div>
        )}

        {/* STATE: Active */}
        {status?.connected && status.account_status === "active" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-green-50 rounded-lg p-4">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  Account collegato e attivo
                </p>
                <p className="text-xs text-green-700 mt-1">
                  I pagamenti vengono automaticamente trasferiti al tuo conto.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Account ID</p>
                <code className="text-sm font-medium text-[#5e5873]">
                  {status.account_id}
                </code>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Collegato il</p>
                <p className="text-sm font-medium text-[#5e5873]">
                  {status.onboarded_at
                    ? new Date(status.onboarded_at).toLocaleDateString("it-IT")
                    : "—"}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Pagamenti</p>
                <p className="text-sm font-medium text-green-600">Abilitati</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Payouts</p>
                <p
                  className={`text-sm font-medium ${
                    status.payouts_enabled ? "text-green-600" : "text-amber-600"
                  }`}
                >
                  {status.payouts_enabled ? "Abilitati" : "In attesa"}
                </p>
              </div>
            </div>

            <button
              onClick={handleDashboard}
              disabled={isActioning}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-[#ebe9f1] hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {isActioning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4" />
              )}
              Apri Dashboard Stripe
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
