"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";

interface Entity {
  id: string;
  name: string;
  slug?: string;
  [key: string]: any;
}

interface EntitySelectorProps {
  entityType: "collection" | "category" | "brand" | "tag" | "product_type" | "product" | "page";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function EntitySelector({
  entityType,
  value,
  onChange,
  placeholder = "Select an item",
}: EntitySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch selected entity when value changes
  useEffect(() => {
    const fetchSelectedEntity = async () => {
      if (!value) {
        setSelectedEntity(null);
        return;
      }

      // Check if already in entities list
      const existing = entities.find((e) => e.id === value);
      if (existing) {
        setSelectedEntity(existing);
        return;
      }

      // Fetch single entity
      try {
        let endpoint = "";
        switch (entityType) {
          case "collection":
            endpoint = `/api/b2b/pim/collections/${value}`;
            break;
          case "category":
            endpoint = `/api/b2b/pim/categories/${value}`;
            break;
          case "brand":
            endpoint = `/api/b2b/pim/brands/${value}`;
            break;
          case "tag":
            endpoint = `/api/b2b/pim/tags/${value}`;
            break;
          case "product_type":
            endpoint = `/api/b2b/pim/product-types/${value}`;
            break;
          case "product":
            endpoint = `/api/b2b/pim/products/${value}`;
            break;
          case "page":
            // TODO: Add page API endpoint when available
            return;
          default:
            return;
        }

        const res = await fetch(endpoint);
        if (!res.ok) return;

        const data = await res.json();
        const item = data.collection || data.category || data.brand || data.tag || data.productType || data.product;

        if (item) {
          const idField =
            entityType === "collection" ? "collection_id" :
            entityType === "category" ? "category_id" :
            entityType === "brand" ? "brand_id" :
            entityType === "tag" ? "tag_id" :
            entityType === "product_type" ? "type_id" :
            entityType === "product" ? "product_id" :
            "id";

          setSelectedEntity({
            id: item[idField],
            name: item.name,
            slug: item.slug,
            ...item,
          });
        }
      } catch (error) {
        console.error("Error fetching selected entity:", error);
      }
    };

    fetchSelectedEntity();
  }, [value, entityType]);

  // Search entities with debouncing
  useEffect(() => {
    if (!isOpen) return;

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If search query is empty, show empty list (don't load all)
    if (!searchQuery) {
      setEntities([]);
      setLoading(false);
      return;
    }

    // Set loading state
    setLoading(true);

    // Debounce search
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        let endpoint = "";
        let dataKey = "";

        switch (entityType) {
          case "collection":
            endpoint = "/api/b2b/pim/collections?include_inactive=true";
            dataKey = "collections";
            break;
          case "category":
            endpoint = "/api/b2b/pim/categories?include_inactive=true";
            dataKey = "categories";
            break;
          case "brand":
            endpoint = "/api/b2b/pim/brands?include_inactive=true";
            dataKey = "brands";
            break;
          case "tag":
            endpoint = "/api/b2b/pim/tags?include_inactive=true";
            dataKey = "tags";
            break;
          case "product_type":
            endpoint = "/api/b2b/pim/product-types?include_inactive=true";
            dataKey = "productTypes";
            break;
          case "product":
            endpoint = "/api/b2b/pim/products?include_inactive=true";
            dataKey = "products";
            break;
          case "page":
            // TODO: Add page API endpoint when available
            setLoading(false);
            return;
          default:
            setLoading(false);
            return;
        }

        const res = await fetch(endpoint);
        if (!res.ok) throw new Error("Failed to fetch entities");

        const data = await res.json();
        const items = data[dataKey] || [];

        // Map to common structure
        const mappedItems = items.map((item: any) => {
          const idField =
            entityType === "collection" ? "collection_id" :
            entityType === "category" ? "category_id" :
            entityType === "brand" ? "brand_id" :
            entityType === "tag" ? "tag_id" :
            entityType === "product_type" ? "type_id" :
            entityType === "product" ? "product_id" :
            "id";

          return {
            id: item[idField],
            name: item.name,
            slug: item.slug,
            ...item,
          };
        });

        setEntities(mappedItems);
      } catch (error) {
        console.error("Error fetching entities:", error);
        setEntities([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [isOpen, searchQuery, entityType]);

  // Filter entities based on search
  const filteredEntities = searchQuery
    ? entities.filter(
        (entity) =>
          entity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (entity.slug && entity.slug.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : entities;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-left focus:border-primary focus:outline-none flex items-center justify-between"
      >
        <span className={selectedEntity ? "text-foreground" : "text-muted-foreground"}>
          {selectedEntity ? selectedEntity.name : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-border rounded-lg shadow-lg max-h-80 overflow-hidden">
          {/* Search Box */}
          <div className="p-2 border-b border-border sticky top-0 bg-white">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={`Search ${entityType}s...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 text-sm border border-border rounded focus:border-primary focus:outline-none"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                Loading...
              </div>
            ) : filteredEntities.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                No {entityType}s found
              </div>
            ) : (
              filteredEntities.map((entity) => (
                <button
                  key={entity.id}
                  type="button"
                  onClick={() => {
                    onChange(entity.id);
                    setIsOpen(false);
                    setSearchQuery("");
                  }}
                  className={`w-full py-2.5 px-4 text-left text-sm hover:bg-muted transition ${
                    value === entity.id ? "bg-primary/10 text-primary font-medium" : ""
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-foreground">{entity.name}</span>
                    {entity.slug && (
                      <span className="text-xs text-muted-foreground">{entity.slug}</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
