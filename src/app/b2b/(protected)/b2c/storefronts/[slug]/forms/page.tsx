"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface FormSubmission {
  _id: string;
  storefront_slug: string;
  page_slug: string;
  form_block_id: string;
  data: Record<string, unknown>;
  submitter_email?: string;
  created_at: string;
}

export default function FormSubmissionsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const pathname = usePathname() || "";
  const tenantPrefix =
    pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null);

  const apiBase = `/api/b2b/b2c/storefronts/${slug}/forms`;

  const fetchSubmissions = async (p: number = page) => {
    try {
      setIsLoading(true);
      const res = await fetch(`${apiBase}?page=${p}&limit=25`, { cache: "no-store" });
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

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`${tenantPrefix}/b2b/b2c/storefronts/${slug}`}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-[#6e6b7b] transition hover:bg-[#fafafc]"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-[#5e5873]">
            Form Submissions
          </h1>
          <p className="text-sm text-[#b9b9c3]">
            Storefront: {slug} — {total} submission{total !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
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
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
          <p className="text-sm text-slate-500">No form submissions yet.</p>
        </div>
      )}

      {/* Table */}
      {!isLoading && submissions.length > 0 && (
        <>
          <div className="overflow-hidden rounded-lg border border-[#ebe9f1]">
            <table className="w-full text-sm">
              <thead className="bg-[#fafafc]">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-[#5e5873]">Page</th>
                  <th className="px-4 py-3 text-left font-medium text-[#5e5873]">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-[#5e5873]">Submitted</th>
                  <th className="px-4 py-3 text-right font-medium text-[#5e5873]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ebe9f1]">
                {submissions.map((sub) => (
                  <tr key={sub._id} className="hover:bg-[#fafafc]">
                    <td className="px-4 py-3 text-[#5e5873]">
                      /{sub.page_slug}
                    </td>
                    <td className="px-4 py-3 text-[#b9b9c3]">
                      {sub.submitter_email || "—"}
                    </td>
                    <td className="px-4 py-3 text-[#b9b9c3]">
                      {formatDate(sub.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedSubmission(sub)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-[#ebe9f1] bg-white px-3 py-1.5 text-xs font-medium text-[#5e5873] hover:bg-[#fafafc] transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(sub._id)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
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
                  /{selectedSubmission.page_slug} — {formatDate(selectedSubmission.created_at)}
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
                  {Object.entries(selectedSubmission.data).map(([key, value]) => (
                    <tr key={key}>
                      <td className="py-2 pr-4 font-medium text-[#5e5873] capitalize">
                        {key.replace(/_/g, " ")}
                      </td>
                      <td className="py-2 text-[#6e6b7b] whitespace-pre-wrap">
                        {String(value ?? "—")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selectedSubmission.submitter_email && (
                <p className="mt-4 text-sm text-[#b9b9c3]">
                  Submitter email: {selectedSubmission.submitter_email}
                </p>
              )}
            </div>
            <div className="flex justify-end border-t border-slate-200 px-6 py-4">
              <Button variant="ghost" onClick={() => setSelectedSubmission(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
