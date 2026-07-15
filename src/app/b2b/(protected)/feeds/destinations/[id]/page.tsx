"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { DestinationForm } from "@/components/feeds/DestinationForm";
import { useTranslation } from "@/lib/i18n/useTranslation";

export default function EditDestinationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const [dest, setDest] = useState<Record<string, unknown> | null>(null);
  const [tenantId, setTenantId] = useState<string>("");
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/b2b/feeds/destinations/${id}`);
    const json = await res.json();
    setDest(json.data ?? null);
    // Server-authoritative tenant id (top-level sibling of data in the GET
    // response). In-app navigation lands on UN-prefixed paths (/b2b/...), so
    // deriving the tenant from the pathname fails there — see feedUrl below.
    setTenantId(json.tenant_id ?? "");
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const syncNow = async () => {
    const res = await fetch(`/api/b2b/feeds/destinations/${id}/sync`, { method: "POST" });
    if (res.ok) setNotice(t("pages.feeds.syncQueued"));
  };

  const regenerate = async () => {
    await fetch(`/api/b2b/feeds/destinations/${id}/regenerate-token`, { method: "POST" });
    await load();
  };

  const remove = async () => {
    if (!confirm(t("pages.feeds.confirmDelete"))) return;
    await fetch(`/api/b2b/feeds/destinations/${id}`, { method: "DELETE" });
    router.push("/b2b/feeds");
  };

  if (!dest) return <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>;

  const isTrovaprezzi = dest.type === "trovaprezzi";
  // Prefer the server-authoritative tenant id from the GET response; fall
  // back to the tenant-prefixed URL shape (/{tenant}/b2b/...) only if state
  // is empty. The "/b2b/" guard (rather than a bare split("/")[1]) prevents
  // misreading "b2b" as the tenant on un-prefixed paths — mirrors
  // Breadcrumbs.getTenantPrefix and the payments gateway page's regex.
  const pathTenant = pathname?.match(/^\/([^/]+)\/b2b\//)?.[1] ?? "";
  const effectiveTenantId = tenantId || pathTenant;
  const feedUrl =
    isTrovaprezzi && dest.feed_token
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/public/feeds/${String(dest.destination_id)}?tenant=${effectiveTenantId}&token=${String(dest.feed_token)}`
      : null;

  return (
    <div className="p-6">
      <Breadcrumbs
        items={[
          { label: t("pages.feeds.title"), href: "/b2b/feeds" },
          { label: String(dest.name) },
        ]}
      />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">{String(dest.name)}</h1>
        <div className="flex gap-2">
          <Link href={`/b2b/feeds/destinations/${id}/runs`}>
            <Button variant="outline">{t("pages.feeds.runs")}</Button>
          </Link>
          <Button onClick={syncNow}>{t("pages.feeds.syncNow")}</Button>
          <Button variant="outline" onClick={remove}>{t("pages.feeds.delete")}</Button>
        </div>
      </div>

      {notice && <p className="text-sm text-emerald-600 mb-4">{notice}</p>}

      {feedUrl && (
        <div className="mb-6 rounded-md border border-border bg-muted/40 p-3">
          <p className="text-xs font-medium text-foreground mb-1">{t("pages.feeds.feedUrl")}</p>
          <code className="text-xs break-all">{feedUrl}</code>
          <div className="mt-2">
            <Button variant="outline" onClick={regenerate}>{t("pages.feeds.regenerateToken")}</Button>
          </div>
        </div>
      )}

      <DestinationForm destinationId={id} initial={dest as never} />
    </div>
  );
}
