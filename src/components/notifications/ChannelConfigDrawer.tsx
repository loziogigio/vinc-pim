"use client";

import { useMemo, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/button";
import { channelFieldGroups, type ChannelKind } from "@/lib/notifications/channel-status";
import { SECRET_MASK } from "@/lib/data-models/redact-secrets";
import { mergeSecretOnSave } from "@/components/data-models/secret-utils";
import { useTranslation } from "@/lib/i18n/useTranslation";

const TITLE_KEY: Record<ChannelKind, string> = {
  email: "pages.notifications.settings.emailName",
  sms: "pages.notifications.settings.smsName",
  webpush: "pages.notifications.settings.webPushName",
  fcm: "pages.notifications.settings.mobilePushName",
};

export function ChannelConfigDrawer({
  kind, channel, recordData, relationId, open, onClose, onSaved,
}: {
  kind: ChannelKind;
  channel: string;
  recordData: Record<string, unknown>;
  relationId: string | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const fields = useMemo(() => channelFieldGroups()[kind], [kind]);
  const secretSlugs = useMemo(() => fields.filter((f) => f.type === "secret").map((f) => f.slug), [fields]);

  const [form, setForm] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const f of fields) init[f.slug] = f.type === "secret" ? "" : (recordData[f.slug] ?? (f.type === "checkbox" ? false : ""));
    return init;
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [testTo, setTestTo] = useState("");
  const [showTest, setShowTest] = useState(false);

  const set = (slug: string, v: unknown) => setForm((p) => ({ ...p, [slug]: v }));

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const data = mergeSecretOnSave({ ...recordData, ...form }, recordData, secretSlugs);
      const res = await fetch("/api/b2b/data-models/notification_settings/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relation_id: relationId ?? "_channel", channel, data }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "save failed");
      setMsg(t("pages.notifications.settings.saved"));
      onSaved();
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function sendTest() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/b2b/notifications/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, deliveryChannel: kind, to: testTo }),
      });
      const json = await res.json().catch(() => ({}));
      setMsg(json?.skipped ? t("pages.notifications.settings.testSkipped")
        : json?.ok ? t("pages.notifications.settings.testSent")
        : (json?.error || "test failed"));
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  const destLabel = kind === "email" ? "testDestinationEmail" : kind === "sms" ? "testDestinationSms" : "testDestinationGeneric";

  return (
    <Drawer open={open} title={t(TITLE_KEY[kind])} onClose={onClose}>
      {kind === "webpush" && <p className="mb-3 text-xs text-amber-600">{t("pages.notifications.settings.webPushPartial")}</p>}
      {kind === "sms" && <p className="mb-3 text-xs text-muted-foreground">{t("pages.notifications.settings.smsProviderNote")}</p>}

      <div className="space-y-4">
        {fields.map((f) => {
          const id = `nf-${f.slug}`;
          if (f.type === "checkbox") {
            return (
              <label key={f.slug} htmlFor={id} className="flex items-center gap-2 text-sm">
                <input id={id} type="checkbox" checked={Boolean(form[f.slug])} onChange={(e) => set(f.slug, e.target.checked)} />
                {f.label}
              </label>
            );
          }
          if (f.type === "select") {
            return (
              <div key={f.slug}>
                <label htmlFor={id} className="block text-sm font-medium mb-1">{f.label}</label>
                <select id={id} className="w-full rounded-md border border-border bg-background p-2 text-sm"
                  value={String(form[f.slug] ?? "")} onChange={(e) => set(f.slug, e.target.value)}>
                  <option value="">—</option>
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            );
          }
          const isSecret = f.type === "secret";
          const masked = isSecret && recordData[f.slug] === SECRET_MASK;
          return (
            <div key={f.slug}>
              <label htmlFor={id} className="block text-sm font-medium mb-1">{f.label}</label>
              <input id={id} aria-label={f.label}
                type={isSecret ? "password" : f.type === "number" ? "number" : "text"}
                className="w-full rounded-md border border-border bg-background p-2 text-sm"
                placeholder={masked ? t("pages.notifications.settings.secretConfiguredPlaceholder") : ""}
                value={String(form[f.slug] ?? "")} onChange={(e) => set(f.slug, e.target.value)} />
            </div>
          );
        })}
      </div>

      {msg && <p className="mt-3 text-sm text-muted-foreground">{msg}</p>}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={busy}>{t("pages.notifications.settings.save")}</Button>
        {!showTest ? (
          <Button variant="outline" onClick={() => setShowTest(true)} disabled={busy}>{t("pages.notifications.settings.sendTest")}</Button>
        ) : (
          <div className="flex items-center gap-2">
            <input aria-label={t(`pages.notifications.settings.${destLabel}`)} className="rounded-md border border-border bg-background p-2 text-sm"
              placeholder={t(`pages.notifications.settings.${destLabel}`)} value={testTo} onChange={(e) => setTestTo(e.target.value)} />
            <Button variant="outline" onClick={sendTest} disabled={busy || !testTo}>{t("pages.notifications.settings.sendTest")}</Button>
          </div>
        )}
      </div>
    </Drawer>
  );
}
