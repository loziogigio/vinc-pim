"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Pencil, Trash2, Store } from "lucide-react";

interface Storefront {
  _id: string;
  name: string;
  slug: string;
  domains: string[];
  status: "active" | "inactive";
  created_at: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function StorefrontsListPage() {
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
  const [newDomains, setNewDomains] = useState("");
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

  async function handleCreate() {
    if (!newName.trim() || !newSlug.trim()) {
      setError("Name and slug are required");
      return;
    }

    setCreating(true);
    setError("");

    try {
      const domains = newDomains
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);

      const res = await fetch("/api/b2b/b2c/storefronts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, slug: newSlug, domains }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create");
        return;
      }

      setShowCreate(false);
      setNewName("");
      setNewSlug("");
      setNewDomains("");
      fetchStorefronts();
    } catch (err) {
      setError("Network error");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(slug: string, name: string) {
    if (!confirm(`Delete storefront "${name}"? This will also delete all its home template versions.`)) {
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#5e5873]">Storefronts</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#009688] px-4 py-2 text-sm font-medium text-white hover:bg-[#00796b] transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Storefront
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search storefronts..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full max-w-sm rounded-lg border border-[#ebe9f1] px-4 py-2 text-sm focus:border-[#009688] focus:outline-none"
        />
      </div>

      {/* Create dialog */}
      {showCreate && (
        <div className="mb-6 rounded-lg border border-[#ebe9f1] bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-[#5e5873] mb-4">
            Create New Storefront
          </h3>
          <div className="space-y-3 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-[#5e5873] mb-1">
                Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (!newSlug) {
                    setNewSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-|-$/g, "")
                    );
                  }
                }}
                placeholder="My Shop"
                className="w-full rounded-lg border border-[#ebe9f1] px-3 py-2 text-sm focus:border-[#009688] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5e5873] mb-1">
                Slug
              </label>
              <input
                type="text"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="my-shop"
                className="w-full rounded-lg border border-[#ebe9f1] px-3 py-2 text-sm focus:border-[#009688] focus:outline-none"
              />
              <p className="mt-1 text-xs text-[#b9b9c3]">
                Lowercase, alphanumeric with dashes
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5e5873] mb-1">
                Domains (comma-separated)
              </label>
              <input
                type="text"
                value={newDomains}
                onChange={(e) => setNewDomains(e.target.value)}
                placeholder="shop.example.com, www.example.com"
                className="w-full rounded-lg border border-[#ebe9f1] px-3 py-2 text-sm focus:border-[#009688] focus:outline-none"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-lg bg-[#009688] px-4 py-2 text-sm font-medium text-white hover:bg-[#00796b] disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create"}
              </button>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setError("");
                }}
                className="rounded-lg border border-[#ebe9f1] px-4 py-2 text-sm text-[#5e5873] hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#009688] border-t-transparent" />
        </div>
      ) : storefronts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#ebe9f1] bg-white p-12 text-center">
          <Store className="mx-auto h-12 w-12 text-[#b9b9c3]" />
          <p className="mt-2 text-sm text-[#b9b9c3]">No storefronts found</p>
        </div>
      ) : (
        <div className="rounded-lg border border-[#ebe9f1] bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#ebe9f1] bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-[#5e5873]">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-medium text-[#5e5873]">
                  Slug
                </th>
                <th className="px-4 py-3 text-left font-medium text-[#5e5873]">
                  Domains
                </th>
                <th className="px-4 py-3 text-left font-medium text-[#5e5873]">
                  Status
                </th>
                <th className="px-4 py-3 text-right font-medium text-[#5e5873]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {storefronts.map((sf) => (
                <tr
                  key={sf._id}
                  className="border-b border-[#ebe9f1] last:border-0 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium text-[#5e5873]">
                    {sf.name}
                  </td>
                  <td className="px-4 py-3 text-[#b9b9c3]">{sf.slug}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {sf.domains.map((d) => (
                        <span
                          key={d}
                          className="rounded bg-gray-100 px-1.5 py-0.5 text-xs"
                        >
                          {d}
                        </span>
                      ))}
                      {sf.domains.length === 0 && (
                        <span className="text-xs text-[#b9b9c3]">No domains</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        sf.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {sf.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`${tenantPrefix}/b2b/b2c-home-builder?storefront=${sf.slug}`}
                        className="inline-flex items-center gap-1 rounded-md bg-[#009688] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#00796b]"
                      >
                        Builder
                      </Link>
                      <Link
                        href={`${tenantPrefix}/b2b/b2c/storefronts/${sf.slug}`}
                        className="rounded-md p-1 text-[#b9b9c3] hover:text-[#5e5873] hover:bg-gray-100"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(sf.slug, sf.name)}
                        className="rounded-md p-1 text-[#b9b9c3] hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[#ebe9f1] px-4 py-3">
              <p className="text-xs text-[#b9b9c3]">
                {pagination.total} storefront{pagination.total !== 1 ? "s" : ""}
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
        </div>
      )}
    </div>
  );
}
