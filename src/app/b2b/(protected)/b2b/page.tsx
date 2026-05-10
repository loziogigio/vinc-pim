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
import type { B2BPortalStatus } from "@/lib/types/b2b-portal";

interface PortalDomain {
  domain: string;
  is_primary?: boolean;
}

/**
 * Focused list-view shape of an IB2BPortal — only the summary fields the
 * portals table needs. The full portal document (branding, header, footer,
 * etc.) lives in @/lib/types/b2b-portal.
 */
interface Portal {
  _id: string;
  name: string;
  slug: string;
  channel?: string;
  domains: PortalDomain[];
  status: B2BPortalStatus;
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
            className="rounded-lg border border-[#ebe9f1] px-2 py-2 text-sm text-[#5e5873] focus:border-[#009688] focus:outline-none bg-gray-50"
          >
            <option value="https">https://</option>
            <option value="http">http://</option>
          </select>
          <input
            type="text"
            value={d.host}
            onChange={(e) => update(i, "host", e.target.value)}
            placeholder="www.example.com"
            className="flex-1 rounded-lg border border-[#ebe9f1] px-3 py-2 text-sm focus:border-[#009688] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="rounded-md p-1.5 text-[#b9b9c3] hover:text-red-500 hover:bg-red-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#009688] hover:text-[#00796b]"
      >
        <Plus className="h-3.5 w-3.5" />
        {t("pages.b2bPortal.list.addDomain")}
      </button>
    </div>
  );
}

export default function B2BPortalsPage() {
  const { t } = useTranslation();
  const pathname = usePathname() || "";
  const tenantPrefix =
    pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [portals, setPortals] = useState<Portal[]>([]);
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
  // When create/PATCH/DELETE fails because the tenant is not migrated, we show
  // a dedicated hint (run the migration script) instead of a generic error.
  const [notMigrated, setNotMigrated] = useState(false);

  const fetchPortals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (search) params.set("search", search);

      const res = await fetch(`/api/b2b/b2b/portals?${params}`);
      const data = await res.json();
      setPortals(data.items || []);
      setPagination(data.pagination || null);
    } catch (err) {
      console.error("Failed to fetch portals:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchPortals();
  }, [fetchPortals]);

  function resetCreateForm() {
    setShowCreate(false);
    setNewName("");
    setNewSlug("");
    setNewChannel("default");
    setNewDomains([]);
    setSlugTouched(false);
    setError("");
    setNotMigrated(false);
  }

  async function handleCreate() {
    if (!newName.trim() || !newSlug.trim()) {
      setError(t("pages.b2bPortal.list.nameSlugRequired"));
      return;
    }

    setCreating(true);
    setError("");
    setNotMigrated(false);

    try {
      const domains = newDomains
        .map(formatDomain)
        .filter((d) => d.replace(/^https?:\/\//, "").trim() !== "");

      const res = await fetch("/api/b2b/b2b/portals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, slug: newSlug, channel: newChannel, domains }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.code === "NOT_MIGRATED") {
          setNotMigrated(true);
          return;
        }
        setError(data.error || t("pages.b2bPortal.list.failedToCreate"));
        return;
      }

      resetCreateForm();
      fetchPortals();
    } catch {
      setError(t("pages.b2bPortal.list.networkError"));
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(slug: string, name: string) {
    if (!confirm(t("pages.b2bPortal.list.deleteConfirm").replace("{name}", name))) {
      return;
    }

    try {
      const res = await fetch(`/api/b2b/b2b/portals/${slug}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchPortals();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.code === "NOT_MIGRATED") {
        setNotMigrated(true);
      }
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#5e5873]">{t("pages.b2bPortal.list.title")}</h1>
          <p className="text-sm text-[#b9b9c3]">{t("pages.b2bPortal.list.subtitle")}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#009688] px-4 py-2 text-sm font-medium text-white hover:bg-[#00796b] transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t("pages.b2bPortal.list.newPortal")}
        </button>
      </div>

      {/* Not-migrated hint */}
      {notMigrated && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-medium text-amber-800">{t("errors.b2bPortal.notMigrated")}</p>
          <p className="mt-1 text-amber-700">{t("pages.b2bPortal.notMigratedHint")}</p>
        </div>
      )}

      {/* Search */}
      {portals.length > 0 && (
        <div className="mb-4">
          <input
            type="text"
            placeholder={t("pages.b2bPortal.list.searchPlaceholder")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full max-w-sm rounded-lg border border-[#ebe9f1] px-4 py-2 text-sm focus:border-[#009688] focus:outline-none"
          />
        </div>
      )}

      {/* Create dialog */}
      {showCreate && (
        <div className="mb-6 rounded-lg border border-[#ebe9f1] bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-[#5e5873] mb-4">
            {t("pages.b2bPortal.list.createTitle")}
          </h3>
          <div className="space-y-3 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-[#5e5873] mb-1">
                {t("pages.b2bPortal.list.nameLabel")}
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
                placeholder="My Portal"
                className="w-full rounded-lg border border-[#ebe9f1] px-3 py-2 text-sm focus:border-[#009688] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5e5873] mb-1">
                {t("pages.b2bPortal.list.slugLabel")}
              </label>
              <input
                type="text"
                value={newSlug}
                onChange={(e) => {
                  setNewSlug(e.target.value);
                  setSlugTouched(true);
                }}
                placeholder="my-portal"
                className="w-full rounded-lg border border-[#ebe9f1] px-3 py-2 text-sm focus:border-[#009688] focus:outline-none"
              />
              <p className="mt-1 text-xs text-[#b9b9c3]">
                {t("pages.b2bPortal.list.slugHelp")}
              </p>
            </div>
            <ChannelSelect
              value={newChannel}
              onChange={setNewChannel}
              label={t("pages.b2bPortal.list.channelLabel")}
              required
              className="!border-[#ebe9f1] !rounded-lg !focus:border-[#009688] !focus:ring-0"
            />
            <div>
              <label className="block text-sm font-medium text-[#5e5873] mb-1">
                {t("pages.b2bPortal.list.domainsLabel")}
              </label>
              <DomainListInput domains={newDomains} onChange={setNewDomains} />
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            {notMigrated && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                <p className="font-medium text-amber-800">{t("errors.b2bPortal.notMigrated")}</p>
                <p className="mt-1 text-amber-700">{t("pages.b2bPortal.notMigratedHint")}</p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-lg bg-[#009688] px-4 py-2 text-sm font-medium text-white hover:bg-[#00796b] disabled:opacity-50"
              >
                {creating ? t("pages.b2bPortal.list.creating") : t("pages.b2bPortal.list.create")}
              </button>
              <button
                onClick={resetCreateForm}
                className="rounded-lg border border-[#ebe9f1] px-4 py-2 text-sm text-[#5e5873] hover:bg-gray-50"
              >
                {t("pages.b2bPortal.list.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#009688] border-t-transparent" />
        </div>
      ) : portals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#ebe9f1] bg-white p-12 text-center">
          <Store className="mx-auto h-12 w-12 text-[#b9b9c3]" />
          <h3 className="mt-4 text-lg font-medium text-[#5e5873]">{t("pages.b2bPortal.list.noPortals")}</h3>
          <p className="mt-2 text-sm text-[#b9b9c3]">
            {t("pages.b2bPortal.list.noPortalsDesc")}
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#009688] px-4 py-2 text-sm font-medium text-white hover:bg-[#00796b] transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t("pages.b2bPortal.list.createPortal")}
          </button>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[
              {
                label: t("pages.b2bPortal.list.totalPortals"),
                count: portals.length,
                icon: Store,
                iconBg: "bg-[#009688]",
              },
              {
                label: t("pages.b2bPortal.list.active"),
                count: portals.filter((p) => p.status === "active").length,
                icon: CheckCircle,
                iconBg: "bg-emerald-500",
              },
              {
                label: t("pages.b2bPortal.list.inactive"),
                count: portals.filter((p) => p.status === "inactive").length,
                icon: PauseCircle,
                iconBg: "bg-slate-400",
              },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-[#ebe9f1] bg-white p-4"
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.iconBg}`}>
                    <card.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#5e5873]">{card.count}</p>
                    <p className="text-sm text-[#b9b9c3]">{card.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {portals.map((p) => (
              <div
                key={p._id}
                className="group relative rounded-xl border border-[#ebe9f1] bg-white transition-shadow hover:shadow-md"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between px-5 pt-5 pb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#009688]/10">
                      <Store className="h-5 w-5 text-[#009688]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-[#5e5873]">
                        {p.name}
                      </h3>
                      <p className="truncate text-xs text-[#b9b9c3]">
                        {p.slug}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        p.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {p.status === "active" ? t("pages.b2bPortal.list.active") : t("pages.b2bPortal.list.inactive")}
                    </span>
                  </div>
                </div>

                {/* Domains & Channel */}
                <div className="px-5 pb-3 space-y-2">
                  {p.channel && (
                    <div className="flex items-center gap-1.5 text-xs text-[#6e6b7b]">
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                        {p.channel}
                      </span>
                    </div>
                  )}
                  {p.domains.length > 0 ? (
                    <div className="flex items-center gap-1.5 text-xs text-[#b9b9c3]">
                      <Globe className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate font-mono">
                        {p.domains.find((d) => d.is_primary)?.domain || p.domains[0]?.domain}
                      </span>
                      {p.domains.length > 1 && (
                        <span className="shrink-0 text-[10px] text-[#b9b9c3]">
                          +{p.domains.length - 1}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-[#b9b9c3]">
                      <Globe className="h-3.5 w-3.5" />
                      <span>{t("pages.b2bPortal.list.noDomains")}</span>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-[#ebe9f1]" />

                {/* Quick Actions */}
                <div className="grid grid-cols-4 divide-x divide-[#ebe9f1]">
                  <Link
                    href={`${tenantPrefix}/b2b/b2b-home-builder?portal=${p.slug}`}
                    className="flex flex-col items-center gap-1 py-3 text-[#6e6b7b] transition-colors hover:bg-[#009688]/5 hover:text-[#009688]"
                    title={t("pages.b2bPortal.list.homeBuilder")}
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="text-[10px] font-medium">{t("pages.b2bPortal.list.builder")}</span>
                  </Link>
                  <Link
                    href={`${tenantPrefix}/b2b/b2b/portals/${p.slug}/pages`}
                    className="flex flex-col items-center gap-1 py-3 text-[#6e6b7b] transition-colors hover:bg-[#009688]/5 hover:text-[#009688]"
                    title={t("pages.b2bPortal.list.pages")}
                  >
                    <FileText className="h-4 w-4" />
                    <span className="text-[10px] font-medium">{t("pages.b2bPortal.list.pages")}</span>
                  </Link>
                  <Link
                    href={`${tenantPrefix}/b2b/b2b/portals/${p.slug}/forms`}
                    className="flex flex-col items-center gap-1 py-3 text-[#6e6b7b] transition-colors hover:bg-[#009688]/5 hover:text-[#009688]"
                    title={t("pages.b2bPortal.list.forms")}
                  >
                    <Inbox className="h-4 w-4" />
                    <span className="text-[10px] font-medium">{t("pages.b2bPortal.list.forms")}</span>
                  </Link>
                  <Link
                    href={`${tenantPrefix}/b2b/b2b/portals/${p.slug}`}
                    className="flex flex-col items-center gap-1 py-3 text-[#6e6b7b] transition-colors hover:bg-[#009688]/5 hover:text-[#009688]"
                    title={t("pages.b2bPortal.list.settingsAction")}
                  >
                    <Settings className="h-4 w-4" />
                    <span className="text-[10px] font-medium">{t("pages.b2bPortal.list.settingsAction")}</span>
                  </Link>
                </div>

                {/* Delete button (top-right, visible on hover) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(p.slug, p.name);
                  }}
                  className="absolute top-2 right-2 rounded-md p-1.5 text-transparent group-hover:text-[#b9b9c3] hover:!text-red-600 hover:bg-red-50 transition-colors"
                  title={t("pages.b2bPortal.list.deletePortal")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-xs text-[#b9b9c3]">
                {t("pages.b2bPortal.list.portalCount").replace("{count}", String(pagination.total))}
              </p>
              <div className="flex gap-1">
                {Array.from({ length: pagination.totalPages }, (_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setPage(i + 1)}
                    className={`rounded px-2.5 py-1 text-xs ${
                      page === i + 1
                        ? "bg-[#009688] text-white"
                        : "text-[#5e5873] hover:bg-gray-100"
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
