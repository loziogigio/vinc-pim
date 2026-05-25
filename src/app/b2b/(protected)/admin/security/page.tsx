"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck,
  Loader2,
  Save,
  Clock,
  Lock,
  Bell,
  Key,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface SecurityConfig {
  tenant_id: string;
  max_sessions_per_user: number;
  session_timeout_hours: number;
  idle_timeout_hours: number;
  max_login_attempts: number;
  lockout_minutes: number;
  enable_progressive_delay: boolean;
  require_strong_password: boolean;
  password_expiry_days?: number;
  notify_on_new_device: boolean;
  notify_on_suspicious_login: boolean;
  notify_on_password_change: boolean;
  alert_email?: string;
}

export default function SecurityPage() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<SecurityConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/b2b/admin/security");
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (error) {
      console.error("Error loading security config:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    if (!config) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/b2b/admin/security", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: t("pages.admin.security.configSaved") });
        setConfig(data.config);
      } else {
        setMessage({ type: "error", text: data.error || t("pages.admin.security.saveError") });
      }
    } catch (error) {
      console.error("Error saving security config:", error);
      setMessage({ type: "error", text: t("pages.admin.security.saveError") });
    } finally {
      setIsSaving(false);
    }
  };

  const updateConfig = <K extends keyof SecurityConfig>(
    key: K,
    value: SecurityConfig[K]
  ) => {
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-6">
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{t("pages.admin.security.unableToLoad")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("pages.admin.security.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("pages.admin.security.subtitle")}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {t("common.save")}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
              : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        {/* Session Limits */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t("pages.admin.security.sessionLimits")}</h2>
              <p className="text-sm text-muted-foreground">{t("pages.admin.security.sessionLimitsDesc")}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t("pages.admin.security.maxSessionsPerUser")}
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={config.max_sessions_per_user}
                onChange={(e) =>
                  updateConfig("max_sessions_per_user", parseInt(e.target.value) || 5)
                }
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("pages.admin.security.maxSessionsPerUserDesc")}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t("pages.admin.security.sessionTimeoutHours")}
              </label>
              <input
                type="number"
                min={1}
                max={720}
                value={config.session_timeout_hours}
                onChange={(e) =>
                  updateConfig("session_timeout_hours", parseInt(e.target.value) || 24)
                }
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("pages.admin.security.sessionTimeoutDesc")}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t("pages.admin.security.idleTimeoutHours")}
              </label>
              <input
                type="number"
                min={1}
                max={config.session_timeout_hours || 720}
                value={config.idle_timeout_hours}
                onChange={(e) =>
                  updateConfig("idle_timeout_hours", parseInt(e.target.value) || 8)
                }
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("pages.admin.security.idleTimeoutDesc")}
              </p>
            </div>
          </div>
        </div>

        {/* Login Protection */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center">
              <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t("pages.admin.security.loginProtection")}</h2>
              <p className="text-sm text-muted-foreground">{t("pages.admin.security.loginProtectionDesc")}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t("pages.admin.security.maxLoginAttempts")}
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={config.max_login_attempts}
                onChange={(e) =>
                  updateConfig("max_login_attempts", parseInt(e.target.value) || 5)
                }
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("pages.admin.security.maxLoginAttemptsDesc")}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t("pages.admin.security.lockoutMinutes")}
              </label>
              <input
                type="number"
                min={1}
                max={1440}
                value={config.lockout_minutes}
                onChange={(e) =>
                  updateConfig("lockout_minutes", parseInt(e.target.value) || 15)
                }
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("pages.admin.security.lockoutMinutesDesc")}
              </p>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.enable_progressive_delay}
              onChange={(e) =>
                updateConfig("enable_progressive_delay", e.target.checked)
              }
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <div>
              <span className="text-sm font-medium text-foreground">
                {t("pages.admin.security.progressiveDelay")}
              </span>
              <p className="text-xs text-muted-foreground">
                {t("pages.admin.security.progressiveDelayDesc")}
              </p>
            </div>
          </label>
        </div>

        {/* Password Policy */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center">
              <Key className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t("pages.admin.security.passwordPolicy")}</h2>
              <p className="text-sm text-muted-foreground">{t("pages.admin.security.passwordPolicyDesc")}</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.require_strong_password}
                onChange={(e) =>
                  updateConfig("require_strong_password", e.target.checked)
                }
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <div>
                <span className="text-sm font-medium text-foreground">
                  {t("pages.admin.security.requireStrongPassword")}
                </span>
                <p className="text-xs text-muted-foreground">
                  {t("pages.admin.security.requireStrongPasswordDesc")}
                </p>
              </div>
            </label>

            <div className="max-w-xs">
              <label className="block text-sm font-medium text-foreground mb-1">
                {t("pages.admin.security.passwordExpiryDays")}
              </label>
              <input
                type="number"
                min={0}
                max={365}
                value={config.password_expiry_days || ""}
                placeholder={t("pages.admin.security.passwordExpiryPlaceholder")}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value) : undefined;
                  updateConfig("password_expiry_days", val);
                }}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("pages.admin.security.passwordExpiryDesc")}
              </p>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center">
              <Bell className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t("pages.admin.security.notifications")}</h2>
              <p className="text-sm text-muted-foreground">{t("pages.admin.security.notificationsDesc")}</p>
            </div>
          </div>

          <div className="space-y-4 mb-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.notify_on_new_device}
                onChange={(e) =>
                  updateConfig("notify_on_new_device", e.target.checked)
                }
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <div>
                <span className="text-sm font-medium text-foreground">
                  {t("pages.admin.security.newDevice")}
                </span>
                <p className="text-xs text-muted-foreground">
                  {t("pages.admin.security.newDeviceDesc")}
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.notify_on_suspicious_login}
                onChange={(e) =>
                  updateConfig("notify_on_suspicious_login", e.target.checked)
                }
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <div>
                <span className="text-sm font-medium text-foreground">
                  {t("pages.admin.security.suspiciousLogin")}
                </span>
                <p className="text-xs text-muted-foreground">
                  {t("pages.admin.security.suspiciousLoginDesc")}
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.notify_on_password_change}
                onChange={(e) =>
                  updateConfig("notify_on_password_change", e.target.checked)
                }
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <div>
                <span className="text-sm font-medium text-foreground">
                  {t("pages.admin.security.passwordChange")}
                </span>
                <p className="text-xs text-muted-foreground">
                  {t("pages.admin.security.passwordChangeDesc")}
                </p>
              </div>
            </label>
          </div>

          <div className="max-w-md">
            <label className="block text-sm font-medium text-foreground mb-1">
              {t("pages.admin.security.alertEmail")}
            </label>
            <input
              type="email"
              value={config.alert_email || ""}
              placeholder="admin@example.com"
              onChange={(e) => updateConfig("alert_email", e.target.value || undefined)}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t("pages.admin.security.alertEmailDesc")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
