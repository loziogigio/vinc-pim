"use client";

import { useEffect, useState, useCallback } from "react";
import { Tag, Plus, X, ChevronDown, ArrowRight } from "lucide-react";
import {
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

interface EffectiveTag {
  prefix: string;
  tag: TagRef;
  source: "customer" | "address_override";
}

interface AddressTagOverridesProps {
  customerId: string;
  addressId: string;
}

export function AddressTagOverrides({ customerId, addressId }: AddressTagOverridesProps) {
  const [customerTags, setCustomerTags] = useState<TagRef[]>([]);
  const [addressOverrides, setAddressOverrides] = useState<TagRef[]>([]);
  const [effectiveTags, setEffectiveTags] = useState<EffectiveTag[]>([]);
  const [allTags, setAllTags] = useState<TagDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [assigningPrefix, setAssigningPrefix] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [addrTagsRes, allTagsRes] = await Promise.all([
        fetch(`/api/b2b/customers/${customerId}/addresses/${addressId}/tags`),
        fetch("/api/b2b/customer-tags"),
      ]);

      if (addrTagsRes.ok) {
        const data = await addrTagsRes.json();
        setCustomerTags(data.customer_tags || []);
        setAddressOverrides(data.address_overrides || []);
        setEffectiveTags(data.effective_tags_detailed || []);
      }
      if (allTagsRes.ok) {
        const data = await allTagsRes.json();
        setAllTags(data.tags || []);
      }
    } catch (err) {
      console.error("Error fetching address tags:", err);
    } finally {
      setIsLoading(false);
    }
  }, [customerId, addressId]);

  useEffect(() => {
    if (expanded) fetchData();
  }, [expanded, fetchData]);

  async function overrideTag(fullTag: string) {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/b2b/customers/${customerId}/addresses/${addressId}/tags`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ full_tag: fullTag }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setAddressOverrides(data.address_overrides || []);
        setEffectiveTags(data.effective_tags_detailed || []);
      }
    } catch (err) {
      console.error("Error overriding tag:", err);
    } finally {
      setSaving(false);
      setAssigningPrefix(null);
    }
  }

  async function removeOverride(fullTag: string) {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/b2b/customers/${customerId}/addresses/${addressId}/tags`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ full_tag: fullTag }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setAddressOverrides(data.address_overrides || []);
        setEffectiveTags(data.effective_tags_detailed || []);
      }
    } catch (err) {
      console.error("Error removing override:", err);
    } finally {
      setSaving(false);
    }
  }

  function getPrefixLabel(prefix: string): string {
    return TAG_PREFIX_LABELS[prefix as TagPrefix] || prefix;
  }

  function getTagDef(fullTag: string): TagDefinition | undefined {
    return allTags.find((t) => t.full_tag === fullTag);
  }

  function getTagOptions(prefix: string): TagDefinition[] {
    return allTags.filter((t) => t.prefix === prefix);
  }

  const overrideCount = addressOverrides.length;

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
      >
        <Tag className="h-3 w-3" />
        <span>Tag Overrides</span>
        {overrideCount > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-medium">
            {overrideCount}
          </span>
        )}
        <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="mt-2 pl-4 border-l-2 border-border space-y-2">
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Loading...</p>
          ) : effectiveTags.length === 0 && allTags.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No tag categories defined</p>
          ) : (
            <>
              {/* Show effective tags grouped by prefix */}
              {[...new Set(allTags.map((t) => t.prefix))].map((prefix) => {
                const effective = effectiveTags.find((e) => e.prefix === prefix);
                const override = addressOverrides.find((o) => o.prefix === prefix);
                const customerTag = customerTags.find((t) => t.prefix === prefix);
                const tagDef = effective ? getTagDef(effective.tag.full_tag) : null;
                const isOverridden = effective?.source === "address_override";

                return (
                  <div key={prefix} className="flex items-center justify-between gap-2 py-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        {getPrefixLabel(prefix)}
                      </p>
                      {effective ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: tagDef?.color || "#94a3b8" }}
                          />
                          <span className="text-xs font-medium text-foreground">
                            {effective.tag.code}
                          </span>
                          {isOverridden ? (
                            <span className="text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-700">
                              override
                            </span>
                          ) : (
                            <span className="text-[10px] px-1 py-0.5 rounded bg-slate-100 text-slate-500">
                              inherited
                            </span>
                          )}
                          {isOverridden && customerTag && (
                            <span className="text-[10px] text-muted-foreground">
                              <ArrowRight className="h-2.5 w-2.5 inline" /> was: {customerTag.code}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground italic mt-0.5">
                          Not assigned
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-0.5">
                      {override && (
                        <button
                          onClick={() => removeOverride(override.full_tag)}
                          disabled={saving}
                          className="p-0.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                          title="Remove override (revert to customer default)"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}

                      <div className="relative">
                        <button
                          onClick={() =>
                            setAssigningPrefix(assigningPrefix === prefix ? null : prefix)
                          }
                          disabled={saving}
                          className="p-0.5 rounded text-muted-foreground hover:text-amber-600 hover:bg-amber-50 transition disabled:opacity-50"
                          title="Override tag for this address"
                        >
                          {override ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <Plus className="h-3 w-3" />
                          )}
                        </button>

                        {assigningPrefix === prefix && (
                          <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-border rounded-lg shadow-lg z-30">
                            <div className="p-2 border-b border-border">
                              <p className="text-[10px] font-medium text-muted-foreground">
                                Override: {getPrefixLabel(prefix)}
                              </p>
                            </div>
                            <div className="max-h-36 overflow-y-auto">
                              {getTagOptions(prefix).map((opt) => (
                                <button
                                  key={opt.tag_id}
                                  onClick={() => overrideTag(opt.full_tag)}
                                  disabled={saving}
                                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition flex items-center gap-2 ${
                                    override?.full_tag === opt.full_tag ? "bg-amber-50" : ""
                                  }`}
                                >
                                  <div
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: opt.color || "#94a3b8" }}
                                  />
                                  <div className="min-w-0">
                                    <p className="font-medium truncate">{opt.code}</p>
                                    {opt.description && (
                                      <p className="text-[10px] text-muted-foreground truncate">
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
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
