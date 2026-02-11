"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { CreateTagModal } from "@/components/orders/CreateTagModal";
import { Plus, Tag, Trash2, Users, Search, ChevronRight } from "lucide-react";
import {
  TAG_PREFIXES,
  TAG_PREFIX_LABELS,
  TAG_PREFIX_DESCRIPTIONS,
  type TagPrefix,
} from "@/lib/constants/customer-tag";

interface CustomerTag {
  tag_id: string;
  prefix: string;
  code: string;
  full_tag: string;
  description: string;
  color?: string;
  is_active: boolean;
  customer_count: number;
  created_at: string;
}

export default function CustomerTagsPage() {
  const pathname = usePathname();
  const tenantPrefix =
    pathname?.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [tags, setTags] = useState<CustomerTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchTags();
  }, []);

  async function fetchTags() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/b2b/customer-tags");
      if (res.ok) {
        const data = await res.json();
        setTags(data.tags || []);
      }
    } catch (err) {
      console.error("Error fetching tags:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteTag(e: React.MouseEvent, tag: CustomerTag) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete tag "${tag.full_tag}"? This cannot be undone.`)) return;

    setDeletingTagId(tag.tag_id);
    try {
      const res = await fetch("/api/b2b/customer-tags", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag_id: tag.tag_id }),
      });
      if (res.ok) fetchTags();
    } catch (err) {
      console.error("Error deleting tag:", err);
    } finally {
      setDeletingTagId(null);
    }
  }

  // Filter tags by search
  const filteredTags = useMemo(() => {
    if (!search.trim()) return tags;
    const q = search.toLowerCase();
    return tags.filter(
      (t) =>
        t.code.toLowerCase().includes(q) ||
        t.full_tag.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.prefix.toLowerCase().includes(q)
    );
  }, [tags, search]);

  // Group filtered tags by prefix
  const tagsByPrefix = useMemo(() => {
    const map = new Map<string, CustomerTag[]>();
    for (const tag of filteredTags) {
      const group = map.get(tag.prefix) || [];
      group.push(tag);
      map.set(tag.prefix, group);
    }
    return map;
  }, [filteredTags]);

  // Known prefixes first, then any custom ones
  const allPrefixes = useMemo(() => [
    ...TAG_PREFIXES.filter((p) => tagsByPrefix.has(p)),
    ...[...tagsByPrefix.keys()].filter((p) => !TAG_PREFIXES.includes(p as TagPrefix)),
  ], [tagsByPrefix]);

  return (
    <div className="p-6 space-y-6">
      <Breadcrumbs
        items={[
          { label: "Store", href: "/b2b/store" },
          { label: "Customers", href: "/b2b/store/customers" },
          { label: "Customer Tags" },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Tag className="h-6 w-6 text-emerald-600" />
            Customer Tags
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage tags for customer segmentation, pricing, and promotions
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition"
        >
          <Plus className="h-4 w-4" />
          Create Tag
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-card shadow-sm p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Tags</p>
          <p className="text-2xl font-bold text-foreground mt-1">{tags.length}</p>
        </div>
        <div className="rounded-lg bg-card shadow-sm p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Prefixes</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {new Set(tags.map((t) => t.prefix)).size}
          </p>
        </div>
        <div className="rounded-lg bg-card shadow-sm p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Assignments</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {tags.reduce((sum, t) => sum + t.customer_count, 0)}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search tags by name, code, prefix, or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">Loading tags...</div>
      )}

      {/* Empty */}
      {!isLoading && tags.length === 0 && (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <Tag className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No tags defined yet</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-3 text-sm text-emerald-600 hover:underline"
          >
            Create your first tag
          </button>
        </div>
      )}

      {/* No search results */}
      {!isLoading && tags.length > 0 && filteredTags.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No tags match &quot;{search}&quot;
        </div>
      )}

      {/* Tags grouped by prefix */}
      {!isLoading && allPrefixes.map((prefix) => {
        const groupTags = tagsByPrefix.get(prefix) || [];
        const prefixLabel = TAG_PREFIX_LABELS[prefix as TagPrefix] || prefix;
        const prefixDesc = TAG_PREFIX_DESCRIPTIONS[prefix as TagPrefix];

        return (
          <div key={prefix} className="rounded-lg bg-card shadow-sm">
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold text-foreground">{prefixLabel}</h2>
              {prefixDesc && (
                <p className="text-xs text-muted-foreground mt-0.5">{prefixDesc}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Prefix: <code className="px-1 py-0.5 bg-muted rounded font-mono">{prefix}</code>
                {" "}&middot; {groupTags.length} tag{groupTags.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="divide-y divide-border">
              {groupTags.map((tag) => (
                <Link
                  key={tag.tag_id}
                  href={`${tenantPrefix}/b2b/store/customers/tags/${tag.tag_id}`}
                  className="p-4 flex items-center justify-between hover:bg-muted/30 transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color || "#94a3b8" }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground group-hover:text-emerald-600 transition">
                          {tag.code}
                        </span>
                        <code className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded font-mono">
                          {tag.full_tag}
                        </code>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {tag.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {tag.customer_count}
                    </span>
                    <button
                      onClick={(e) => handleDeleteTag(e, tag)}
                      disabled={deletingTagId === tag.tag_id}
                      className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                      title="Delete tag"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-emerald-600 transition" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}

      {/* Create Tag Modal */}
      <CreateTagModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={fetchTags}
      />
    </div>
  );
}
