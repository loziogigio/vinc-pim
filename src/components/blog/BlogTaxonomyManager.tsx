"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Loader2, Pencil } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { blogSlugify } from "@/lib/constants/blog";
import { getDefaultLanguage } from "@/config/languages";
import type { BlogTaxonomyItem } from "./types";
import { fetchTaxonomy, createTaxonomy, updateTaxonomy, deleteTaxonomy } from "./blog-api";

export function BlogTaxonomyManager({ kind }: { kind: "categories" | "tags" }) {
  const { t } = useTranslation();
  const idKey = kind === "categories" ? "category_id" : "tag_id";
  const [items, setItems] = useState<BlogTaxonomyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState<BlogTaxonomyItem | "new" | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true); setError(null);
    try { setItems(await fetchTaxonomy(kind)); }
    catch (e) { setError(e instanceof Error ? e.message : t("pages.blog.taxonomy.failedToSave")); }
    finally { setIsLoading(false); }
  }, [kind, t]);
  useEffect(() => { load(); }, [load]);

  const nameStr = (it: BlogTaxonomyItem) =>
    typeof it.name === "string" ? it.name : (it.name[getDefaultLanguage().code] || it.name.en || Object.values(it.name)[0] || it.slug);

  const remove = async (it: BlogTaxonomyItem) => {
    if (!confirm(t("pages.blog.taxonomy.deleteConfirm").replace("{name}", nameStr(it)))) return;
    try { await deleteTaxonomy(kind, (it as any)[idKey]); setSuccess(t("pages.blog.taxonomy.deleted")); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : t("pages.blog.taxonomy.failedToDelete")); }
  };

  const title = kind === "categories" ? t("pages.blog.taxonomy.categoriesTitle") : t("pages.blog.taxonomy.tagsTitle");
  const newLabel = kind === "categories" ? t("pages.blog.taxonomy.newCategory") : t("pages.blog.taxonomy.newTag");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#5e5873]">{title}</h1>
        <Button onClick={() => setEditing("new")} className="inline-flex items-center gap-2 bg-[#009688] text-white hover:bg-[#00796b]">
          <Plus className="h-4 w-4" /> {newLabel}
        </Button>
      </div>
      {error && <div className="rounded-[0.428rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {success && <div className="rounded-[0.428rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-600">{success}</div>}

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#009688]" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-[0.428rem] border border-dashed border-[#ebe9f1] bg-[#fafafc] px-6 py-12 text-center text-sm text-[#b9b9c3]">{t("pages.blog.taxonomy.empty")}</div>
      ) : (
        <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#fafafc]"><tr>
              <th className="px-4 py-3 text-left font-medium text-[#5e5873]">{t("pages.blog.taxonomy.name")}</th>
              <th className="px-4 py-3 text-left font-medium text-[#5e5873]">{t("pages.blog.taxonomy.slug")}</th>
              <th className="px-4 py-3 text-left font-medium text-[#5e5873]">{t("pages.blog.taxonomy.posts")}</th>
              <th className="px-4 py-3 text-left font-medium text-[#5e5873]">{t("pages.blog.taxonomy.active")}</th>
              <th className="px-4 py-3 text-right font-medium text-[#5e5873]">{t("common.actions")}</th>
            </tr></thead>
            <tbody className="divide-y divide-[#ebe9f1]">
              {items.map((it) => (
                <tr key={(it as any)[idKey]} className="hover:bg-[#fafafc]">
                  <td className="px-4 py-3 font-medium text-[#5e5873]">{nameStr(it)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#b9b9c3]">{it.slug}</td>
                  <td className="px-4 py-3 text-xs text-[#6e6b7b]">{it.post_count}</td>
                  <td className="px-4 py-3 text-xs">{it.is_active ? "✓" : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={() => setEditing(it)} className="rounded-md p-1.5 text-[#b9b9c3] hover:text-[#009688] hover:bg-[#009688]/10"><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => remove(it)} className="rounded-md p-1.5 text-[#b9b9c3] hover:text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <TaxonomyModal
          kind={kind}
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); setSuccess(t("pages.blog.taxonomy.created")); await load(); }}
          onError={setError}
        />
      )}
    </div>
  );
}

function TaxonomyModal({ kind, item, onClose, onSaved, onError }: {
  kind: "categories" | "tags";
  item: BlogTaxonomyItem | null;
  onClose: () => void; onSaved: () => void; onError: (m: string) => void;
}) {
  const { t } = useTranslation();
  const idKey = kind === "categories" ? "category_id" : "tag_id";
  const initialName = item ? (typeof item.name === "string" ? item.name : Object.values(item.name)[0] || "") : "";
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(item?.slug || "");
  const [color, setColor] = useState(item?.color || "");
  const [isActive, setIsActive] = useState(item?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: { [getDefaultLanguage().code]: name.trim() },
        slug: slug.trim() || undefined,
        is_active: isActive,
        ...(kind === "tags" ? { color: color || undefined } : {}),
      };
      if (item) await updateTaxonomy(kind, (item as any)[idKey], body);
      else await createTaxonomy(kind, body);
      onSaved();
    } catch (e) { onError(e instanceof Error ? e.message : t("pages.blog.taxonomy.failedToSave")); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-[#5e5873]">{kind === "categories" ? t("pages.blog.taxonomy.categoriesTitle") : t("pages.blog.taxonomy.tagsTitle")}</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">{t("pages.blog.taxonomy.name")}</label>
            <Input value={name} autoFocus onChange={(e) => { setName(e.target.value); if (!item && !slug) setSlug(blogSlugify(e.target.value)); }} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">{t("pages.blog.taxonomy.slug")}</label>
            <Input value={slug} onChange={(e) => setSlug(blogSlugify(e.target.value))} className="mt-1" />
          </div>
          {kind === "tags" && (
            <div>
              <label className="text-sm font-medium text-slate-700">{t("pages.blog.taxonomy.color")}</label>
              <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#009688" className="mt-1" />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> {t("pages.blog.taxonomy.active")}
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={save} disabled={saving || !name.trim()} className="bg-[#009688] text-white hover:bg-[#00796b]">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t("common.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
