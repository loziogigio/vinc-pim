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
import { useTranslation } from "@/lib/i18n/useTranslation";

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
  const { t } = useTranslation();
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
        setError(data.error || t("pages.payments.stripeConnect.errorLoadingStatus"));
      }
    } catch {
      setError(t("pages.payments.stripeConnect.networkError"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

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
        setError(data.error || t("pages.payments.stripeConnect.errorOnboarding"));
      }
    } catch {
      setError(t("pages.payments.stripeConnect.networkError"));
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
        setError(data.error || t("pages.payments.stripeConnect.errorRefreshLink"));
      }
    } catch {
      setError(t("pages.payments.stripeConnect.networkError"));
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
        setError(data.error || t("pages.payments.stripeConnect.errorOpeningDashboard"));
      }
    } catch {
      setError(t("pages.payments.stripeConnect.networkError"));
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
            {t("pages.payments.stripeConnect.loadingStatus")}
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
              {t("pages.payments.stripeConnect.expressAccount")}
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
              {t("pages.payments.stripeConnect.notConnected.description")}
            </p>
            <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 space-y-1">
              <p className="font-medium">{t("pages.payments.stripeConnect.notConnected.whatHappens")}</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>{t("pages.payments.stripeConnect.notConnected.step1")}</li>
                <li>{t("pages.payments.stripeConnect.notConnected.step2")}</li>
                <li>{t("pages.payments.stripeConnect.notConnected.step3")}</li>
                <li>{t("pages.payments.stripeConnect.notConnected.step4")}</li>
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
              {t("pages.payments.stripeConnect.notConnected.connectButton")}
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
                  {t("pages.payments.stripeConnect.pending.title")}
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  {t("pages.payments.stripeConnect.pending.description")}
                </p>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <span className="font-medium">{t("pages.payments.stripeConnect.active.accountIdLabel")}:</span>{" "}
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
                {t("pages.payments.stripeConnect.pending.resumeButton")}
              </button>
              <button
                onClick={fetchStatus}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-[#ebe9f1] hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                {t("pages.payments.stripeConnect.pending.checkStatusButton")}
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
                  {t("pages.payments.stripeConnect.restricted.title")}
                </p>
                <p className="text-xs text-orange-700 mt-1">
                  {status.requirements_pending
                    ? t("pages.payments.stripeConnect.restricted.requirementsPending", { count: String(status.requirements_pending) })
                    : t("pages.payments.stripeConnect.restricted.completeVerification")}
                  {status.current_deadline &&
                    ` ${t("pages.payments.stripeConnect.restricted.deadline", { date: new Date(status.current_deadline).toLocaleDateString() })}`}
                </p>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <span className="font-medium">{t("pages.payments.stripeConnect.active.accountIdLabel")}:</span>{" "}
                <code className="bg-gray-100 px-1.5 py-0.5 rounded">
                  {status.account_id}
                </code>
              </p>
              <p>
                <span className="font-medium">{t("pages.payments.stripeConnect.restricted.paymentsLabel")}</span>{" "}
                {status.charges_enabled
                  ? t("pages.payments.stripeConnect.restricted.enabled")
                  : t("pages.payments.stripeConnect.restricted.disabled")}
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
                {t("pages.payments.stripeConnect.restricted.completeButton")}
              </button>
              <button
                onClick={fetchStatus}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-[#ebe9f1] hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                {t("pages.payments.stripeConnect.restricted.refreshButton")}
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
                  {t("pages.payments.stripeConnect.active.title")}
                </p>
                <p className="text-xs text-green-700 mt-1">
                  {t("pages.payments.stripeConnect.active.description")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">{t("pages.payments.stripeConnect.active.accountIdLabel")}</p>
                <code className="text-sm font-medium text-[#5e5873]">
                  {status.account_id}
                </code>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">{t("pages.payments.stripeConnect.active.connectedOnLabel")}</p>
                <p className="text-sm font-medium text-[#5e5873]">
                  {status.onboarded_at
                    ? new Date(status.onboarded_at).toLocaleDateString()
                    : "—"}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">{t("pages.payments.stripeConnect.active.paymentsLabel")}</p>
                <p className="text-sm font-medium text-green-600">{t("pages.payments.stripeConnect.active.enabled")}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">{t("pages.payments.stripeConnect.active.payoutsLabel")}</p>
                <p
                  className={`text-sm font-medium ${
                    status.payouts_enabled ? "text-green-600" : "text-amber-600"
                  }`}
                >
                  {status.payouts_enabled
                    ? t("pages.payments.stripeConnect.active.enabled")
                    : t("pages.payments.stripeConnect.active.pending")}
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
              {t("pages.payments.stripeConnect.active.dashboardButton")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
