"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  Store,
  X,
  Globe,
  FileText,
  Inbox,
  Settings,
  CheckCircle,
  PauseCircle,
} from "lucide-react";
import { ChannelSelect } from "@/components/shared/ChannelSelect";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface StorefrontDomain {
  domain: string;
  is_primary?: boolean;
}

interface Storefront {
  _id: string;
  name: string;
  slug: string;
  channel?: string;
  domains: StorefrontDomain[];
  status: "active" | "inactive";
  created_at: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface DomainEntry {
  protocol: "https" | "http";
  host: string;
}

function parseDomain(raw: string): DomainEntry {
  if (raw.startsWith("https://")) return { protocol: "https", host: raw.slice(8) };
  if (raw.startsWith("http://")) return { protocol: "http", host: raw.slice(7) };
  return { protocol: "https", host: raw };
}

function formatDomain(d: DomainEntry): string {
  return `${d.protocol}://${d.host.trim()}`;
}

// ============================================================
// DomainListInput – reusable domain tag input
// ============================================================

function DomainListInput({
  domains,
  onChange,
}: {
  domains: DomainEntry[];
  onChange: (domains: DomainEntry[]) => void;
}) {
  const { t } = useTranslation();

  function add() {
    onChange([...domains, { protocol: "https", host: "" }]);
  }

  function update(index: number, field: keyof DomainEntry, value: string) {
    const next = domains.map((d, i) =>
      i === index ? { ...d, [field]: value } : d
    );
    onChange(next);
  }

  function remove(index: number) {
    onChange(domains.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      {domains.map((d, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <select
            value={d.protocol}
            onChange={(e) => update(i, "protocol", e.target.value)}
            className="rounded-lg border border-border px-2 py-2 text-sm text-foreground focus:border-primary focus:outline-none bg-muted w-full sm:w-auto"
          >
            <option value="https">https://</option>
            <option value="http">http://</option>
          </select>
          <input
            type="text"
            value={d.host}
            onChange={(e) => update(i, "host", e.target.value)}
            placeholder="www.example.com"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="rounded-md p-1.5 text-muted-foreground hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80"
      >
        <Plus className="h-3.5 w-3.5" />
        {t("pages.b2c.dashboard.addDomain")}
      </button>
    </div>
  );
}

export default function B2CDashboardPage() {
  const { t } = useTranslation();
  const pathname = usePathname() || "";
  const tenantPrefix =
    pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [storefronts, setStorefronts] = useState<Storefront[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  // Create dialog state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newChannel, setNewChannel] = useState("default");
  const [newDomains, setNewDomains] = useState<DomainEntry[]>([]);
  const [slugTouched, setSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const fetchStorefronts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (search) params.set("search", search);

      const res = await fetch(`/api/b2b/b2c/storefronts?${params}`);
      const data = await res.json();
      setStorefronts(data.items || []);
      setPagination(data.pagination || null);
    } catch (err) {
      console.error("Failed to fetch storefronts:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchStorefronts();
  }, [fetchStorefronts]);

  function resetCreateForm() {
    setShowCreate(false);
    setNewName("");
    setNewSlug("");
    setNewChannel("default");
    setNewDomains([]);
    setSlugTouched(false);
    setError("");
  }

  async function handleCreate() {
    if (!newName.trim() || !newSlug.trim()) {
      setError(t("pages.b2c.dashboard.nameSlugRequired"));
      return;
    }

    setCreating(true);
    setError("");

    try {
      const domains = newDomains
        .map(formatDomain)
        .filter((d) => d.replace(/^https?:\/\//, "").trim() !== "");

      const res = await fetch("/api/b2b/b2c/storefronts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, slug: newSlug, channel: newChannel, domains }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("pages.b2c.dashboard.failedToCreate"));
        return;
      }

      resetCreateForm();
      fetchStorefronts();
    } catch {
      setError(t("pages.b2c.dashboard.networkError"));
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(slug: string, name: string) {
    if (!confirm(t("pages.b2c.dashboard.deleteConfirm").replace("{name}", name))) {
      return;
    }

    try {
      const res = await fetch(`/api/b2b/b2c/storefronts/${slug}`, {
        method: "DELETE",
      });
      if (res.ok) fetchStorefronts();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("pages.b2c.dashboard.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("pages.b2c.dashboard.subtitle")}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t("pages.b2c.dashboard.newStorefront")}
        </button>
      </div>

      {/* Search */}
      {storefronts.length > 0 && (
        <div className="mb-4">
          <input
            type="text"
            placeholder={t("pages.b2c.dashboard.searchPlaceholder")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full max-w-sm rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </div>
      )}

      {/* Create dialog */}
      {showCreate && (
        <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
          <h3 className="font-semibold text-foreground mb-4">
            {t("pages.b2c.dashboard.createTitle")}
          </h3>
          <div className="space-y-3 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t("pages.b2c.dashboard.nameLabel")}
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (!slugTouched) {
                    setNewSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-|-$/g, "")
                    );
                  }
                }}
                placeholder="My Shop"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t("pages.b2c.dashboard.slugLabel")}
              </label>
              <input
                type="text"
                value={newSlug}
                onChange={(e) => {
                  setNewSlug(e.target.value);
                  setSlugTouched(true);
                }}
                placeholder="my-shop"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t("pages.b2c.dashboard.slugHelp")}
              </p>
            </div>
            <ChannelSelect
              value={newChannel}
              onChange={setNewChannel}
              label={t("pages.b2c.dashboard.channelLabel")}
              required
              className="!border-border !rounded-lg !focus:border-primary !focus:ring-0"
            />
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t("pages.b2c.dashboard.domainsLabel")}
              </label>
              <DomainListInput domains={newDomains} onChange={setNewDomains} />
            </div>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {creating ? t("pages.b2c.dashboard.creating") : t("pages.b2c.dashboard.create")}
              </button>
              <button
                onClick={resetCreateForm}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
              >
                {t("pages.b2c.dashboard.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : storefronts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <Store className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium text-foreground">{t("pages.b2c.dashboard.noStorefronts")}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("pages.b2c.dashboard.noStorefrontsDesc")}
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t("pages.b2c.dashboard.createStorefront")}
          </button>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[
              {
                label: t("pages.b2c.dashboard.totalStorefronts"),
                count: storefronts.length,
                icon: Store,
                iconBg: "bg-primary",
              },
              {
                label: t("pages.b2c.dashboard.active"),
                count: storefronts.filter((s) => s.status === "active").length,
                icon: CheckCircle,
                iconBg: "bg-emerald-500 dark:bg-emerald-600",
              },
              {
                label: t("pages.b2c.dashboard.inactive"),
                count: storefronts.filter((s) => s.status === "inactive").length,
                icon: PauseCircle,
                iconBg: "bg-muted-foreground/60",
              },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.iconBg}`}>
                    <card.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{card.count}</p>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {storefronts.map((sf) => (
              <div
                key={sf._id}
                className="group relative rounded-xl border border-border bg-card transition-shadow hover:shadow-md"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between px-5 pt-5 pb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Store className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-foreground">
                        {sf.name}
                      </h3>
                      <p className="truncate text-xs text-muted-foreground">
                        {sf.slug}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        sf.status === "active"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {sf.status === "active" ? t("pages.b2c.dashboard.active") : t("pages.b2c.dashboard.inactive")}
                    </span>
                  </div>
                </div>

                {/* Domains & Channel */}
                <div className="px-5 pb-3 space-y-2">
                  {sf.channel && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="rounded bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-400">
                        {sf.channel}
                      </span>
                    </div>
                  )}
                  {sf.domains.length > 0 ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Globe className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate font-mono">
                        {sf.domains.find((d) => d.is_primary)?.domain || sf.domains[0]?.domain}
                      </span>
                      {sf.domains.length > 1 && (
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          +{sf.domains.length - 1}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Globe className="h-3.5 w-3.5" />
                      <span>{t("pages.b2c.dashboard.noDomains")}</span>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-border" />

                {/* Quick Actions */}
                <div className="grid grid-cols-4 divide-x divide-border">
                  <Link
                    href={`${tenantPrefix}/b2b/b2c-home-builder?storefront=${sf.slug}`}
                    className="flex flex-col items-center gap-1 py-3 text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary"
                    title={t("pages.b2c.dashboard.homeBuilder")}
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="text-[10px] font-medium">{t("pages.b2c.dashboard.builder")}</span>
                  </Link>
                  <Link
                    href={`${tenantPrefix}/b2b/b2c/storefronts/${sf.slug}/pages`}
                    className="flex flex-col items-center gap-1 py-3 text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary"
                    title={t("pages.b2c.dashboard.pages")}
                  >
                    <FileText className="h-4 w-4" />
                    <span className="text-[10px] font-medium">{t("pages.b2c.dashboard.pages")}</span>
                  </Link>
                  <Link
                    href={`${tenantPrefix}/b2b/b2c/storefronts/${sf.slug}/forms`}
                    className="flex flex-col items-center gap-1 py-3 text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary"
                    title={t("pages.b2c.dashboard.forms")}
                  >
                    <Inbox className="h-4 w-4" />
                    <span className="text-[10px] font-medium">{t("pages.b2c.dashboard.forms")}</span>
                  </Link>
                  <Link
                    href={`${tenantPrefix}/b2b/b2c/storefronts/${sf.slug}`}
                    className="flex flex-col items-center gap-1 py-3 text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary"
                    title={t("pages.b2c.dashboard.settingsAction")}
                  >
                    <Settings className="h-4 w-4" />
                    <span className="text-[10px] font-medium">{t("pages.b2c.dashboard.settingsAction")}</span>
                  </Link>
                </div>

                {/* Delete button (top-right, visible on hover) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(sf.slug, sf.name);
                  }}
                  className="absolute top-2 right-2 rounded-md p-1.5 text-transparent group-hover:text-muted-foreground hover:!text-red-600 dark:hover:!text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  title={t("pages.b2c.dashboard.deleteStorefront")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {t("pages.b2c.dashboard.storefrontCount").replace("{count}", String(pagination.total))}
              </p>
              <div className="flex gap-1">
                {Array.from({ length: pagination.totalPages }, (_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setPage(i + 1)}
                    className={`rounded px-2.5 py-1 text-xs ${
                      page === i + 1
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
