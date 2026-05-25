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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <Button onClick={() => setEditing("new")} className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0">
          <Plus className="h-4 w-4" /> {newLabel}
        </Button>
      </div>
      {error && <div className="rounded-[0.428rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">{error}</div>}
      {success && <div className="rounded-[0.428rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">{success}</div>}

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-[0.428rem] border border-dashed border-border bg-muted/50 px-6 py-12 text-center text-sm text-muted-foreground">{t("pages.blog.taxonomy.empty")}</div>
      ) : (
        <div className="rounded-[0.428rem] border border-border bg-card shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] dark:shadow-none overflow-hidden">
          <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-muted/50"><tr>
              <th className="px-4 py-3 text-left font-medium text-foreground">{t("pages.blog.taxonomy.name")}</th>
              <th className="px-4 py-3 text-left font-medium text-foreground">{t("pages.blog.taxonomy.slug")}</th>
              <th className="px-4 py-3 text-left font-medium text-foreground hidden sm:table-cell">{t("pages.blog.taxonomy.posts")}</th>
              <th className="px-4 py-3 text-left font-medium text-foreground hidden sm:table-cell">{t("pages.blog.taxonomy.active")}</th>
              <th className="px-4 py-3 text-right font-medium text-foreground">{t("common.actions")}</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {items.map((it) => (
                <tr key={(it as any)[idKey]} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium text-foreground">{nameStr(it)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{it.slug}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{it.post_count}</td>
                  <td className="px-4 py-3 text-xs hidden sm:table-cell">{it.is_active ? "✓" : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={() => setEditing(it)} className="rounded-md p-1.5 text-muted-foreground hover:text-primary hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => remove(it)} className="rounded-md p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-foreground">{kind === "categories" ? t("pages.blog.taxonomy.categoriesTitle") : t("pages.blog.taxonomy.tagsTitle")}</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">{t("pages.blog.taxonomy.name")}</label>
            <Input value={name} autoFocus onChange={(e) => { setName(e.target.value); if (!item && !slug) setSlug(blogSlugify(e.target.value)); }} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">{t("pages.blog.taxonomy.slug")}</label>
            <Input value={slug} onChange={(e) => setSlug(blogSlugify(e.target.value))} className="mt-1" />
          </div>
          {kind === "tags" && (
            <div>
              <label className="text-sm font-medium text-foreground">{t("pages.blog.taxonomy.color")}</label>
              <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#009688" className="mt-1" />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> {t("pages.blog.taxonomy.active")}
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={save} disabled={saving || !name.trim()} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t("common.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
