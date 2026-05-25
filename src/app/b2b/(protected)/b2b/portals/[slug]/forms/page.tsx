"use client";

/**
 * B2B Portal forms admin page — /b2b/b2b/portals/[slug]/forms.
 *
 * Forked from src/app/b2b/(protected)/b2c/storefronts/[slug]/forms/page.tsx and
 * re-based onto the Phase-3 /api/b2b/b2b/portals/[slug]/forms* routes (scoped by
 * portal_slug). Two-tab layout: a server-side-paginated Submissions viewer +
 * a Definitions tab that renders the parametrized <FormDefinitionsTab> pointed
 * at the B2B form-definitions routes via its `apiBase` prop.
 *
 * Differences from the B2C source:
 *   - talks to /api/b2b/b2b/portals/[slug]/forms* instead of the B2C storefront routes,
 *   - fetches the portal name (GET /api/b2b/b2b/portals/[slug] — raw IB2BPortal doc)
 *     for the breadcrumb trail,
 *   - surfaces the 409 NOT_MIGRATED write-gate (seen-toggle / delete) as a dedicated
 *     amber banner (cleared on the next write start) instead of a generic error toast.
 */

import { useEffect, useState, use } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Inbox,
  Loader2,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { FormDefinitionsTab } from "@/components/b2c/FormDefinitionsTab";

interface FormSubmission {
  _id: string;
  portal_slug: string;
  page_slug?: string;
  form_block_id?: string;
  form_type?: "page_form" | "standalone";
  form_definition_slug?: string;
  order_id?: string;
  data: Record<string, unknown>;
  submitter_email?: string;
  seen: boolean;
  created_at: string;
}

type ActiveTab = "submissions" | "definitions";

export default function B2BFormsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<ActiveTab>("submissions");
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [portalName, setPortalName] = useState(slug);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // When a write (seen-toggle / delete) fails because the tenant is not migrated,
  // we show a dedicated hint (run the migration script) instead of a generic error.
  const [notMigrated, setNotMigrated] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedSubmission, setSelectedSubmission] =
    useState<FormSubmission | null>(null);

  // Filters
  const [filterPage, setFilterPage] = useState("");
  const [filterEmail, setFilterEmail] = useState("");
  const [filterSeen, setFilterSeen] = useState<"" | "seen" | "unseen">("");
  const [filterType, setFilterType] = useState<"" | "page_form" | "standalone">("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const apiBase = `/api/b2b/b2b/portals/${slug}/forms`;

  const fetchSubmissions = async (p: number = page) => {
    try {
      setIsLoading(true);
      let url = `${apiBase}?page=${p}&limit=25`;
      if (filterType) url += `&form_type=${filterType}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load submissions");
      const json = await res.json();
      setSubmissions(json.data?.items || []);
      setTotalPages(json.data?.pagination?.totalPages || 1);
      setTotal(json.data?.pagination?.total || 0);
      setPage(p);
    } catch (err) {
      setError(t("pages.b2bPortal.formSubmissions.failedToLoad"));
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "submissions") fetchSubmissions(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filterType]);

  useEffect(() => {
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

  const handleDelete = async (id: string) => {
    if (!confirm(t("pages.b2bPortal.formSubmissions.deleteConfirm"))) return;
    setError(null);
    setNotMigrated(false);
    try {
      const res = await fetch(`${apiBase}/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 409 && data.code === "NOT_MIGRATED") {
          setNotMigrated(true);
          return;
        }
        throw new Error(data.error || "Failed to delete");
      }
      await fetchSubmissions(page);
    } catch {
      setError(t("pages.b2bPortal.formSubmissions.failedToDelete"));
    }
  };

  const handleToggleSeen = async (sub: FormSubmission) => {
    setNotMigrated(false);
    try {
      const res = await fetch(`${apiBase}/${sub._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seen: !sub.seen }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 409 && data.code === "NOT_MIGRATED") {
          setNotMigrated(true);
          return;
        }
        throw new Error(data.error || "Failed to update");
      }
      setSubmissions((prev) =>
        prev.map((s) => (s._id === sub._id ? { ...s, seen: !s.seen } : s))
      );
      if (selectedSubmission?._id === sub._id) {
        setSelectedSubmission({ ...sub, seen: !sub.seen });
      }
    } catch {
      setError(t("pages.b2bPortal.formSubmissions.failedToUpdate"));
    }
  };

  const handleView = (sub: FormSubmission) => {
    setSelectedSubmission(sub);
    if (!sub.seen) handleToggleSeen(sub);
  };

  const filteredSubmissions = submissions.filter((sub) => {
    if (filterPage && !(sub.page_slug || "").toLowerCase().includes(filterPage.toLowerCase()))
      return false;
    if (filterEmail && !(sub.submitter_email || "").toLowerCase().includes(filterEmail.toLowerCase()))
      return false;
    if (filterSeen === "seen" && !sub.seen) return false;
    if (filterSeen === "unseen" && sub.seen) return false;
    if (filterDateFrom) {
      if (new Date(sub.created_at) < new Date(filterDateFrom)) return false;
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo);
      to.setHours(23, 59, 59, 999);
      if (new Date(sub.created_at) > to) return false;
    }
    return true;
  });

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const getSourceLabel = (sub: FormSubmission) => {
    if (sub.form_type === "standalone" && sub.form_definition_slug) {
      return sub.form_definition_slug.replace(/_/g, " ");
    }
    return sub.page_slug ? `/${sub.page_slug}` : "—";
  };

  const tabClasses = (tab: ActiveTab) =>
    `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
      activeTab === tab
        ? "border-primary text-primary"
        : "border-transparent text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="p-6 space-y-6">
      <Breadcrumbs
        items={[
          { label: t("nav.b2bPortal.portals"), href: "/b2b/b2b" },
          { label: portalName, href: `/b2b/b2b/portals/${slug}` },
          { label: t("pages.b2bPortal.forms.title") },
        ]}
      />

      {/* Header */}
      <h1 className="text-xl font-semibold text-foreground">
        {t("pages.b2bPortal.forms.title")}
      </h1>

      {/* Not-migrated hint (page-top) */}
      {notMigrated && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-medium text-amber-800">{t("errors.b2bPortal.notMigrated")}</p>
          <p className="mt-1 text-amber-700">{t("pages.b2bPortal.notMigratedHint")}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button type="button" className={tabClasses("submissions")} onClick={() => setActiveTab("submissions")}>
          {t("pages.b2bPortal.forms.tabs.submissions")}
        </button>
        <button type="button" className={tabClasses("definitions")} onClick={() => setActiveTab("definitions")}>
          {t("pages.b2bPortal.forms.tabs.definitions")}
        </button>
      </div>

      {/* ========== SUBMISSIONS TAB ========== */}
      {activeTab === "submissions" && (
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Filters */}
          {!isLoading && submissions.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={filterPage}
                  onChange={(e) => setFilterPage(e.target.value)}
                  placeholder={t("pages.b2bPortal.formSubmissions.filterByPage")}
                  className="h-9 w-44 rounded-lg border border-border pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={filterEmail}
                  onChange={(e) => setFilterEmail(e.target.value)}
                  placeholder={t("pages.b2bPortal.formSubmissions.filterByEmail")}
                  className="h-9 w-44 rounded-lg border border-border pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as "" | "page_form" | "standalone")}
                className="h-9 rounded-lg border border-border px-3 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                <option value="">{t("pages.b2bPortal.formSubmissions.allTypes")}</option>
                <option value="page_form">{t("pages.b2bPortal.formSubmissions.typePageForm")}</option>
                <option value="standalone">{t("pages.b2bPortal.formSubmissions.typeStandalone")}</option>
              </select>
              <select
                value={filterSeen}
                onChange={(e) => setFilterSeen(e.target.value as "" | "seen" | "unseen")}
                className="h-9 rounded-lg border border-border px-3 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                <option value="">{t("common.all")}</option>
                <option value="unseen">{t("pages.b2bPortal.formSubmissions.unseen")}</option>
                <option value="seen">{t("pages.b2bPortal.formSubmissions.seen")}</option>
              </select>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="h-9 rounded-lg border border-border px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                title={t("pages.b2bPortal.formSubmissions.fromDate")}
              />
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="h-9 rounded-lg border border-border px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                title={t("pages.b2bPortal.formSubmissions.toDate")}
              />
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {/* Empty state */}
          {!isLoading && submissions.length === 0 && (
            <div className="rounded-[0.428rem] border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
              <Inbox className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">{t("pages.b2bPortal.formSubmissions.noSubmissions")}</p>
            </div>
          )}

          {/* No filter results */}
          {!isLoading && submissions.length > 0 && filteredSubmissions.length === 0 && (
            <div className="rounded-[0.428rem] border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
              <Search className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">{t("pages.b2bPortal.formSubmissions.noFilterResults")}</p>
            </div>
          )}

          {/* Table */}
          {!isLoading && filteredSubmissions.length > 0 && (
            <>
              <div className="rounded-[0.428rem] border border-border bg-card shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="w-10 px-4 py-3" />
                      <th className="px-4 py-3 text-left font-medium text-foreground">
                        {t("pages.b2bPortal.formSubmissions.colPage")}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-foreground">
                        {t("pages.b2bPortal.formSubmissions.formType")}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-foreground">
                        {t("common.email")}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-foreground">
                        {t("pages.b2bPortal.formSubmissions.colSubmitted")}
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-foreground">
                        {t("common.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredSubmissions.map((sub) => (
                      <tr key={sub._id} className={`hover:bg-muted/30 ${!sub.seen ? "bg-blue-50/40 dark:bg-blue-500/10" : ""}`}>
                        <td className="px-4 py-3 text-center">
                          {!sub.seen && (
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" title={t("pages.b2bPortal.formSubmissions.unseen")} />
                          )}
                        </td>
                        <td className={`px-4 py-3 text-foreground ${!sub.seen ? "font-semibold" : "font-medium"}`}>
                          {getSourceLabel(sub)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            sub.form_type === "standalone"
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                              : "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                          }`}>
                            {sub.form_type === "standalone"
                              ? t("pages.b2bPortal.formSubmissions.typeStandalone")
                              : t("pages.b2bPortal.formSubmissions.typePageForm")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{sub.submitter_email || "—"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(sub.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button type="button" onClick={() => handleView(sub)} className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors">
                              <Eye className="h-3.5 w-3.5" />
                              {t("common.view")}
                            </button>
                            <button type="button" onClick={() => handleToggleSeen(sub)} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title={sub.seen ? t("pages.b2bPortal.formSubmissions.markAsUnseen") : t("pages.b2bPortal.formSubmissions.markAsSeen")}>
                              {sub.seen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                            <button type="button" onClick={() => handleDelete(sub._id)} className="rounded-md p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {t("pages.b2bPortal.formSubmissions.pageOf").replace("{page}", String(page)).replace("{totalPages}", String(totalPages))}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => fetchSubmissions(page - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => fetchSubmissions(page + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ========== DEFINITIONS TAB ========== */}
      {activeTab === "definitions" && (
        <FormDefinitionsTab
          storefrontSlug={slug}
          apiBase={`/api/b2b/b2b/portals/${slug}/form-definitions`}
        />
      )}

      {/* Detail Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-popover shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {t("pages.b2bPortal.formSubmissions.submissionDetail")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {getSourceLabel(selectedSubmission)} — {formatDate(selectedSubmission.created_at)}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedSubmission(null)} className="rounded-full p-2 text-muted-foreground transition hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {Object.entries(selectedSubmission.data).map(([key, value]) => (
                    <tr key={key}>
                      <td className="py-2 pr-4 font-medium text-foreground capitalize">
                        {key.replace(/_/g, " ")}
                      </td>
                      <td className="py-2 text-muted-foreground whitespace-pre-wrap">
                        {typeof value === "object" && value !== null
                          ? JSON.stringify(value, null, 2)
                          : String(value ?? "—")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selectedSubmission.submitter_email && (
                <p className="mt-4 text-sm text-muted-foreground">
                  {t("pages.b2bPortal.formSubmissions.submitterEmail")}: {selectedSubmission.submitter_email}
                </p>
              )}
            </div>
            <div className="flex justify-end border-t border-border px-6 py-4">
              <Button variant="ghost" onClick={() => setSelectedSubmission(null)}>
                {t("common.close")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
