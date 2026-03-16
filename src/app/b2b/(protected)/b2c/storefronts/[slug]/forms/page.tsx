"use client";

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
  storefront_slug: string;
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

export default function FormsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<ActiveTab>("submissions");
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  const apiBase = `/api/b2b/b2c/storefronts/${slug}/forms`;

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
      setError(t("pages.b2c.formSubmissions.failedToLoad"));
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "submissions") fetchSubmissions(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filterType]);

  const handleDelete = async (id: string) => {
    if (!confirm(t("pages.b2c.formSubmissions.deleteConfirm"))) return;
    try {
      const res = await fetch(`${apiBase}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await fetchSubmissions(page);
    } catch {
      setError(t("pages.b2c.formSubmissions.failedToDelete"));
    }
  };

  const handleToggleSeen = async (sub: FormSubmission) => {
    try {
      const res = await fetch(`${apiBase}/${sub._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seen: !sub.seen }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setSubmissions((prev) =>
        prev.map((s) => (s._id === sub._id ? { ...s, seen: !s.seen } : s))
      );
      if (selectedSubmission?._id === sub._id) {
        setSelectedSubmission({ ...sub, seen: !sub.seen });
      }
    } catch {
      setError(t("pages.b2c.formSubmissions.failedToUpdate"));
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
        ? "border-[#009688] text-[#009688]"
        : "border-transparent text-[#b9b9c3] hover:text-[#5e5873]"
    }`;

  return (
    <div className="p-6 space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/b2b/b2c" },
          { label: slug, href: `/b2b/b2c/storefronts/${slug}` },
          { label: t("nav.b2c.forms") },
        ]}
      />

      {/* Header */}
      <h1 className="text-xl font-semibold text-[#5e5873]">
        {t("nav.b2c.forms")}
      </h1>

      {/* Tabs */}
      <div className="flex border-b border-[#ebe9f1]">
        <button type="button" className={tabClasses("submissions")} onClick={() => setActiveTab("submissions")}>
          {t("pages.b2c.forms.tabSubmissions")}
        </button>
        <button type="button" className={tabClasses("definitions")} onClick={() => setActiveTab("definitions")}>
          {t("pages.b2c.forms.tabDefinitions")}
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
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#b9b9c3]" />
                <input
                  type="text"
                  value={filterPage}
                  onChange={(e) => setFilterPage(e.target.value)}
                  placeholder={t("pages.b2c.formSubmissions.filterByPage")}
                  className="h-9 w-44 rounded-lg border border-[#ebe9f1] pl-9 pr-3 text-sm focus:border-[#009688] focus:outline-none"
                />
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#b9b9c3]" />
                <input
                  type="text"
                  value={filterEmail}
                  onChange={(e) => setFilterEmail(e.target.value)}
                  placeholder={t("pages.b2c.formSubmissions.filterByEmail")}
                  className="h-9 w-44 rounded-lg border border-[#ebe9f1] pl-9 pr-3 text-sm focus:border-[#009688] focus:outline-none"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as "" | "page_form" | "standalone")}
                className="h-9 rounded-lg border border-[#ebe9f1] px-3 text-sm text-[#5e5873] focus:border-[#009688] focus:outline-none"
              >
                <option value="">{t("pages.b2c.formSubmissions.allTypes")}</option>
                <option value="page_form">{t("pages.b2c.formSubmissions.typePageForm")}</option>
                <option value="standalone">{t("pages.b2c.formSubmissions.typeStandalone")}</option>
              </select>
              <select
                value={filterSeen}
                onChange={(e) => setFilterSeen(e.target.value as "" | "seen" | "unseen")}
                className="h-9 rounded-lg border border-[#ebe9f1] px-3 text-sm text-[#5e5873] focus:border-[#009688] focus:outline-none"
              >
                <option value="">{t("common.all")}</option>
                <option value="unseen">{t("pages.b2c.formSubmissions.unseen")}</option>
                <option value="seen">{t("pages.b2c.formSubmissions.seen")}</option>
              </select>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="h-9 rounded-lg border border-[#ebe9f1] px-3 text-sm text-[#5e5873] focus:border-[#009688] focus:outline-none"
                title={t("pages.b2c.formSubmissions.fromDate")}
              />
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="h-9 rounded-lg border border-[#ebe9f1] px-3 text-sm text-[#5e5873] focus:border-[#009688] focus:outline-none"
                title={t("pages.b2c.formSubmissions.toDate")}
              />
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#009688]" />
            </div>
          )}

          {/* Empty state */}
          {!isLoading && submissions.length === 0 && (
            <div className="rounded-[0.428rem] border border-dashed border-[#ebe9f1] bg-[#fafafc] px-6 py-12 text-center">
              <Inbox className="mx-auto h-10 w-10 text-[#b9b9c3] mb-3" />
              <p className="text-sm text-[#b9b9c3]">{t("pages.b2c.formSubmissions.noSubmissions")}</p>
            </div>
          )}

          {/* No filter results */}
          {!isLoading && submissions.length > 0 && filteredSubmissions.length === 0 && (
            <div className="rounded-[0.428rem] border border-dashed border-[#ebe9f1] bg-[#fafafc] px-6 py-12 text-center">
              <Search className="mx-auto h-10 w-10 text-[#b9b9c3] mb-3" />
              <p className="text-sm text-[#b9b9c3]">{t("pages.b2c.formSubmissions.noFilterResults")}</p>
            </div>
          )}

          {/* Table */}
          {!isLoading && filteredSubmissions.length > 0 && (
            <>
              <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[#fafafc]">
                    <tr>
                      <th className="w-10 px-4 py-3" />
                      <th className="px-4 py-3 text-left font-medium text-[#5e5873]">
                        {t("pages.b2c.formSubmissions.colPage")}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-[#5e5873]">
                        {t("pages.b2c.formSubmissions.formType")}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-[#5e5873]">
                        {t("common.email")}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-[#5e5873]">
                        {t("pages.b2c.formSubmissions.colSubmitted")}
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-[#5e5873]">
                        {t("common.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ebe9f1]">
                    {filteredSubmissions.map((sub) => (
                      <tr key={sub._id} className={`hover:bg-[#fafafc] ${!sub.seen ? "bg-blue-50/40" : ""}`}>
                        <td className="px-4 py-3 text-center">
                          {!sub.seen && (
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#009688]" title={t("pages.b2c.formSubmissions.unseen")} />
                          )}
                        </td>
                        <td className={`px-4 py-3 text-[#5e5873] ${!sub.seen ? "font-semibold" : "font-medium"}`}>
                          {getSourceLabel(sub)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            sub.form_type === "standalone"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-blue-50 text-blue-700"
                          }`}>
                            {sub.form_type === "standalone"
                              ? t("pages.b2c.formSubmissions.typeStandalone")
                              : t("pages.b2c.formSubmissions.typePageForm")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#b9b9c3]">{sub.submitter_email || "—"}</td>
                        <td className="px-4 py-3 text-xs text-[#b9b9c3]">{formatDate(sub.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button type="button" onClick={() => handleView(sub)} className="inline-flex items-center gap-1 text-sm text-[#009688] hover:text-[#00796b] transition-colors">
                              <Eye className="h-3.5 w-3.5" />
                              {t("common.view")}
                            </button>
                            <button type="button" onClick={() => handleToggleSeen(sub)} className="rounded-md p-1.5 text-[#b9b9c3] hover:text-[#5e5873] hover:bg-slate-100 transition-colors" title={sub.seen ? t("pages.b2c.formSubmissions.markAsUnseen") : t("pages.b2c.formSubmissions.markAsSeen")}>
                              {sub.seen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                            <button type="button" onClick={() => handleDelete(sub._id)} className="rounded-md p-1.5 text-[#b9b9c3] hover:text-red-600 hover:bg-red-50 transition-colors">
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
                  <p className="text-sm text-[#b9b9c3]">
                    {t("pages.b2c.formSubmissions.pageOf").replace("{page}", String(page)).replace("{totalPages}", String(totalPages))}
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
        <FormDefinitionsTab storefrontSlug={slug} />
      )}

      {/* Detail Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-[#5e5873]">
                  {t("pages.b2c.formSubmissions.submissionDetail")}
                </h2>
                <p className="text-sm text-[#b9b9c3]">
                  {getSourceLabel(selectedSubmission)} — {formatDate(selectedSubmission.created_at)}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedSubmission(null)} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(selectedSubmission.data).map(([key, value]) => (
                    <tr key={key}>
                      <td className="py-2 pr-4 font-medium text-[#5e5873] capitalize">
                        {key.replace(/_/g, " ")}
                      </td>
                      <td className="py-2 text-[#6e6b7b] whitespace-pre-wrap">
                        {typeof value === "object" && value !== null
                          ? JSON.stringify(value, null, 2)
                          : String(value ?? "—")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selectedSubmission.submitter_email && (
                <p className="mt-4 text-sm text-[#b9b9c3]">
                  {t("pages.b2c.formSubmissions.submitterEmail")}: {selectedSubmission.submitter_email}
                </p>
              )}
            </div>
            <div className="flex justify-end border-t border-slate-200 px-6 py-4">
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
