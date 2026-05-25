"use client";

/**
 * CDN credentials section of the global B2B settings page.
 *
 * Lifted from the legacy /b2b/home-settings page (`CDNForm`). The "Test
 * connection" button hits POST /api/b2b/home-settings/test-cdn, which uploads
 * and then deletes a small temp file using the supplied credentials.
 */

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { SectionCard } from "@/components/b2c/storefront-settings/section-card";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { CDNCredentials } from "@/lib/types/home-settings";

export const DEFAULT_CDN_CREDENTIALS: CDNCredentials = {
  cdn_url: "",
  bucket_region: "",
  bucket_name: "",
  folder_name: "",
  cdn_key: "",
  cdn_secret: "",
  signed_url_expiry: 0,
  delete_from_cloud: false,
};

interface CdnSectionProps {
  cdnCredentials: CDNCredentials;
  onChange: <K extends keyof CDNCredentials>(key: K, value: CDNCredentials[K]) => void;
  hasUnsavedChanges?: boolean;
}

export function CdnSection({ cdnCredentials, onChange, hasUnsavedChanges }: CdnSectionProps) {
  const { t } = useTranslation();
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/b2b/home-settings/test-cdn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cdn_url: cdnCredentials.cdn_url,
          bucket_region: cdnCredentials.bucket_region,
          bucket_name: cdnCredentials.bucket_name,
          folder_name: cdnCredentials.folder_name,
          cdn_key: cdnCredentials.cdn_key,
          cdn_secret: cdnCredentials.cdn_secret,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setTestResult({ success: true, message: data.message || t("pages.homeSettings.cdn.testConnection") });
      } else {
        setTestResult({ success: false, message: data.error + (data.details ? `: ${data.details}` : "") });
      }
    } catch {
      setTestResult({ success: false, message: t("pages.b2bSettings.networkError") });
    } finally {
      setIsTesting(false);
    }
  };

  const canTest =
    cdnCredentials.cdn_url &&
    cdnCredentials.bucket_region &&
    cdnCredentials.bucket_name &&
    cdnCredentials.cdn_key &&
    cdnCredentials.cdn_secret;

  return (
    <SectionCard title={t("pages.homeSettings.cdn.title")} description={t("pages.homeSettings.cdn.description")}>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="md:col-span-2 space-y-2">
          <label htmlFor="cdn-url" className="text-sm font-medium text-foreground/80">
            {t("pages.homeSettings.cdn.endpointUrl")}
          </label>
          <input
            id="cdn-url"
            type="text"
            value={cdnCredentials.cdn_url || ""}
            onChange={(e) => onChange("cdn_url", e.target.value)}
            placeholder="https://s3.eu-de.cloud-object-storage.appdomain.cloud"
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-xs text-muted-foreground">{t("pages.homeSettings.cdn.endpointUrlHelper")}</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="bucket-region" className="text-sm font-medium text-foreground/80">
            {t("pages.homeSettings.cdn.bucketRegion")}
          </label>
          <input
            id="bucket-region"
            type="text"
            value={cdnCredentials.bucket_region || ""}
            onChange={(e) => onChange("bucket_region", e.target.value)}
            placeholder="eu-de"
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="bucket-name" className="text-sm font-medium text-foreground/80">
            {t("pages.homeSettings.cdn.bucketName")}
          </label>
          <input
            id="bucket-name"
            type="text"
            value={cdnCredentials.bucket_name || ""}
            onChange={(e) => onChange("bucket_name", e.target.value)}
            placeholder="my-bucket"
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="folder-name" className="text-sm font-medium text-foreground/80">
            {t("pages.homeSettings.cdn.folderName")}
          </label>
          <input
            id="folder-name"
            type="text"
            value={cdnCredentials.folder_name || ""}
            onChange={(e) => onChange("folder_name", e.target.value)}
            placeholder="uploads"
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-xs text-muted-foreground">{t("pages.homeSettings.cdn.folderNameHelper")}</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="cdn-key" className="text-sm font-medium text-foreground/80">
            {t("pages.homeSettings.cdn.accessKeyId")}
          </label>
          <input
            id="cdn-key"
            type="password"
            value={cdnCredentials.cdn_key || ""}
            onChange={(e) => onChange("cdn_key", e.target.value)}
            placeholder="••••••••••••••••"
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="cdn-secret" className="text-sm font-medium text-foreground/80">
            {t("pages.homeSettings.cdn.secretAccessKey")}
          </label>
          <input
            id="cdn-secret"
            type="password"
            value={cdnCredentials.cdn_secret || ""}
            onChange={(e) => onChange("cdn_secret", e.target.value)}
            placeholder="••••••••••••••••••••••••••••••••"
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="border-t border-border pt-6 mt-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">{t("pages.homeSettings.cdn.advancedSettings")}</h3>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="signed-url-expiry" className="text-sm font-medium text-foreground/80">
              {t("pages.homeSettings.cdn.signedUrlExpiry")}
            </label>
            <input
              id="signed-url-expiry"
              type="number"
              min={0}
              value={cdnCredentials.signed_url_expiry || 0}
              onChange={(e) => onChange("signed_url_expiry", Number(e.target.value))}
              placeholder="0"
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-xs text-muted-foreground">{t("pages.homeSettings.cdn.signedUrlExpiryHelper")}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">{t("pages.homeSettings.cdn.deleteFromCloud")}</label>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onChange("delete_from_cloud", !cdnCredentials.delete_from_cloud)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  cdnCredentials.delete_from_cloud ? "bg-primary" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    cdnCredentials.delete_from_cloud ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
              <span className="text-sm text-foreground/80">
                {cdnCredentials.delete_from_cloud ? t("common.enabled") : t("common.disabled")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{t("pages.homeSettings.cdn.deleteFromCloudHelper")}</p>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-6 mt-6">
        {hasUnsavedChanges && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {t("pages.homeSettings.cdn.saveBeforeTesting")}
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t("pages.homeSettings.cdn.testConnection")}</h3>
            <p className="text-xs text-muted-foreground">{t("pages.homeSettings.cdn.testConnectionHelper")}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={!canTest || isTesting}
            className="gap-2"
          >
            {isTesting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("pages.homeSettings.cdn.testing")}
              </>
            ) : (
              t("pages.homeSettings.cdn.testConnection")
            )}
          </Button>
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
            {testResult.success && hasUnsavedChanges && (
              <span className="block mt-1 font-medium">{t("pages.homeSettings.cdn.saveToApply")}</span>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
