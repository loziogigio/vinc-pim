"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle,
  Loader2,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { UILanguageSwitcher } from "@/components/b2b/UILanguageSwitcher";

interface ForgotPasswordFormProps {
  tenantId?: string;
  initialEmail?: string;
  loginUrl: string;
}

export function ForgotPasswordForm({
  tenantId: initialTenantId,
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
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-end">
          <UILanguageSwitcher />
        </div>
        <div className="rounded-[0.428rem] border border-emerald-200/70 bg-emerald-50 p-6 text-center dark:border-emerald-400/30 dark:bg-emerald-500/10">
          <CheckCircle className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
          <h2 className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">
            {t("forgotPassword.successTitle")}
          </h2>
          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
            {t("forgotPassword.successDescription", { email })}
          </p>
          <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
            {t("forgotPassword.successHint")}
          </p>
        </div>

        <Link
          href={loginUrl}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-[#009688] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#00897b]"
        >
          <Mail className="h-4 w-4" />
          {t("forgotPassword.goToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="flex justify-end">
        <UILanguageSwitcher />
      </div>

      <div className="space-y-1">
        <h1 className="text-[1.625rem] font-semibold tracking-tight text-[#5e5873] dark:text-slate-100">
          {t("forgotPassword.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("forgotPassword.description")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-3 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="tenant">{t("login.tenantId")}</Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="tenant"
              type="text"
              placeholder={t("login.tenantPlaceholder")}
              value={tenantId}
              onChange={(e) =>
                setTenantId(e.target.value.toLowerCase().trim())
              }
              className="pl-10"
              required
              disabled={isLoading || isTenantLocked}
              readOnly={isTenantLocked}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t("forgotPassword.emailLabel")}</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder={t("forgotPassword.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="pl-10"
              required
              disabled={isLoading}
            />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("forgotPassword.submitting")}
            </>
          ) : (
            t("forgotPassword.submit")
          )}
        </Button>
      </form>

      <div className="border-t border-[#ebe9f1] pt-3 text-center dark:border-white/10">
        <Link
          href={loginUrl}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-[#009688] hover:underline dark:text-[#4dd0c8]"
        >
          <ArrowLeft className="h-3 w-3" />
          {t("forgotPassword.backToLogin")}
        </Link>
      </div>
    </div>
  );
}
