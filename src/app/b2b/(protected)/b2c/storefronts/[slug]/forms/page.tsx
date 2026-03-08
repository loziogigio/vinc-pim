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
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";

interface FormSubmission {
  _id: string;
  storefront_slug: string;
  page_slug: string;
  form_block_id: string;
  data: Record<string, unknown>;
  submitter_email?: string;
  seen: boolean;
  created_at: string;
}

export default function FormSubmissionsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

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
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const apiBase = `/api/b2b/b2c/storefronts/${slug}/forms`;

  const fetchSubmissions = async (p: number = page) => {
    try {
      setIsLoading(true);
      const res = await fetch(`${apiBase}?page=${p}&limit=25`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load submissions");
      const json = await res.json();
      setSubmissions(json.data?.items || []);
      setTotalPages(json.data?.pagination?.totalPages || 1);
      setTotal(json.data?.pagination?.total || 0);
      setPage(p);
    } catch (err) {
      setError("Failed to load form submissions");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this submission?")) return;
    try {
      const res = await fetch(`${apiBase}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await fetchSubmissions(page);
    } catch (err) {
      setError("Failed to delete submission");
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
    } catch (err) {
      setError("Failed to update submission");
    }
  };

  const handleView = (sub: FormSubmission) => {
    setSelectedSubmission(sub);
    if (!sub.seen) {
      handleToggleSeen(sub);
    }
  };

  const filteredSubmissions = submissions.filter((sub) => {
    if (
      filterPage &&
      !sub.page_slug.toLowerCase().includes(filterPage.toLowerCase())
    )
      return false;
    if (
      filterEmail &&
      !(sub.submitter_email || "")
        .toLowerCase()
        .includes(filterEmail.toLowerCase())
    )
      return false;
    if (filterSeen === "seen" && !sub.seen) return false;
    if (filterSeen === "unseen" && sub.seen) return false;
    if (filterDateFrom) {
      const from = new Date(filterDateFrom);
      if (new Date(sub.created_at) < from) return false;
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

  return (
    <div className="p-6 space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/b2b/b2c" },
          { label: slug, href: `/b2b/b2c/storefronts/${slug}` },
          { label: "Form Submissions" },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#5e5873]">
            Form Submissions
          </h1>
          <p className="text-sm text-[#b9b9c3]">
            Manage form submissions for {slug} ({total} total)
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
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
              placeholder="Filter by page..."
              className="h-9 w-44 rounded-lg border border-[#ebe9f1] pl-9 pr-3 text-sm focus:border-[#009688] focus:outline-none"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#b9b9c3]" />
            <input
              type="text"
              value={filterEmail}
              onChange={(e) => setFilterEmail(e.target.value)}
              placeholder="Filter by email..."
              className="h-9 w-44 rounded-lg border border-[#ebe9f1] pl-9 pr-3 text-sm focus:border-[#009688] focus:outline-none"
            />
          </div>
          <select
            value={filterSeen}
            onChange={(e) =>
              setFilterSeen(e.target.value as "" | "seen" | "unseen")
            }
            className="h-9 rounded-lg border border-[#ebe9f1] px-3 text-sm text-[#5e5873] focus:border-[#009688] focus:outline-none"
          >
            <option value="">All</option>
            <option value="unseen">Unseen</option>
            <option value="seen">Seen</option>
          </select>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="h-9 rounded-lg border border-[#ebe9f1] px-3 text-sm text-[#5e5873] focus:border-[#009688] focus:outline-none"
            title="From date"
          />
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="h-9 rounded-lg border border-[#ebe9f1] px-3 text-sm text-[#5e5873] focus:border-[#009688] focus:outline-none"
            title="To date"
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
          <p className="text-sm text-[#b9b9c3]">No form submissions yet.</p>
        </div>
      )}

      {/* No results after filter */}
      {!isLoading &&
        submissions.length > 0 &&
        filteredSubmissions.length === 0 && (
          <div className="rounded-[0.428rem] border border-dashed border-[#ebe9f1] bg-[#fafafc] px-6 py-12 text-center">
            <Search className="mx-auto h-10 w-10 text-[#b9b9c3] mb-3" />
            <p className="text-sm text-[#b9b9c3]">
              No submissions match your filters.
            </p>
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
                    Page
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-[#5e5873]">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-[#5e5873]">
                    Submitted
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-[#5e5873]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ebe9f1]">
                {filteredSubmissions.map((sub) => (
                  <tr
                    key={sub._id}
                    className={`hover:bg-[#fafafc] ${!sub.seen ? "bg-blue-50/40" : ""}`}
                  >
                    <td className="px-4 py-3 text-center">
                      {!sub.seen ? (
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full bg-[#009688]"
                          title="Unseen"
                        />
                      ) : null}
                    </td>
                    <td
                      className={`px-4 py-3 text-[#5e5873] ${!sub.seen ? "font-semibold" : "font-medium"}`}
                    >
                      /{sub.page_slug}
                    </td>
                    <td className="px-4 py-3 text-[#b9b9c3]">
                      {sub.submitter_email || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#b9b9c3]">
                      {formatDate(sub.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => handleView(sub)}
                          className="inline-flex items-center gap-1 text-sm text-[#009688] hover:text-[#00796b] transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleSeen(sub)}
                          className="rounded-md p-1.5 text-[#b9b9c3] hover:text-[#5e5873] hover:bg-slate-100 transition-colors"
                          title={sub.seen ? "Mark as unseen" : "Mark as seen"}
                        >
                          {sub.seen ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(sub._id)}
                          className="rounded-md p-1.5 text-[#b9b9c3] hover:text-red-600 hover:bg-red-50 transition-colors"
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-[#b9b9c3]">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => fetchSubmissions(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => fetchSubmissions(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-[#5e5873]">
                  Submission Detail
                </h2>
                <p className="text-sm text-[#b9b9c3]">
                  /{selectedSubmission.page_slug} —{" "}
                  {formatDate(selectedSubmission.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(selectedSubmission.data).map(
                    ([key, value]) => (
                      <tr key={key}>
                        <td className="py-2 pr-4 font-medium text-[#5e5873] capitalize">
                          {key.replace(/_/g, " ")}
                        </td>
                        <td className="py-2 text-[#6e6b7b] whitespace-pre-wrap">
                          {String(value ?? "—")}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
              {selectedSubmission.submitter_email && (
                <p className="mt-4 text-sm text-[#b9b9c3]">
                  Submitter email: {selectedSubmission.submitter_email}
                </p>
              )}
            </div>
            <div className="flex justify-end border-t border-slate-200 px-6 py-4">
              <Button
                variant="ghost"
                onClick={() => setSelectedSubmission(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
