"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, X, Check } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ProductAssociationSection,
  ProductAssociationConfig,
} from "@/components/pim/ProductAssociationSection";

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

export default function SynonymDictionaryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [dictionary, setDictionary] = useState<SynonymDictionary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Terms state
  const [terms, setTerms] = useState<string[]>([]);
  const [newTerm, setNewTerm] = useState("");

  // Product count (updated by ProductAssociationSection)
  const [productCount, setProductCount] = useState(0);

  useEffect(() => {
    fetchDictionary();
  }, [id]);

  async function fetchDictionary() {
    setLoading(true);
    try {
      const res = await fetch(`/api/b2b/pim/synonym-dictionaries/${id}`);
      if (!res.ok) {
        throw new Error("Dictionary not found");
      }
      const data = await res.json();
      setDictionary(data.dictionary);
      setTerms(data.dictionary.terms || []);
      setProductCount(data.dictionary.product_count || 0);
    } catch (error) {
      console.error("Failed to fetch dictionary:", error);
      toast.error("Failed to load dictionary");
      router.push("/b2b/pim/synonym-dictionaries");
    } finally {
      setLoading(false);
    }
  }

  async function saveTerms() {
    setSaving(true);
    try {
      const res = await fetch(`/api/b2b/pim/synonym-dictionaries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terms }),
      });

      if (!res.ok) {
        throw new Error("Failed to save");
      }

      toast.success("Terms saved successfully");
      fetchDictionary();
    } catch (error) {
      console.error("Failed to save terms:", error);
      toast.error("Failed to save terms");
    } finally {
      setSaving(false);
    }
  }

  function addTerm() {
    const term = newTerm.trim().toLowerCase();
    if (term && !terms.includes(term)) {
      setTerms([...terms, term]);
      setNewTerm("");
    }
  }

  function removeTerm(term: string) {
    setTerms(terms.filter((t) => t !== term));
  }

  async function toggleStatus() {
    try {
      const res = await fetch(`/api/b2b/pim/synonym-dictionaries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !dictionary?.is_active }),
      });

      if (res.ok) {
        toast.success(
          dictionary?.is_active ? "Dictionary deactivated" : "Dictionary activated"
        );
        fetchDictionary();
      }
    } catch (error) {
      console.error("Failed to toggle status:", error);
      toast.error("Failed to update status");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!dictionary) {
    return null;
  }

  const hasUnsavedTerms =
    JSON.stringify(terms) !== JSON.stringify(dictionary.terms);

  // Configuration for ProductAssociationSection
  const productAssociationConfig: ProductAssociationConfig = {
    fetchProductsUrl: `/api/b2b/pim/synonym-dictionaries/{id}/products`,
    addProductsUrl: `/api/b2b/pim/synonym-dictionaries/{id}/products`,
    removeProductsUrl: `/api/b2b/pim/synonym-dictionaries/{id}/products`,
    syncUrl: `/api/b2b/pim/synonym-dictionaries/{id}/sync`,
    importUrl: `/api/b2b/pim/synonym-dictionaries/{id}/import`,
    exportUrl: `/api/b2b/pim/synonym-dictionaries/{id}/export`,
    title: "Associated Products",
    description: `Products using this synonym dictionary (${productCount} products)`,
    emptyMessage: "No products associated with this dictionary yet.",
    addButtonText: "Add Products",
    addModalTitle: "Add Products",
    addModalDescription:
      "Search and select products to associate with this synonym dictionary",
    exportFilename: `synonym-dictionary-${dictionary.key}-products.csv`,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/b2b/pim/synonym-dictionaries"
            className="p-2 rounded-lg hover:bg-muted transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">
                {dictionary.key}
              </h1>
              <span className="rounded-full bg-primary/10 text-primary px-3 py-1 text-sm font-medium">
                {dictionary.locale.toUpperCase()}
              </span>
              {!dictionary.is_active && (
                <span className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
                  Inactive
                </span>
              )}
            </div>
            {dictionary.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {dictionary.description}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={toggleStatus}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            dictionary.is_active
              ? "bg-muted hover:bg-muted/80 text-foreground"
              : "bg-primary hover:bg-primary/90 text-white"
          }`}
        >
          {dictionary.is_active ? "Deactivate" : "Activate"}
        </button>
      </div>

      {/* Terms Section */}
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Terms</h2>
            <p className="text-sm text-muted-foreground">
              Synonyms and related search terms ({terms.length} terms)
            </p>
          </div>
          {hasUnsavedTerms && (
            <button
              onClick={saveTerms}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          )}
        </div>

        <div className="p-6">
          <div className="flex flex-wrap gap-2 mb-4">
            {terms.map((term) => (
              <span
                key={term}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-sm"
              >
                {term}
                <button
                  onClick={() => removeTerm(term)}
                  className="hover:text-red-500 transition ml-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {terms.length === 0 && (
              <span className="text-sm text-muted-foreground">
                No terms added yet. Add terms below.
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <input
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTerm();
                }
              }}
              placeholder="Add a new term..."
              className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <button
              onClick={addTerm}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted transition"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Products Section - Using reusable component */}
      <ProductAssociationSection
        entityId={id}
        config={productAssociationConfig}
        onProductCountChange={setProductCount}
      />
    </div>
  );
}
