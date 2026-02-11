"use client";

import { useEffect, useState, useCallback } from "react";
import { Tag, Plus, X, ChevronDown } from "lucide-react";
import {
  TAG_PREFIXES,
  TAG_PREFIX_LABELS,
  type TagPrefix,
} from "@/lib/constants/customer-tag";

interface TagRef {
  tag_id: string;
  full_tag: string;
  prefix: string;
  code: string;
}

interface TagDefinition {
  tag_id: string;
  prefix: string;
  code: string;
  full_tag: string;
  description: string;
  color?: string;
}

interface CustomerTagsCardProps {
  customerId: string;
}

export function CustomerTagsCard({ customerId }: CustomerTagsCardProps) {
  const [customerTags, setCustomerTags] = useState<TagRef[]>([]);
  const [allTags, setAllTags] = useState<TagDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [assigningPrefix, setAssigningPrefix] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tagsRes, allTagsRes] = await Promise.all([
        fetch(`/api/b2b/customers/${customerId}/tags`),
        fetch("/api/b2b/customer-tags"),
      ]);

      if (tagsRes.ok) {
        const data = await tagsRes.json();
        setCustomerTags(data.tags || []);
      }
      if (allTagsRes.ok) {
        const data = await allTagsRes.json();
        setAllTags(data.tags || []);
      }
    } catch (err) {
      console.error("Error fetching tags:", err);
    } finally {
      setIsLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function assignTag(fullTag: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/b2b/customers/${customerId}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_tag: fullTag }),
      });
      if (res.ok) {
        const data = await res.json();
        setCustomerTags(data.tags || []);
      }
    } catch (err) {
      console.error("Error assigning tag:", err);
    } finally {
      setSaving(false);
      setAssigningPrefix(null);
    }
  }

  async function removeTag(fullTag: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/b2b/customers/${customerId}/tags`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_tag: fullTag }),
      });
      if (res.ok) {
        const data = await res.json();
        setCustomerTags(data.tags || []);
      }
    } catch (err) {
      console.error("Error removing tag:", err);
    } finally {
      setSaving(false);
    }
  }

  // Get all unique prefixes from available tags
  const availablePrefixes = [...new Set(allTags.map((t) => t.prefix))];

  // For each prefix, find what the customer currently has assigned
  function getAssignedTag(prefix: string): TagRef | undefined {
    return customerTags.find((t) => t.prefix === prefix);
  }

  // For each prefix, get available tag options
  function getTagOptions(prefix: string): TagDefinition[] {
    return allTags.filter((t) => t.prefix === prefix);
  }

  function getPrefixLabel(prefix: string): string {
    return TAG_PREFIX_LABELS[prefix as TagPrefix] || prefix;
  }

  if (isLoading) {
    return (
      <div className="rounded-lg bg-card shadow-sm p-5">
        <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Tag className="h-4 w-4" />
          Customer Tags
        </h2>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-card shadow-sm">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Tag className="h-4 w-4 text-emerald-600" />
          Customer Tags
          {customerTags.length > 0 && (
            <span className="px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-800">
              {customerTags.length}
            </span>
          )}
        </h2>
      </div>

      <div className="divide-y divide-border">
        {availablePrefixes.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">
            No tag categories defined yet.
          </div>
        ) : (
          availablePrefixes.map((prefix) => {
            const assigned = getAssignedTag(prefix);
            const options = getTagOptions(prefix);
            const assignedDef = assigned
              ? allTags.find((t) => t.full_tag === assigned.full_tag)
              : null;

            return (
              <div key={prefix} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      {getPrefixLabel(prefix)}
                    </p>

                    {assigned ? (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: assignedDef?.color || "#94a3b8" }}
                        />
                        <span className="text-sm font-medium text-foreground">
                          {assigned.code}
                        </span>
                        {assignedDef?.description && (
                          <span className="text-xs text-muted-foreground truncate">
                            — {assignedDef.description}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1.5 italic">Not assigned</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 ml-3">
                    {assigned && (
                      <button
                        onClick={() => removeTag(assigned.full_tag)}
                        disabled={saving}
                        className="p-1 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                        title="Remove tag"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* Assign / Change dropdown */}
                    <div className="relative">
                      <button
                        onClick={() =>
                          setAssigningPrefix(assigningPrefix === prefix ? null : prefix)
                        }
                        disabled={saving}
                        className="p-1 rounded text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 transition disabled:opacity-50"
                        title={assigned ? "Change tag" : "Assign tag"}
                      >
                        {assigned ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                      </button>

                      {assigningPrefix === prefix && (
                        <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-border rounded-lg shadow-lg z-20">
                          <div className="p-2 border-b border-border">
                            <p className="text-xs font-medium text-muted-foreground">
                              Select {getPrefixLabel(prefix)}
                            </p>
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {options.map((opt) => (
                              <button
                                key={opt.tag_id}
                                onClick={() => assignTag(opt.full_tag)}
                                disabled={saving}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition flex items-center gap-2 ${
                                  assigned?.full_tag === opt.full_tag ? "bg-emerald-50" : ""
                                }`}
                              >
                                <div
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: opt.color || "#94a3b8" }}
                                />
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{opt.code}</p>
                                  {opt.description && (
                                    <p className="text-xs text-muted-foreground truncate">
                                      {opt.description}
                                    </p>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
