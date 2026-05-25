"use client";

/**
 * Email transport section (SMTP / Microsoft Graph) of the global B2B settings
 * page. Lifted from the legacy /b2b/home-settings page (`EmailSettingsForm`).
 *
 * The "Send test email" button hits POST /api/b2b/home-settings/test-smtp
 * (verifies the SMTP connection + sends a test mail) or
 * POST /api/b2b/home-settings/test-graph (acquires a Graph token + sends a
 * test mail) depending on the selected transport.
 */

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { SectionCard } from "@/components/b2c/storefront-settings/section-card";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { SMTPSettings, GraphSettings, EmailTransport } from "@/lib/types/home-settings";

export const DEFAULT_SMTP_SETTINGS: SMTPSettings = {
  host: "",
  port: 587,
  secure: false,
  user: "",
  password: "",
  from: "",
  from_name: "",
  default_to: "",
};

export const DEFAULT_GRAPH_SETTINGS: GraphSettings = {
  client_id: "",
  azure_tenant_id: "",
  client_secret: "",
  sender_email: "",
  sender_name: "",
  save_to_sent_items: false,
};

interface EmailSectionProps {
  emailTransport: EmailTransport;
  onTransportChange: (transport: EmailTransport) => void;
  smtpSettings: SMTPSettings;
  onSmtpChange: <K extends keyof SMTPSettings>(key: K, value: SMTPSettings[K]) => void;
  graphSettings: GraphSettings;
  onGraphChange: <K extends keyof GraphSettings>(key: K, value: GraphSettings[K]) => void;
}

const inputClass =
  "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function EmailSection({
  emailTransport,
  onTransportChange,
  smtpSettings,
  onSmtpChange,
  graphSettings,
  onGraphChange,
}: EmailSectionProps) {
  const { t } = useTranslation();
  const [isTesting, setIsTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestSmtp = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/b2b/home-settings/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: smtpSettings.host,
          port: smtpSettings.port,
          secure: smtpSettings.secure,
          user: smtpSettings.user,
          password: smtpSettings.password,
          from: smtpSettings.from,
          from_name: smtpSettings.from_name,
          default_to: testEmail || smtpSettings.default_to,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setTestResult({ success: true, message: data.message || t("pages.homeSettings.email.testConnection") });
      } else {
        setTestResult({ success: false, message: data.error + (data.details ? `: ${data.details}` : "") });
      }
    } catch {
      setTestResult({ success: false, message: t("pages.b2bSettings.networkError") });
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestGraph = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/b2b/home-settings/test-graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: graphSettings.client_id,
          azure_tenant_id: graphSettings.azure_tenant_id,
          client_secret: graphSettings.client_secret,
          sender_email: graphSettings.sender_email,
          sender_name: graphSettings.sender_name,
          test_recipient: testEmail || graphSettings.sender_email,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setTestResult({ success: true, message: data.message || t("pages.homeSettings.email.testConnection") });
      } else {
        setTestResult({ success: false, message: data.error + (data.details ? `: ${data.details}` : "") });
      }
    } catch {
      setTestResult({ success: false, message: t("pages.b2bSettings.networkError") });
    } finally {
      setIsTesting(false);
    }
  };

  const isLocalhost = smtpSettings.host === "localhost" || smtpSettings.host === "127.0.0.1";
  const hasSmtpAuth = smtpSettings.user && smtpSettings.password;
  const canTestSmtp = smtpSettings.host && smtpSettings.port && smtpSettings.from && (hasSmtpAuth || isLocalhost);
  const canTestGraph =
    graphSettings.client_id && graphSettings.azure_tenant_id && graphSettings.client_secret && graphSettings.sender_email;

  const canTest = emailTransport === "smtp" ? canTestSmtp : canTestGraph;
  const handleTest = emailTransport === "smtp" ? handleTestSmtp : handleTestGraph;

  const handleTransportSwitch = (transport: EmailTransport) => {
    setTestResult(null);
    onTransportChange(transport);
  };

  return (
    <SectionCard title={t("pages.homeSettings.email.title")} description={t("pages.homeSettings.email.description")}>
      <div className="mb-6">
        <label className="text-sm font-medium text-foreground/80 mb-3 block">{t("pages.homeSettings.email.transport")}</label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleTransportSwitch("smtp")}
            className={cn(
              "flex-1 rounded-xl border-2 px-4 py-3 text-left transition-all",
              emailTransport === "smtp" ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30"
            )}
          >
            <div className="text-sm font-semibold text-foreground">{t("pages.homeSettings.email.smtp")}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{t("pages.homeSettings.email.smtpDesc")}</div>
          </button>
          <button
            type="button"
            onClick={() => handleTransportSwitch("graph")}
            className={cn(
              "flex-1 rounded-xl border-2 px-4 py-3 text-left transition-all",
              emailTransport === "graph" ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30"
            )}
          >
            <div className="text-sm font-semibold text-foreground">{t("pages.homeSettings.email.graph")}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{t("pages.homeSettings.email.graphDesc")}</div>
          </button>
        </div>
      </div>

      {emailTransport === "smtp" && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="smtp-host" className="text-sm font-medium text-foreground/80">
              {t("pages.homeSettings.email.smtpHost")}
            </label>
            <input
              id="smtp-host"
              type="text"
              value={smtpSettings.host || ""}
              onChange={(e) => onSmtpChange("host", e.target.value)}
              placeholder="smtp.example.com"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="smtp-port" className="text-sm font-medium text-foreground/80">
              {t("pages.homeSettings.email.port")}
            </label>
            <input
              id="smtp-port"
              type="number"
              value={smtpSettings.port || 587}
              onChange={(e) => onSmtpChange("port", Number(e.target.value))}
              placeholder="587"
              className={inputClass}
            />
            <p className="text-xs text-muted-foreground">{t("pages.homeSettings.email.portHelper")}</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="smtp-user" className="text-sm font-medium text-foreground/80">
              {t("pages.homeSettings.email.username")}
            </label>
            <input
              id="smtp-user"
              type="text"
              value={smtpSettings.user || ""}
              onChange={(e) => onSmtpChange("user", e.target.value)}
              placeholder="noreply@example.com"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="smtp-password" className="text-sm font-medium text-foreground/80">
              {t("pages.homeSettings.email.password")}
            </label>
            <input
              id="smtp-password"
              type="password"
              value={smtpSettings.password || ""}
              onChange={(e) => onSmtpChange("password", e.target.value)}
              placeholder="••••••••••••"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="smtp-from" className="text-sm font-medium text-foreground/80">
              {t("pages.homeSettings.email.fromEmail")}
            </label>
            <input
              id="smtp-from"
              type="email"
              value={smtpSettings.from || ""}
              onChange={(e) => onSmtpChange("from", e.target.value)}
              placeholder="noreply@example.com"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="smtp-from-name" className="text-sm font-medium text-foreground/80">
              {t("pages.homeSettings.email.fromName")}
            </label>
            <input
              id="smtp-from-name"
              type="text"
              value={smtpSettings.from_name || ""}
              onChange={(e) => onSmtpChange("from_name", e.target.value)}
              placeholder="My Company"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="smtp-default-to" className="text-sm font-medium text-foreground/80">
              {t("pages.homeSettings.email.defaultRecipient")}
            </label>
            <input
              id="smtp-default-to"
              type="email"
              value={smtpSettings.default_to || ""}
              onChange={(e) => onSmtpChange("default_to", e.target.value)}
              placeholder="info@example.com"
              className={inputClass}
            />
            <p className="text-xs text-muted-foreground">{t("pages.homeSettings.email.defaultRecipientHelper")}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">{t("pages.homeSettings.email.secureTls")}</label>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onSmtpChange("secure", !smtpSettings.secure)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  smtpSettings.secure ? "bg-primary" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    smtpSettings.secure ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
              <span className="text-sm text-foreground/80">
                {smtpSettings.secure
                  ? t("pages.homeSettings.email.secureEnabled")
                  : t("pages.homeSettings.email.secureDisabled")}
              </span>
            </div>
          </div>
        </div>
      )}

      {emailTransport === "graph" && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="graph-client-id" className="text-sm font-medium text-foreground/80">
              {t("pages.homeSettings.email.clientId")}
            </label>
            <input
              id="graph-client-id"
              type="text"
              value={graphSettings.client_id || ""}
              onChange={(e) => onGraphChange("client_id", e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              className={inputClass}
            />
            <p className="text-xs text-muted-foreground">{t("pages.homeSettings.email.clientIdHelper")}</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="graph-tenant-id" className="text-sm font-medium text-foreground/80">
              {t("pages.homeSettings.email.azureTenantId")}
            </label>
            <input
              id="graph-tenant-id"
              type="text"
              value={graphSettings.azure_tenant_id || ""}
              onChange={(e) => onGraphChange("azure_tenant_id", e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              className={inputClass}
            />
            <p className="text-xs text-muted-foreground">{t("pages.homeSettings.email.azureTenantIdHelper")}</p>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="graph-secret" className="text-sm font-medium text-foreground/80">
              {t("pages.homeSettings.email.clientSecret")}
            </label>
            <input
              id="graph-secret"
              type="password"
              value={graphSettings.client_secret || ""}
              onChange={(e) => onGraphChange("client_secret", e.target.value)}
              placeholder="••••••••••••••••••••••••"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="graph-sender" className="text-sm font-medium text-foreground/80">
              {t("pages.homeSettings.email.senderEmail")}
            </label>
            <input
              id="graph-sender"
              type="email"
              value={graphSettings.sender_email || ""}
              onChange={(e) => onGraphChange("sender_email", e.target.value)}
              placeholder="noreply@company.com"
              className={inputClass}
            />
            <p className="text-xs text-muted-foreground">{t("pages.homeSettings.email.senderEmailHelper")}</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="graph-sender-name" className="text-sm font-medium text-foreground/80">
              {t("pages.homeSettings.email.senderName")}
            </label>
            <input
              id="graph-sender-name"
              type="text"
              value={graphSettings.sender_name || ""}
              onChange={(e) => onGraphChange("sender_name", e.target.value)}
              placeholder="My Company"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">{t("pages.homeSettings.email.saveToSent")}</label>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onGraphChange("save_to_sent_items", !graphSettings.save_to_sent_items)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  graphSettings.save_to_sent_items ? "bg-primary" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    graphSettings.save_to_sent_items ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
              <span className="text-sm text-foreground/80">
                {graphSettings.save_to_sent_items ? t("common.enabled") : t("common.disabled")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{t("pages.homeSettings.email.saveToSentHelper")}</p>
          </div>
        </div>
      )}

      <div className="border-t border-border pt-6 mt-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t("pages.homeSettings.email.testConnection")}</h3>
            <p className="text-xs text-muted-foreground">
              {t("pages.homeSettings.email.testConnectionHelper", {
                transport: emailTransport === "smtp" ? "SMTP" : "Graph API",
              })}
            </p>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-2">
              <label htmlFor="test-email" className="text-sm font-medium text-foreground/80">
                {t("pages.homeSettings.email.sendTestTo")}
              </label>
              <input
                id="test-email"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder={
                  emailTransport === "smtp"
                    ? smtpSettings.default_to || smtpSettings.from || "test@example.com"
                    : graphSettings.sender_email || "test@example.com"
                }
                className={inputClass}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={!canTest || isTesting}
              className="gap-2 h-[38px]"
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("pages.homeSettings.email.sending")}
                </>
              ) : (
                t("pages.homeSettings.email.sendTestEmail")
              )}
            </Button>
          </div>
        </div>

        {testResult && (
          <div
            className={cn(
              "mt-4 rounded-lg border px-4 py-3 text-sm",
              testResult.success
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            )}
          >
            {testResult.message}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
