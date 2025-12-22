"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Edit, Trash2, ExternalLink, BookOpen } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useLanguageStore } from "@/lib/stores/languageStore";

type SynonymDictionary = {
  dictionary_id: string;
  key: string;
  description?: string;
  terms: string[];
  locale: string;
  is_active: boolean;
  product_count: number;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export default function SynonymDictionariesPage() {
  // Use language store like product detail page
  const { languages, fetchLanguages, getEnabledLanguages } = useLanguageStore();
  const enabledLanguages = getEnabledLanguages();
  const defaultLanguage = languages.find(lang => lang.isDefault) || languages.find(lang => lang.code === "it");
  const defaultLanguageCode = defaultLanguage?.code || "it";

  const [dictionaries, setDictionaries] = useState<SynonymDictionary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedLocale, setSelectedLocale] = useState("");
  const [filterActive, setFilterActive] = useState<string>("all");
  const [sortBy, setSortBy] = useState("display_order");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [showModal, setShowModal] = useState(false);
  const [editingDict, setEditingDict] = useState<SynonymDictionary | null>(null);
  const [formData, setFormData] = useState({
    key: "",
    description: "",
    terms: [] as string[],
    locale: "",
    is_active: true,
    display_order: 0,
  });
  const [newTerm, setNewTerm] = useState("");

  // Fetch languages on mount
  useEffect(() => {
    fetchLanguages();
  }, [fetchLanguages]);

  // Set default locale when languages are loaded
  useEffect(() => {
    if (languages.length > 0 && !selectedLocale) {
      setSelectedLocale(defaultLanguageCode);
    }
  }, [languages, defaultLanguageCode, selectedLocale]);

  // Fetch dictionaries when filters change
  useEffect(() => {
    if (selectedLocale) {
      fetchDictionaries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, selectedLocale, filterActive, sortBy, sortOrder]);

  async function fetchDictionaries() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedLocale) params.set("locale", selectedLocale);
      if (filterActive !== "all") params.set("is_active", filterActive);
      params.set("sort_by", sortBy);
      params.set("sort_order", sortOrder);
      params.set("include_inactive", "true");

      const res = await fetch(`/api/b2b/pim/synonym-dictionaries?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch dictionaries");
      }
      const data = await res.json();
      setDictionaries(data.dictionaries || []);
    } catch (error) {
      console.error("Failed to fetch dictionaries:", error);
      toast.error("Failed to load dictionaries");
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingDict(null);
    setFormData({
      key: "",
      description: "",
      terms: [],
      locale: selectedLocale,
      is_active: true,
      display_order: 0,
    });
    setNewTerm("");
    setShowModal(true);
  }

  function openEditModal(dict: SynonymDictionary) {
    setEditingDict(dict);
    setFormData({
      key: dict.key,
      description: dict.description || "",
      terms: [...dict.terms],
      locale: dict.locale,
      is_active: dict.is_active,
      display_order: dict.display_order,
    });
    setNewTerm("");
    setShowModal(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const url = editingDict
        ? `/api/b2b/pim/synonym-dictionaries/${editingDict.dictionary_id}`
        : "/api/b2b/pim/synonym-dictionaries";
      const method = editingDict ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Failed to save dictionary");
        return;
      }

      toast.success(editingDict ? "Dictionary updated successfully" : "Dictionary created successfully");
      setShowModal(false);
      fetchDictionaries();
    } catch (error) {
      console.error("Failed to save dictionary:", error);
      toast.error("Failed to save dictionary");
    }
  }

  async function handleDelete(dictId: string, productCount: number) {
    if (productCount > 0) {
      toast.error(
        `Cannot delete dictionary with ${productCount} associated products. Remove the dictionary from products first.`
      );
      return;
    }

    if (!confirm("Are you sure you want to delete this dictionary?")) {
      return;
    }

    try {
      const res = await fetch(`/api/b2b/pim/synonym-dictionaries/${dictId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Failed to delete dictionary");
        return;
      }

      toast.success("Dictionary deleted successfully");
      fetchDictionaries();
    } catch (error) {
      console.error("Failed to delete dictionary:", error);
      toast.error("Failed to delete dictionary");
    }
  }

  function addTerm() {
    const term = newTerm.trim().toLowerCase();
    if (term && !formData.terms.includes(term)) {
      setFormData((prev) => ({ ...prev, terms: [...prev.terms, term] }));
      setNewTerm("");
    }
  }

  function removeTerm(term: string) {
    setFormData((prev) => ({
      ...prev,
      terms: prev.terms.filter((t) => t !== term),
    }));
  }

  function generateKey(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Synonym Dictionaries</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create synonym groups to improve product search relevance.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition"
        >
          <Plus className="h-4 w-4" />
          New Dictionary
        </button>
      </div>

      {/* Locale Tabs */}
      <div className="flex gap-1 border-b border-border">
        {enabledLanguages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => setSelectedLocale(lang.code)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
              selectedLocale === lang.code
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {lang.flag && <span>{lang.flag}</span>}
            <span>{lang.code.toUpperCase()}</span>
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by key or terms..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filterActive}
              onChange={(event) => setFilterActive(event.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="all">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="display_order">Display order</option>
              <option value="key">Key</option>
              <option value="product_count">Product count</option>
              <option value="created_at">Created date</option>
            </select>
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as "asc" | "desc")}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="asc">Asc</option>
              <option value="desc">Desc</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Dictionary Directory ({selectedLocale.toUpperCase()})
          </h2>
        </div>

        {loading ? (
          <div className="px-6 py-20 text-center text-sm text-muted-foreground">
            Loading dictionaries...
          </div>
        ) : dictionaries.length === 0 ? (
          <div className="px-6 py-20 text-center text-sm text-muted-foreground">
            No dictionaries found for this locale. Create your first dictionary to get started.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {dictionaries.map((dict) => (
              <div
                key={dict.dictionary_id}
                className={`flex flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between ${
                  !dict.is_active ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                    <BookOpen className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">{dict.key}</h3>
                      {!dict.is_active && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          Inactive
                        </span>
                      )}
                      <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                        {dict.locale.toUpperCase()}
                      </span>
                    </div>
                    {dict.description && (
                      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        {dict.description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {dict.terms.slice(0, 5).map((term) => (
                        <span
                          key={term}
                          className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {term}
                        </span>
                      ))}
                      {dict.terms.length > 5 && (
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          +{dict.terms.length - 5} more
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span>Products: {dict.product_count}</span>
                      <span>Terms: {dict.terms.length}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/b2b/pim/synonym-dictionaries/${dict.dictionary_id}`}
                    className="inline-flex items-center gap-2 rounded border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open
                  </Link>
                  <button
                    type="button"
                    onClick={() => openEditModal(dict)}
                    className="inline-flex items-center gap-2 rounded border border-border px-3 py-2 text-sm hover:bg-muted transition"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(dict.dictionary_id, dict.product_count)}
                    className="inline-flex items-center gap-2 rounded border border-border px-3 py-2 text-sm hover:bg-red-50 hover:text-red-600 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-xl border border-border bg-card shadow-xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {editingDict ? "Edit Dictionary" : "Create Dictionary"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Define a synonym group with related search terms.
                  </p>
                </div>
              </div>

              <div className="space-y-4 px-6">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,100px)]">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Key *
                    </label>
                    <input
                      value={formData.key}
                      onChange={(event) => {
                        const key = generateKey(event.target.value);
                        setFormData((prev) => ({ ...prev, key }));
                      }}
                      required
                      disabled={!!editingDict}
                      className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:opacity-50"
                      placeholder="climatizzatore"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Locale *
                    </label>
                    <select
                      value={formData.locale}
                      onChange={(event) =>
                        setFormData((prev) => ({ ...prev, locale: event.target.value }))
                      }
                      required
                      disabled={!!editingDict}
                      className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:opacity-50"
                    >
                      {enabledLanguages.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.code.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, description: event.target.value }))
                    }
                    rows={2}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none resize-none"
                    placeholder="Air conditioning and climate control systems"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Terms
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.terms.map((term) => (
                      <span
                        key={term}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-sm"
                      >
                        {term}
                        <button
                          type="button"
                          onClick={() => removeTerm(term)}
                          className="hover:text-red-500 transition"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={newTerm}
                      onChange={(event) => setNewTerm(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addTerm();
                        }
                      }}
                      className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      placeholder="Add a term and press Enter"
                    />
                    <button
                      type="button"
                      onClick={addTerm}
                      className="px-3 py-2 rounded border border-border hover:bg-muted transition text-sm"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Display Order
                    </label>
                    <input
                      type="number"
                      value={formData.display_order}
                      onChange={(event) =>
                        setFormData((prev) => ({
                          ...prev,
                          display_order: Number(event.target.value),
                        }))
                      }
                      className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="inline-flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(event) =>
                          setFormData((prev) => ({ ...prev, is_active: event.target.checked }))
                        }
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                      Active (used in search)
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded border border-border hover:bg-muted transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-primary text-white hover:bg-primary/90 transition"
                >
                  {editingDict ? "Update Dictionary" : "Create Dictionary"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
