"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Plus, Trash2, Loader2, FileText, Search, Settings2,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { blogSlugify } from "@/lib/constants/blog";
import { isValidLanguageCode, getEnabledLanguages, getDefaultLanguage } from "@/config/languages";
import type { BlogChannelContext, BlogPostListItem, SalesChannelOption, BlogTaxonomyItem } from "./types";
import {
  fetchPosts, createPost, updatePost, deletePost, fetchChannels, fetchTaxonomy,
} from "./blog-api";

const PAGE_LIMIT = 20;

export function BlogListView({ context }: { context: BlogChannelContext }) {
  const { t, locale: uiLocale } = useTranslation();
  const pathname = usePathname() || "";
  const tenantPrefix = pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [items, setItems] = useState<BlogPostListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [filterQ, setFilterQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [channels, setChannels] = useState<SalesChannelOption[]>([]);
  const [categories, setCategories] = useState<BlogTaxonomyItem[]>([]);
  const [tags, setTags] = useState<BlogTaxonomyItem[]>([]);

  // New-post modal
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newChannels, setNewChannels] = useState<string[]>([context.channel]);
  const [newLocale, setNewLocale] = useState(getDefaultLanguage().code);
  const [isCreating, setIsCreating] = useState(false);

  // Settings modal
  const [settingsTarget, setSettingsTarget] = useState<BlogPostListItem | null>(null);

  const contentLocaleLabel = useCallback(
    (code: string) => getEnabledLanguages().find((l) => l.code === code)?.nativeName || code,
    [],
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchPosts({
        channel: context.channel,
        locale: uiLocale,
        status: filterStatus || undefined,
        q: filterQ || undefined,
        page,
        limit: PAGE_LIMIT,
      });
      setItems(res.items);
      setTotal(res.pagination.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("pages.blog.list.failedToLoad"));
    } finally {
      setIsLoading(false);
    }
  }, [context.channel, uiLocale, filterStatus, filterQ, page, t]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetchChannels().then(setChannels).catch(() => {});
    fetchTaxonomy("categories").then(setCategories).catch(() => {});
    fetchTaxonomy("tags").then(setTags).catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setIsCreating(true);
    setError(null);
    try {
      await createPost({
        title: newTitle.trim(),
        slug: newSlug.trim() || undefined,
        channels: newChannels.length ? newChannels : [context.channel],
        default_locale: isValidLanguageCode(newLocale) ? newLocale : getDefaultLanguage().code,
      });
      setShowAdd(false);
      setNewTitle(""); setNewSlug(""); setNewChannels([context.channel]);
      setSuccess(t("pages.blog.list.created"));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("pages.blog.list.failedToCreate"));
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (post: BlogPostListItem) => {
    if (!confirm(t("pages.blog.list.deleteConfirm").replace("{title}", post.title))) return;
    setError(null);
    try {
      await deletePost(post.post_id);
      setSuccess(t("pages.blog.list.deleted"));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("pages.blog.list.failedToDelete"));
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));
  const statusClass = (s: string) =>
    s === "published" ? "bg-emerald-100 text-emerald-700"
      : s === "scheduled" ? "bg-amber-100 text-amber-700"
      : "bg-slate-100 text-slate-500";

  function formatDate(d?: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#5e5873]">{t("pages.blog.list.title")}</h1>
          <p className="text-sm text-[#b9b9c3]">
            {t("pages.blog.list.subtitle").replace("{label}", context.label).replace("{count}", String(total))}
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 bg-[#009688] text-white hover:bg-[#00796b]">
          <Plus className="h-4 w-4" /> {t("pages.blog.list.newPost")}
        </Button>
      </div>

      {error && <div className="rounded-[0.428rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {success && <div className="rounded-[0.428rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-600">{success}</div>}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#b9b9c3]" />
          <input
            value={filterQ}
            onChange={(e) => { setPage(1); setFilterQ(e.target.value); }}
            placeholder={t("pages.blog.list.filterByTitle")}
            className="h-9 w-56 rounded-lg border border-[#ebe9f1] pl-9 pr-3 text-sm focus:border-[#009688] focus:outline-none"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => { setPage(1); setFilterStatus(e.target.value); }}
          className="h-9 rounded-lg border border-[#ebe9f1] px-3 text-sm text-[#5e5873] focus:border-[#009688] focus:outline-none"
        >
          <option value="">{t("pages.blog.list.allStatuses")}</option>
          <option value="draft">{t("pages.blog.status.draft")}</option>
          <option value="scheduled">{t("pages.blog.status.scheduled")}</option>
          <option value="published">{t("pages.blog.status.published")}</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#009688]" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-[0.428rem] border border-dashed border-[#ebe9f1] bg-[#fafafc] px-6 py-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-[#b9b9c3] mb-3" />
          <p className="text-sm text-[#b9b9c3]">{t("pages.blog.list.empty")}</p>
        </div>
      ) : (
        <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#fafafc]">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-[#5e5873]">{t("pages.blog.list.colTitle")}</th>
                <th className="px-4 py-3 text-left font-medium text-[#5e5873]">{t("common.status")}</th>
                <th className="px-4 py-3 text-left font-medium text-[#5e5873]">{t("pages.blog.list.colLocales")}</th>
                <th className="px-4 py-3 text-left font-medium text-[#5e5873]">{t("pages.blog.list.colChannels")}</th>
                <th className="px-4 py-3 text-left font-medium text-[#5e5873]">{t("pages.blog.list.colUpdated")}</th>
                <th className="px-4 py-3 text-right font-medium text-[#5e5873]">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ebe9f1]">
              {items.map((p) => (
                <tr key={p.post_id} className="hover:bg-[#fafafc]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#5e5873]">{p.title || t("pages.blog.list.untitled")}</div>
                    <div className="text-[#b9b9c3] font-mono text-xs">/{p.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(p.status)}`}>
                      {t(`pages.blog.status.${p.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#6e6b7b]">{p.locales.map(contentLocaleLabel).join(", ")}</td>
                  <td className="px-4 py-3 text-xs text-[#6e6b7b]">{p.channels.join(", ")}</td>
                  <td className="px-4 py-3 text-xs text-[#b9b9c3]">{formatDate(p.updated_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`${tenantPrefix}/b2b/blog-builder?post=${p.post_id}&locale=${p.default_locale}&back=${encodeURIComponent(context.basePath)}`}
                        className="inline-flex items-center gap-1 text-sm text-[#009688] hover:text-[#00796b]"
                      >
                        {t("pages.blog.list.editContent")}
                      </Link>
                      <button type="button" onClick={() => setSettingsTarget(p)} title={t("pages.blog.list.settings")}
                        className="rounded-md p-1.5 text-[#b9b9c3] hover:text-[#009688] hover:bg-[#009688]/10">
                        <Settings2 className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => handleDelete(p)} title={t("common.delete")}
                        className="rounded-md p-1.5 text-[#b9b9c3] hover:text-red-600 hover:bg-red-50">
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

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-[#ebe9f1] px-3 py-1 disabled:opacity-40">‹</button>
          <span className="text-[#6e6b7b]">{t("pages.blog.list.pageOf").replace("{page}", String(page)).replace("{totalPages}", String(totalPages))}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-[#ebe9f1] px-3 py-1 disabled:opacity-40">›</button>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-[#5e5873]">{t("pages.blog.list.createTitle")}</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">{t("pages.blog.list.fieldTitle")}</label>
                <Input value={newTitle} autoFocus
                  onChange={(e) => { setNewTitle(e.target.value); if (!newSlug) setNewSlug(blogSlugify(e.target.value)); }}
                  className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">{t("pages.blog.list.fieldSlug")}</label>
                <Input value={newSlug} onChange={(e) => setNewSlug(blogSlugify(e.target.value))} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">{t("pages.blog.list.fieldLocale")}</label>
                <select value={newLocale} onChange={(e) => setNewLocale(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-[#ebe9f1] px-3 text-sm">
                  {getEnabledLanguages().map((l) => <option key={l.code} value={l.code}>{l.nativeName}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">{t("pages.blog.list.fieldChannels")}</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {channels.map((c) => {
                    const on = newChannels.includes(c.code);
                    return (
                      <button key={c.code} type="button"
                        onClick={() => setNewChannels((prev) => on ? prev.filter((x) => x !== c.code) : [...prev, c.code])}
                        className={`rounded-full border px-3 py-1 text-xs ${on ? "border-[#009688] bg-[#009688]/10 text-[#009688]" : "border-[#ebe9f1] text-[#6e6b7b]"}`}>
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowAdd(false)}>{t("common.cancel")}</Button>
              <Button onClick={handleCreate} disabled={isCreating || !newTitle.trim()} className="bg-[#009688] text-white hover:bg-[#00796b]">
                {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t("pages.blog.list.create")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {settingsTarget && (
        <BlogPostSettingsModal
          post={settingsTarget}
          channels={channels}
          categories={categories}
          tags={tags}
          onClose={() => setSettingsTarget(null)}
          onSaved={async () => { setSettingsTarget(null); setSuccess(t("pages.blog.list.updated")); await load(); }}
          onError={setError}
        />
      )}
    </div>
  );
}

function BlogPostSettingsModal({
  post, channels, categories, tags, onClose, onSaved, onError,
}: {
  post: BlogPostListItem;
  channels: SalesChannelOption[];
  categories: BlogTaxonomyItem[];
  tags: BlogTaxonomyItem[];
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const { t } = useTranslation();
  const [slug, setSlug] = useState(post.slug);
  const [sel, setSel] = useState<string[]>(post.channels);
  const [catIds, setCatIds] = useState<string[]>(post.category_ids);
  const [tagIds, setTagIds] = useState<string[]>(post.tag_ids);
  const [coverUrl, setCoverUrl] = useState(post.cover_image?.url || "");
  const [title, setTitle] = useState(post.title);
  const [saving, setSaving] = useState(false);

  const taxName = (it: BlogTaxonomyItem) => typeof it.name === "string" ? it.name : (it.name.en || it.name.it || Object.values(it.name)[0] || it.slug);
  const toggle = (arr: string[], set: (v: string[]) => void, id: string) =>
    set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  const save = async () => {
    setSaving(true);
    try {
      await updatePost(post.post_id, {
        slug,
        channels: sel,
        category_ids: catIds,
        tag_ids: tagIds,
        cover_image: coverUrl ? { url: coverUrl } : undefined,
        translation: { locale: post.locale, title },
      });
      onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : t("pages.blog.list.failedToUpdate"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-[#5e5873]">{t("pages.blog.settings.title")}</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">{t("pages.blog.list.fieldTitle")} ({post.locale})</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">{t("pages.blog.list.fieldSlug")}</label>
            <Input value={slug} onChange={(e) => setSlug(blogSlugify(e.target.value))} className="mt-1" />
          </div>
          <TaxPicker label={t("pages.blog.list.fieldChannels")} options={channels.map((c) => ({ id: c.code, name: c.name }))} selected={sel} onToggle={(id) => toggle(sel, setSel, id)} />
          <TaxPicker label={t("nav.blog.categories")} options={categories.map((c) => ({ id: c.category_id!, name: taxName(c) }))} selected={catIds} onToggle={(id) => toggle(catIds, setCatIds, id)} />
          <TaxPicker label={t("nav.blog.tags")} options={tags.map((tg) => ({ id: tg.tag_id!, name: taxName(tg) }))} selected={tagIds} onToggle={(id) => toggle(tagIds, setTagIds, id)} />
          <div>
            <label className="text-sm font-medium text-slate-700">{t("pages.blog.settings.coverImageUrl")}</label>
            <Input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://…" className="mt-1" />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={save} disabled={saving} className="bg-[#009688] text-white hover:bg-[#00796b]">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t("common.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TaxPicker({ label, options, selected, onToggle }: {
  label: string; options: { id: string; name: string }[]; selected: string[]; onToggle: (id: string) => void;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="mt-1 flex flex-wrap gap-2">
        {options.length === 0 ? <span className="text-xs text-[#b9b9c3]">—</span> : options.map((o) => {
          const on = selected.includes(o.id);
          return (
            <button key={o.id} type="button" onClick={() => onToggle(o.id)}
              className={`rounded-full border px-3 py-1 text-xs ${on ? "border-[#009688] bg-[#009688]/10 text-[#009688]" : "border-[#ebe9f1] text-[#6e6b7b]"}`}>
              {o.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
