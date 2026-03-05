"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  FileText,
  AlertCircle,
} from "lucide-react";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PageItem {
  _id: string;
  slug: string;
  title: string;
  status: "active" | "inactive";
  show_in_nav: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  template_status?: "draft" | "published";
  last_saved_at?: string | null;
  published_at?: string | null;
  has_unpublished_changes?: boolean;
}

export default function PagesManagementPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const pathname = usePathname() || "";
  const tenantPrefix =
    pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [pages, setPages] = useState<PageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Add page dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const apiBase = `/api/b2b/b2c/storefronts/${slug}/pages`;

  const fetchPages = async () => {
    try {
      const res = await fetch(apiBase, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load pages");
      const json = await res.json();
      setPages(json.data?.items || []);
    } catch (err) {
      setError("Failed to load pages");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreatePage = async () => {
    if (!newTitle.trim() || !newSlug.trim()) return;
    setIsCreating(true);
    setError(null);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), slug: newSlug.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create page");
      }
      setShowAddDialog(false);
      setNewTitle("");
      setNewSlug("");
      setSuccess("Page created successfully");
      await fetchPages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create page");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeletePage = async (pageSlug: string) => {
    if (!confirm(`Delete page "${pageSlug}"? This will also delete all form submissions.`))
      return;
    setError(null);
    try {
      const res = await fetch(`${apiBase}/${pageSlug}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete page");
      }
      setSuccess("Page deleted");
      await fetchPages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete page");
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

  function formatDate(dateStr: string | null | undefined) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "B2C", href: "/b2b/b2c" },
          { label: "Storefronts", href: "/b2b/b2c/storefronts" },
          { label: slug, href: `/b2b/b2c/storefronts/${slug}` },
          { label: "Pages" },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#5e5873]">Pages</h1>
          <p className="text-sm text-[#b9b9c3]">Storefront: {slug}</p>
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#009688] px-4 py-2 text-sm font-medium text-white hover:bg-[#00796b]"
        >
          <Plus className="h-4 w-4" />
          Add Page
        </Button>
      </div>

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

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#009688]" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && pages.length === 0 && (
        <div className="rounded-[0.428rem] border border-dashed border-[#ebe9f1] bg-[#fafafc] px-6 py-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-[#b9b9c3] mb-3" />
          <p className="text-sm text-[#b9b9c3]">
            No pages yet. Click &quot;Add Page&quot; to create your first custom page.
          </p>
        </div>
      )}

      {/* Pages Table */}
      {!isLoading && pages.length > 0 && (
        <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#fafafc]">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-[#5e5873]">Title</th>
                <th className="px-4 py-3 text-left font-medium text-[#5e5873]">Slug</th>
                <th className="px-4 py-3 text-left font-medium text-[#5e5873]">Page Status</th>
                <th className="px-4 py-3 text-left font-medium text-[#5e5873]">Content</th>
                <th className="px-4 py-3 text-left font-medium text-[#5e5873]">Nav</th>
                <th className="px-4 py-3 text-left font-medium text-[#5e5873]">Last Saved</th>
                <th className="px-4 py-3 text-right font-medium text-[#5e5873]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ebe9f1]">
              {pages.map((page) => (
                <tr key={page._id} className="hover:bg-[#fafafc]">
                  <td className="px-4 py-3 font-medium text-[#5e5873]">
                    {page.title}
                  </td>
                  <td className="px-4 py-3 text-[#b9b9c3] font-mono text-xs">
                    /{page.slug}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        page.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {page.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            page.template_status === "published"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {page.template_status || "draft"}
                        </span>
                        {page.has_unpublished_changes && (
                          <span className="inline-flex items-center gap-0.5 text-xs text-amber-600" title="Draft has changes not yet published">
                            <AlertCircle className="h-3 w-3" />
                            unsaved
                          </span>
                        )}
                      </div>
                      {page.published_at && (
                        <span className="text-[10px] text-[#b9b9c3]">
                          Published: {formatDate(page.published_at)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#b9b9c3]">
                    {page.show_in_nav ? "Yes" : "No"}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#b9b9c3]">
                    {formatDate(page.last_saved_at || page.updated_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`${tenantPrefix}/b2b/b2c-page-builder?storefront=${slug}&page=${page.slug}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[#ebe9f1] bg-white px-3 py-1.5 text-xs font-medium text-[#5e5873] hover:bg-[#fafafc] transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDeletePage(page.slug)}
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
      )}

      {/* Add Page Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-[#5e5873]">
              Create New Page
            </h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Page Title
                </label>
                <Input
                  value={newTitle}
                  onChange={(e) => {
                    setNewTitle(e.target.value);
                    if (!newSlug || newSlug === generateSlug(newTitle)) {
                      setNewSlug(generateSlug(e.target.value));
                    }
                  }}
                  placeholder="e.g., About Us"
                  className="mt-1"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">
                  URL Slug
                </label>
                <Input
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="e.g., about-us"
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-slate-500">
                  URL path: /{newSlug || "..."}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowAddDialog(false);
                  setNewTitle("");
                  setNewSlug("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreatePage}
                disabled={isCreating || !newTitle.trim() || !newSlug.trim()}
                className="bg-[#009688] text-white hover:bg-[#00796b]"
              >
                {isCreating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Create Page
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
