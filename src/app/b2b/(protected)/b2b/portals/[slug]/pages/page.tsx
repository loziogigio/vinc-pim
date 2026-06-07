"use client";

/**
 * B2B Portal pages-management admin page — /b2b/b2b/portals/[slug]/pages.
 *
 * Forked from src/app/b2b/(protected)/b2c/storefronts/[slug]/pages/page.tsx and
 * re-based onto the Phase-3 /api/b2b/b2b/portals/[slug]/pages* routes (scoped by
 * portal_slug). Differences from the B2C source:
 *   - talks to /api/b2b/b2b/portals/[slug]/pages instead of the B2C storefront routes,
 *   - fetches the portal name (GET /api/b2b/b2b/portals/[slug] — raw IB2BPortal doc)
 *     for the breadcrumb trail,
 *   - links out to the B2B page builder / home builder,
 *   - surfaces the 409 NOT_MIGRATED write-gate as a dedicated amber banner
 *     (cleared on the next successful write) instead of a generic error toast.
 */

import { useEffect, useState, use, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Plus,
  Trash2,
  Loader2,
  FileText,
  AlertCircle,
  Search,
  Pencil,
  Copy,
  Home,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useLanguageStore } from "@/lib/stores/languageStore";
import { LanguageTabs } from "@/components/common/LanguageTabs";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PageStatus } from "@/lib/db/models/b2b-page";

interface PageItem {
  _id: string;
  slug: string;
  title: string;
  lang: string;
  status: PageStatus;
  show_in_nav: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  template_status?: "draft" | "published";
  last_saved_at?: string | null;
  published_at?: string | null;
  has_unpublished_changes?: boolean;
}

export default function B2BPagesManagementPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { t } = useTranslation();
  const pathname = usePathname() || "";
  const tenantPrefix =
    pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [pages, setPages] = useState<PageItem[]>([]);
  const [portalName, setPortalName] = useState(slug);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // When create/PATCH/DELETE/duplicate fails because the tenant is not migrated,
  // we show a dedicated hint (run the migration script) instead of a generic error.
  const [notMigrated, setNotMigrated] = useState(false);

  // Language store
  const allLanguages = useLanguageStore((s) => s.languages);
  const langsLoading = useLanguageStore((s) => s.isLoading);
  const fetchLanguages = useLanguageStore((s) => s.fetchLanguages);
  const currentLanguage = useLanguageStore((s) => s.currentLanguage);
  const enabledLanguages = useMemo(() => allLanguages.filter((l) => l.isEnabled), [allLanguages]);
  const [filterLang, setFilterLang] = useState<string>("");
  const [newLang, setNewLang] = useState<string>("");

  useEffect(() => {
    if (allLanguages.length === 0 && !langsLoading) fetchLanguages();
  }, [allLanguages.length, langsLoading, fetchLanguages]);

  // The create dialog's language follows the active language tab so the two
  // controls never drift out of sync. On the "All" tab (no filterLang) we fall
  // back to the UI's current language, then the first enabled language.
  const defaultNewLang = () =>
    filterLang || currentLanguage || enabledLanguages[0]?.code || "";

  const openAddDialog = () => {
    setNewLang(defaultNewLang());
    setShowAddDialog(true);
  };

  // Search filters
  const [filterTitle, setFilterTitle] = useState("");
  const [filterSlug, setFilterSlug] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "active" | "inactive">("");

  // Add page dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Rename dialog
  const [renameTarget, setRenameTarget] = useState<PageItem | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [renameSlug, setRenameSlug] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  // Duplicate
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);

  const apiBase = `/api/b2b/b2b/portals/${slug}/pages`;

  const fetchPages = async () => {
    try {
      const res = await fetch(apiBase, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load pages");
      const json = await res.json();
      setPages(json.data?.items || []);
    } catch (err) {
      setError(t("pages.b2bPortal.pagesManagement.failedToLoad"));
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPages();
    // Portal name for breadcrumbs — GET returns the raw IB2BPortal doc (portal.name),
    // NOT a { data } wrapper. Fall back to the slug if the fetch fails.
    fetch(`/api/b2b/b2b/portals/${slug}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.name) setPortalName(data.name);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreatePage = async () => {
    if (!newTitle.trim() || !newSlug.trim()) return;
    setIsCreating(true);
    setError(null);
    setNotMigrated(false);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), slug: newSlug.trim(), lang: newLang }),
      });
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409 && data.code === "NOT_MIGRATED") {
          setNotMigrated(true);
          return;
        }
        throw new Error(data.error || t("pages.b2bPortal.pagesManagement.failedToCreate"));
      }
      setShowAddDialog(false);
      setNewTitle("");
      setNewSlug("");
      setNewLang(currentLanguage || "");
      setSuccess(t("pages.b2bPortal.pagesManagement.pageCreated"));
      await fetchPages();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pages.b2bPortal.pagesManagement.failedToCreate"));
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeletePage = async (pageSlug: string) => {
    if (!confirm(t("pages.b2bPortal.pagesManagement.deleteConfirm").replace("{slug}", pageSlug)))
      return;
    setError(null);
    setNotMigrated(false);
    try {
      const res = await fetch(`${apiBase}/${pageSlug}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409 && data.code === "NOT_MIGRATED") {
          setNotMigrated(true);
          return;
        }
        throw new Error(data.error || t("pages.b2bPortal.pagesManagement.failedToDelete"));
      }
      setSuccess(t("pages.b2bPortal.pagesManagement.pageDeleted"));
      await fetchPages();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pages.b2bPortal.pagesManagement.failedToDelete"));
    }
  };

  const handleRenamePage = async () => {
    if (!renameTarget || !renameTitle.trim() || !renameSlug.trim()) return;
    setIsRenaming(true);
    setError(null);
    setNotMigrated(false);
    try {
      const body: Record<string, string> = { title: renameTitle.trim() };
      if (renameSlug.trim() !== renameTarget.slug) {
        body.slug = renameSlug.trim();
      }
      const res = await fetch(`${apiBase}/${renameTarget.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409 && data.code === "NOT_MIGRATED") {
          setNotMigrated(true);
          return;
        }
        throw new Error(data.error || t("pages.b2bPortal.pagesManagement.failedToUpdate"));
      }
      setRenameTarget(null);
      setRenameTitle("");
      setRenameSlug("");
      setSuccess(t("pages.b2bPortal.pagesManagement.pageUpdated"));
      await fetchPages();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pages.b2bPortal.pagesManagement.failedToUpdate"));
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDuplicatePage = async (pageSlug: string) => {
    setIsDuplicating(pageSlug);
    setError(null);
    setNotMigrated(false);
    try {
      const res = await fetch(`${apiBase}/${pageSlug}/duplicate`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409 && data.code === "NOT_MIGRATED") {
          setNotMigrated(true);
          return;
        }
        throw new Error(data.error || t("pages.b2bPortal.pagesManagement.failedToDuplicate"));
      }
      const data = await res.json();
      setSuccess(t("pages.b2bPortal.pagesManagement.duplicatedAs").replace("{slug}", data.data?.slug || "copy"));
      await fetchPages();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pages.b2bPortal.pagesManagement.failedToDuplicate"));
    } finally {
      setIsDuplicating(null);
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const filteredPages = pages.filter((pg) => {
    if (filterLang && pg.lang !== filterLang) return false;
    if (filterTitle && !pg.title.toLowerCase().includes(filterTitle.toLowerCase())) return false;
    if (filterSlug && !pg.slug.toLowerCase().includes(filterSlug.toLowerCase())) return false;
    if (filterStatus && pg.status !== filterStatus) return false;
    return true;
  });

  function formatDate(dateStr: string | null | undefined) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  return (
    <div className="p-6 space-y-6">
      <Breadcrumbs
        items={[
          { label: t("nav.b2bPortal.portals"), href: "/b2b/b2b" },
          { label: portalName, href: `/b2b/b2b/portals/${slug}` },
          { label: t("pages.b2bPortal.pagesManagement.title") },
        ]}
      />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("pages.b2bPortal.pagesManagement.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("pages.b2bPortal.pagesManagement.subtitle").replace("{slug}", portalName).replace("{count}", String(pages.length))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`${tenantPrefix}/b2b/b2b-home-builder?portal=${slug}`}
            className="inline-flex items-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            <Home className="h-4 w-4" />
            {t("pages.b2bPortal.pagesManagement.homeBuilder")}
          </Link>
          <Button
            onClick={openAddDialog}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {t("pages.b2bPortal.pagesManagement.addPage")}
          </Button>
        </div>
      </div>

      {/* Not-migrated hint (page-top) — hidden while the create dialog is open,
          which renders its own copy of this hint. */}
      {notMigrated && !showAddDialog && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-medium text-amber-800">{t("errors.b2bPortal.notMigrated")}</p>
          <p className="mt-1 text-amber-700">{t("pages.b2bPortal.notMigratedHint")}</p>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="rounded-[0.428rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-[0.428rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-600">
          {success}
        </div>
      )}

      {/* Language tabs */}
      {!isLoading && enabledLanguages.length > 1 && (
        <LanguageTabs
          languages={enabledLanguages}
          active={filterLang}
          onChange={setFilterLang}
          includeAll
          allLabel={t("pages.b2bPortal.pagesManagement.allLanguages")}
          countFor={(code) => pages.filter((p) => p.lang === code).length}
        />
      )}

      {/* Filters */}
      {!isLoading && pages.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={filterTitle}
              onChange={(e) => setFilterTitle(e.target.value)}
              placeholder={t("pages.b2bPortal.pagesManagement.filterByTitle")}
              className="h-9 w-48 rounded-lg border border-border pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={filterSlug}
              onChange={(e) => setFilterSlug(e.target.value)}
              placeholder={t("pages.b2bPortal.pagesManagement.filterBySlug")}
              className="h-9 w-48 rounded-lg border border-border pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as "" | "active" | "inactive")}
            className="h-9 rounded-lg border border-border px-3 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            <option value="">{t("pages.b2bPortal.pagesManagement.allStatuses")}</option>
            <option value="active">{t("common.active")}</option>
            <option value="inactive">{t("common.inactive")}</option>
          </select>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && pages.length === 0 && (
        <div className="rounded-[0.428rem] border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {t("pages.b2bPortal.pagesManagement.noPages")}
          </p>
        </div>
      )}

      {/* No results after filter */}
      {!isLoading && pages.length > 0 && filteredPages.length === 0 && (
        <div className="rounded-[0.428rem] border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
          <Search className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">{t("pages.b2bPortal.pagesManagement.noFilterResults")}</p>
        </div>
      )}

      {/* Pages Table */}
      {!isLoading && filteredPages.length > 0 && (
        <div className="rounded-[0.428rem] border border-border bg-card shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-foreground">{t("pages.b2bPortal.pagesManagement.colTitle")}</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">{t("pages.b2bPortal.pagesManagement.colSlug")}</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">{t("common.status")}</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">{t("pages.b2bPortal.pagesManagement.colContent")}</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">{t("pages.b2bPortal.pagesManagement.colShowInNav")}</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">{t("pages.b2bPortal.pagesManagement.colLastSaved")}</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">{t("pages.b2bPortal.pagesManagement.language")}</th>
                <th className="px-4 py-3 text-right font-medium text-foreground">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ebe9f1]">
              {filteredPages.map((pg) => (
                <tr key={pg._id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {pg.title}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    /{pg.slug}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        pg.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {pg.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          pg.template_status === "published"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {pg.template_status || "draft"}
                      </span>
                      {pg.has_unpublished_changes && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-amber-600" title={t("pages.b2bPortal.pagesManagement.unpublishedChanges")}>
                          <AlertCircle className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${pg.show_in_nav ? "text-emerald-600" : "text-muted-foreground"}`}>
                      {pg.show_in_nav ? t("common.yes") : t("common.no")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(pg.last_saved_at || pg.updated_at)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {(() => {
                      const lang = enabledLanguages.find((l) => l.code === pg.lang);
                      return lang
                        ? <>{lang.flag && <span className="mr-1">{lang.flag}</span>}{lang.nativeName || lang.name}</>
                        : pg.lang;
                    })()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`${tenantPrefix}/b2b/b2b-page-builder?portal=${slug}&page=${pg.slug}`}
                        className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
                      >
                        {t("common.edit")}
                      </Link>
                      <button
                        type="button"
                        onClick={() => { setRenameTarget(pg); setRenameTitle(pg.title); setRenameSlug(pg.slug); }}
                        className="rounded-md p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        title={t("pages.b2bPortal.pagesManagement.rename")}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicatePage(pg.slug)}
                        disabled={isDuplicating === pg.slug}
                        className="rounded-md p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                        title={t("common.duplicate")}
                      >
                        {isDuplicating === pg.slug ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePage(pg.slug)}
                        className="rounded-md p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                        title={t("common.delete")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Page Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-popover p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-foreground">
              {t("pages.b2bPortal.pagesManagement.createNewPage")}
            </h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground/90">
                  {t("pages.b2bPortal.pagesManagement.pageTitle")}
                </label>
                <Input
                  value={newTitle}
                  onChange={(e) => {
                    setNewTitle(e.target.value);
                    if (!newSlug || newSlug === generateSlug(newTitle)) {
                      setNewSlug(generateSlug(e.target.value));
                    }
                  }}
                  placeholder={t("pages.b2bPortal.pagesManagement.pageTitlePlaceholder")}
                  className="mt-1"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground/90">
                  {t("pages.b2bPortal.pagesManagement.urlSlug")}
                </label>
                <Input
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder={t("pages.b2bPortal.pagesManagement.urlSlugPlaceholder")}
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("pages.b2bPortal.pagesManagement.urlPath")}: /{newSlug || "..."}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground/90">
                  {t("pages.b2bPortal.pagesManagement.language")}
                </label>
                <select
                  value={newLang}
                  onChange={(e) => setNewLang(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-sm"
                >
                  {enabledLanguages.map((l) => (
                    <option key={l.code} value={l.code}>{l.nativeName || l.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {notMigrated && (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                <p className="font-medium text-amber-800">{t("errors.b2bPortal.notMigrated")}</p>
                <p className="mt-1 text-amber-700">{t("pages.b2bPortal.notMigratedHint")}</p>
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowAddDialog(false);
                  setNewTitle("");
                  setNewSlug("");
                  setNewLang(currentLanguage || "");
                  setNotMigrated(false);
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleCreatePage}
                disabled={isCreating || !newTitle.trim() || !newSlug.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isCreating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t("pages.b2bPortal.pagesManagement.createPage")}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Rename Dialog */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-popover p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-foreground">
              {t("pages.b2bPortal.pagesManagement.editPage")}
            </h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground/90">
                  {t("pages.b2bPortal.pagesManagement.pageTitle")}
                </label>
                <Input
                  value={renameTitle}
                  onChange={(e) => setRenameTitle(e.target.value)}
                  placeholder={t("pages.b2bPortal.pagesManagement.pageTitle")}
                  className="mt-1"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground/90">
                  {t("pages.b2bPortal.pagesManagement.urlSlug")}
                </label>
                <Input
                  value={renameSlug}
                  onChange={(e) => setRenameSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder={t("pages.b2bPortal.pagesManagement.urlSlugPlaceholder")}
                  className="mt-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenamePage();
                  }}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("pages.b2bPortal.pagesManagement.urlPath")}: /{renameSlug || "..."}
                  {renameSlug !== renameTarget.slug && (
                    <span className="ml-2 text-amber-600">
                      {t("pages.b2bPortal.pagesManagement.slugChangeWarning")}
                    </span>
                  )}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground/90">
                  {t("pages.b2bPortal.pagesManagement.language")}
                </label>
                <Input
                  value={(() => {
                    const lang = enabledLanguages.find((l) => l.code === renameTarget.lang);
                    return lang ? `${lang.flag ? lang.flag + " " : ""}${lang.nativeName || lang.name}` : renameTarget.lang;
                  })()}
                  disabled
                  className="mt-1 cursor-not-allowed opacity-70"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("pages.b2bPortal.pagesManagement.langReadOnly")}
                </p>
              </div>
            </div>
            {notMigrated && (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                <p className="font-medium text-amber-800">{t("errors.b2bPortal.notMigrated")}</p>
                <p className="mt-1 text-amber-700">{t("pages.b2bPortal.notMigratedHint")}</p>
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => { setRenameTarget(null); setRenameTitle(""); setRenameSlug(""); setNotMigrated(false); }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleRenamePage}
                disabled={
                  isRenaming ||
                  !renameTitle.trim() ||
                  !renameSlug.trim() ||
                  (renameTitle.trim() === renameTarget.title && renameSlug.trim() === renameTarget.slug)
                }
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isRenaming ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t("common.save")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
