"use client";

import { useState, useEffect } from "react";
import { Search, X, Layers, Plus } from "lucide-react";
import { useLanguageStore } from "@/lib/stores/languageStore";

type Collection = {
  collection_id: string;
  name: string | Record<string, string>;
  slug: string;
  description?: string;
};

type SelectedCollection = {
  id: string;
  name: string | Record<string, string>;
  slug: string;
};

/**
 * Helper function to extract text from multilingual objects
 * Uses default language first, then fallback chain
 * IMPORTANT: This function MUST always return a string, never an object
 */
function getMultilingualText(
  text: string | Record<string, string> | undefined | null | any,
  defaultLanguageCode: string = "it",
  fallback: string = ""
): string {
  // Handle null, undefined, or empty values
  if (!text) return fallback;

  // If already a string, return it
  if (typeof text === "string") return text;

  // If not an object, convert to string
  if (typeof text !== "object") return String(text);

  // Try to extract string from multilingual object
  try {
    const result = text[defaultLanguageCode] || text.en || Object.values(text)[0];

    // Ensure result is a string
    if (typeof result === "string" && result) return result;
    if (result) return String(result);

    return fallback;
  } catch (error) {
    console.error("Error extracting multilingual text:", error, text);
    return fallback;
  }
}

type Props = {
  value: SelectedCollection[];
  onChange: (collections: SelectedCollection[]) => void;
  disabled?: boolean;
};

export function CollectionsSelector({ value, onChange, disabled }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Language store for getting default language from database
  const { languages, fetchLanguages } = useLanguageStore();
  const defaultLanguage = languages.find(lang => lang.isDefault) || languages.find(lang => lang.code === "it");
  const defaultLanguageCode = defaultLanguage?.code || "it";

  useEffect(() => {
    fetchLanguages();
    fetchCollections();
  }, []);

  async function fetchCollections() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/b2b/pim/collections?include_inactive=false");
      if (res.ok) {
        const data = await res.json();
        setCollections(data.collections);
      }
    } catch (error) {
      console.error("Error fetching collections:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function toggleCollection(collection: Collection) {
    const isSelected = value.some((c) => c.id === collection.collection_id);

    if (isSelected) {
      onChange(value.filter((c) => c.id !== collection.collection_id));
    } else {
      onChange([
        ...value,
        {
          id: collection.collection_id,
          name: collection.name,
          slug: collection.slug,
        },
      ]);
    }
  }

  function removeCollection(collectionId: string) {
    onChange(value.filter((c) => c.id !== collectionId));
  }

  const filteredCollections = collections.filter((c) => {
    const name = getMultilingualText(c.name, defaultLanguageCode, "");
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.slug.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const selectedIds = new Set(value.map((c) => c.id));

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-foreground mb-1">
        Collections
      </label>

      {/* Selected Collections */}
      <div className="space-y-2">
        {value.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 rounded border border-border bg-background">
            {value.map((collection) => (
              <div
                key={collection.id}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm"
              >
                <Layers className="h-3 w-3" />
                <span>{getMultilingualText(collection.name, defaultLanguageCode, "")}</span>
                <button
                  type="button"
                  onClick={() => removeCollection(collection.id)}
                  disabled={disabled}
                  className="hover:bg-primary/20 rounded-full p-0.5 transition disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add Button */}
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(true)}
          disabled={disabled}
          className="w-full flex items-center justify-center gap-2 p-3 rounded border border-dashed border-border hover:border-primary hover:bg-primary/5 transition disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          <span className="text-sm">{value.length > 0 ? "Add more collections" : "Add to collections"}</span>
        </button>
      </div>

      {/* Dropdown Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[600px] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Select Collections</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {value.length} selected
                  </p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded hover:bg-muted transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search collections..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded border border-border bg-background focus:border-primary focus:outline-none"
                  autoFocus
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-sm text-muted-foreground">Loading collections...</div>
                </div>
              ) : filteredCollections.length === 0 ? (
                <div className="text-center py-12">
                  <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? "No collections found" : "No collections available"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCollections.map((collection) => {
                    const isSelected = selectedIds.has(collection.collection_id);
                    return (
                      <button
                        key={collection.collection_id}
                        onClick={() => toggleCollection(collection)}
                        className={`w-full text-left p-4 rounded border transition ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary hover:bg-primary/5"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex items-center h-5 mt-0.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                          </div>
                          <Layers className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground">{getMultilingualText(collection.name, defaultLanguageCode, "")}</p>
                            <p className="text-xs text-muted-foreground">{collection.slug}</p>
                            {collection.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {collection.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {value.length} collection{value.length !== 1 ? "s" : ""} selected
              </p>
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
