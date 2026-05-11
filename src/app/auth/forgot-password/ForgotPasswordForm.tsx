"use client";

/**
 * Forgot Password Form
 *
 * Visually mirrors the SSO LoginForm (slate inputs, accent-colored submit,
 * locked-tenant chip) so /auth/forgot-password reads as a continuation of the
 * login flow rather than a separate section. Submits to /api/auth/reset-password,
 * which emails a temporary password.
 */

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle,
  Loader2,
  Lock,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

const DEFAULT_ACCENT_COLOR = "#6366f1";

interface ForgotPasswordFormProps {
  tenantId?: string;
  tenantName?: string;
  primaryColor?: string;
  initialEmail?: string;
  loginUrl: string;
}

export function ForgotPasswordForm({
  tenantId: initialTenantId,
  tenantName,
  primaryColor,
  initialEmail,
  loginUrl,
}: ForgotPasswordFormProps) {
  const { t } = useTranslation();

  const [email, setEmail] = useState(initialEmail || "");
  const [tenantId, setTenantId] = useState(initialTenantId || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isTenantLocked = !!initialTenantId;
  const accentColor = primaryColor || DEFAULT_ACCENT_COLOR;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setIsLoading(true);

      try {
        const response = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, tenant_id: tenantId }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.message || t("forgotPassword.genericError"));
          return;
        }

        setSuccess(true);
      } catch (err) {
        console.error("Reset password error:", err);
        setError(t("forgotPassword.connectionError"));
      } finally {
        setIsLoading(false);
      }
    },
    [email, tenantId, t]
  );

  if (success) {
    return (
      <div className="space-y-5">
        <div className="p-4 bg-green-50 border border-green-100 rounded-lg text-center">
          <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-green-800">
            {t("forgotPassword.successTitle")}
          </p>
          <p className="text-sm text-green-600 mt-1">
            {t("forgotPassword.successDescription", { email })}
          </p>
          <p className="text-sm text-green-600 mt-1">
            {t("forgotPassword.successHint")}
          </p>
        </div>

        <Link
          href={loginUrl}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white font-medium rounded-lg transition-all"
          style={{ backgroundColor: accentColor }}
          onMouseEnter={(e) => {
            e.currentTarget.style.filter = "brightness(0.9)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = "";
          }}
        >
          {t("forgotPassword.goToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          {t("forgotPassword.title")}
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {t("forgotPassword.description")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        )}

        {/* Tenant — locked chip when provided via URL, otherwise an input */}
        {isTenantLocked ? (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="flex-1 text-sm font-medium text-slate-900 truncate">
                {tenantName || initialTenantId}
              </p>
              <Lock className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        ) : (
          <div>
            <label
              htmlFor="tenant_id"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              {t("login.tenantId")}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Building2 className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                id="tenant_id"
                value={tenantId}
                onChange={(e) =>
                  setTenantId(e.target.value.toLowerCase().trim())
                }
                placeholder={t("login.tenantPlaceholder")}
                required
                disabled={isLoading}
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        )}

        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            {t("forgotPassword.emailLabel")}
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("forgotPassword.emailPlaceholder")}
            autoComplete="email"
            required
            disabled={isLoading}
            className="block w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          style={
            {
              backgroundColor: accentColor,
              "--tw-ring-color": accentColor,
            } as React.CSSProperties
          }
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.filter = "brightness(0.9)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = "";
          }}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{t("forgotPassword.submitting")}</span>
            </>
          ) : (
            <span>{t("forgotPassword.submit")}</span>
          )}
        </button>
      </form>

      <div className="text-center">
        <Link
          href={loginUrl}
          className="inline-flex items-center gap-1 text-sm font-medium"
          style={{ color: accentColor }}
        >
          <ArrowLeft className="h-4 w-4" />
          {t("forgotPassword.backToLogin")}
        </Link>
      </div>
    </div>
  );
}
