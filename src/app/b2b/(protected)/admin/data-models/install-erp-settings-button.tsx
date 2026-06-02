"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface SalesChannelOption {
  code: string;
  name: string;
  is_default?: boolean;
}

/**
 * One-time bootstrap for the `erp_settings` model. Render only when the model
 * is not yet installed. On success, redirects to the model page; on 409
 * (already installed), calls onInstalled() so the list refreshes.
 *
 * The channel is picked from the tenant's existing SalesChannels (selectable
 * only — never free text), fetched from /api/b2b/channels.
 */
export function InstallErpSettingsButton({
  onInstalled,
}: {
  onInstalled: () => void;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [channels, setChannels] = useState<SalesChannelOption[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channel, setChannel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setChannelsLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch("/api/b2b/channels");
        const json = await res.json();
        if (!res.ok)
          throw new Error(json?.error || t("components.installErpSettings.error"));
        const list = (json.channels ?? []) as SalesChannelOption[];
        setChannels(list);
        const preferred = list.find((c) => c.is_default) ?? list[0];
        setChannel(preferred?.code ?? "");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setChannelsLoading(false);
      }
    })();
  }, [open, t]);

  const install = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/b2b/data-models/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blueprint: "erp_settings", channel }),
      });
      const json = await res.json();
      if (res.status === 409) {
        setOpen(false);
        onInstalled();
        return;
      }
      if (!res.ok)
        throw new Error(json?.error || t("components.installErpSettings.error"));
      setOpen(false);
      router.push("/b2b/admin/data-models/erp_settings");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Download className="mr-1 h-4 w-4" />
        {t("components.installErpSettings.title")}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-base font-semibold text-foreground">
                {t("components.installErpSettings.title")}
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 px-5 py-4">
              <p className="text-sm text-muted-foreground">
                {t("components.installErpSettings.descriptionPrefix")}{" "}
                <span className="font-mono">erp_settings</span>{" "}
                {t("components.installErpSettings.descriptionMiddle")}{" "}
                <span className="font-mono">_global</span>
                {t("components.installErpSettings.descriptionSuffix")}
              </p>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("components.channelSelect.label")}
                </label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  disabled={channelsLoading || channels.length === 0}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                >
                  {channelsLoading && (
                    <option value="">{t("components.channelSelect.loading")}</option>
                  )}
                  {!channelsLoading && channels.length === 0 && (
                    <option value="">{t("components.channelSelect.noChannels")}</option>
                  )}
                  {channels.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="rounded-md border border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 p-2 text-sm text-rose-700 dark:text-rose-400">
                  {error}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                {t("common.cancel")}
              </Button>
              <Button onClick={install} disabled={busy || channelsLoading || !channel}>
                {busy ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />{" "}
                    {t("components.installErpSettings.installing")}
                  </>
                ) : (
                  t("components.installErpSettings.install")
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
