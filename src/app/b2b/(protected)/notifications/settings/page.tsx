"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, MessageSquare, Bell, Smartphone, ExternalLink, Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/components/ui/utils";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { ChannelConfigDrawer } from "@/components/notifications/ChannelConfigDrawer";
import type { ChannelKind, ChannelState } from "@/lib/notifications/channel-status";

interface SettingsResponse {
  channel: string;
  channels: { code: string; name: string; is_default: boolean }[];
  record: { relation_id: string; channel: string; data: Record<string, unknown> } | null;
  status: Record<ChannelKind, { enabled: boolean; state: ChannelState }>;
}

const CARDS: { kind: ChannelKind; icon: React.ElementType; nameKey: string; descKey: string }[] = [
  { kind: "email", icon: Mail, nameKey: "pages.notifications.settings.emailName", descKey: "pages.notifications.settings.emailDesc" },
  { kind: "sms", icon: MessageSquare, nameKey: "pages.notifications.settings.smsName", descKey: "pages.notifications.settings.smsDesc" },
  { kind: "webpush", icon: Bell, nameKey: "pages.notifications.settings.webPushName", descKey: "pages.notifications.settings.webPushDesc" },
  { kind: "fcm", icon: Smartphone, nameKey: "pages.notifications.settings.mobilePushName", descKey: "pages.notifications.settings.mobilePushDesc" },
];

export default function NotificationSettingsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<ChannelKind | null>(null);

  const load = useCallback(async (ch?: string) => {
    setLoading(true);
    try {
      const url = ch ? `/api/b2b/notifications/settings?channel=${encodeURIComponent(ch)}` : "/api/b2b/notifications/settings";
      const res = await fetch(url);
      const json: SettingsResponse = await res.json();
      setData(json);
      setChannel(json.channel);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const statusBadge = (state: ChannelState) => {
    const label = state === "configured" ? t("pages.notifications.settings.statusConfigured")
      : state === "incomplete" ? t("pages.notifications.settings.statusIncomplete")
      : t("pages.notifications.settings.statusOff");
    const cls = state === "configured" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : state === "incomplete" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
      : "bg-muted text-muted-foreground";
    return <span className={cn("text-xs px-2 py-0.5 rounded", cls)}>{label}</span>;
  };

  return (
    <div className="p-6">
      <div className="mb-4">
        <Breadcrumbs items={[
          { label: t("pages.notifications.dashboard.breadcrumb"), href: "/b2b/notifications" },
          { label: t("pages.notifications.settings.breadcrumb") },
        ]} />
      </div>

      <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("pages.notifications.settings.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("pages.notifications.settings.subtitle")}</p>
        </div>
        {data && data.channels.length > 1 && (
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t("pages.notifications.settings.salesChannelLabel")}</label>
            <select className="rounded-md border border-border bg-background p-2 text-sm"
              value={channel ?? ""} onChange={(e) => { setChannel(e.target.value); load(e.target.value); }}>
              {data.channels.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-amber-900 dark:text-amber-300 mb-1">{t("pages.notifications.settings.companyInfoTitle")}</h3>
            <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">{t("pages.notifications.settings.companyInfoDesc")}</p>
            <Link href="/b2b/home-settings">
              <Button variant="outline" size="sm" className="gap-2 bg-white hover:bg-amber-50 dark:bg-transparent dark:hover:bg-amber-950/40">
                <ExternalLink className="w-4 h-4" />{t("pages.notifications.settings.configureHomeSettings")}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> …</div>
      ) : (
        <div className="space-y-4">
          {CARDS.map(({ kind, icon: Icon, nameKey, descKey }) => {
            const st = data?.status[kind]?.state ?? "off";
            return (
              <div key={kind} className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center",
                      st === "configured" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-foreground">{t(nameKey)}</h3>
                        {statusBadge(st)}
                      </div>
                      <p className="text-sm text-muted-foreground">{t(descKey)}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setDrawer(kind)}>
                    <ExternalLink className="w-4 h-4" />{t("pages.notifications.settings.configure")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800 rounded-lg">
        <h3 className="font-medium text-blue-900 dark:text-blue-300 mb-2">{t("pages.notifications.settings.multiChannelTitle")}</h3>
        <p className="text-sm text-blue-700 dark:text-blue-400">{t("pages.notifications.settings.multiChannelDesc")}</p>
      </div>

      {drawer && channel && (
        <ChannelConfigDrawer
          key={drawer}
          kind={drawer}
          channel={channel}
          recordData={data?.record?.data ?? {}}
          relationId={data?.record?.relation_id ?? null}
          open
          onClose={() => setDrawer(null)}
          onSaved={() => { setDrawer(null); load(channel); }}
        />
      )}
    </div>
  );
}
