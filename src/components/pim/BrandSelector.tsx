"use client";

import { useState, useEffect } from "react";
import { Search, X, Tag } from "lucide-react";

type Brand = {
  brand_id: string;
  label: string;
  slug: string;
  logo_url?: string;
  is_active: boolean;
};

type BrandReference = {
  id: string;
  name: string;
  slug: string;
  image?: {
    id: string;
    thumbnail: string;
    original: string;
  };
};

type Props = {
  value: BrandReference | null;
  onChange: (brand: BrandReference | null) => void;
  disabled?: boolean;
};

export function BrandSelector({ value, onChange, disabled }: Props) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    fetchBrands();
  }, [search]);

  async function fetchBrands() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("is_active", "true");
      params.set("limit", "100");

      const res = await fetch(`/api/b2b/pim/brands?${params}`);
      const data = await res.json();
      setBrands(data.brands || []);
    } catch (error) {
      console.error("Failed to fetch brands:", error);
    } finally {
      setLoading(false);
    }
  }

  function selectBrand(brand: Brand) {
    onChange({
      id: brand.brand_id,
      name: brand.label,
      slug: brand.slug,
      image: brand.logo_url
        ? {
            id: brand.brand_id,
            thumbnail: brand.logo_url,
            original: brand.logo_url,
          }
        : undefined,
    });
    setShowDropdown(false);
    setSearch("");
  }

  function clearBrand() {
    onChange(null);
  }

  return (
    <div className="relative">
      {/* Selected Brand Display */}
      {value ? (
        <div className="flex items-center gap-3 p-3 border border-input rounded-lg bg-background">
          {value.image ? (
            <img
              src={value.image.thumbnail}
              alt={value.name}
              className="w-10 h-10 object-contain rounded"
            />
          ) : (
            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
              <Tag className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1">
            <div className="font-medium text-foreground">{value.name}</div>
            <div className="text-sm text-muted-foreground">{value.slug}</div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={clearBrand}
              className="p-1 hover:bg-accent rounded"
              title="Clear brand"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowDropdown(true)}
          disabled={disabled}
          className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-input rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Tag className="w-4 h-4" />
          <span className="text-sm text-muted-foreground">Select Brand</span>
        </button>
      )}

      {/* Dropdown */}
      {showDropdown && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />

          {/* Dropdown Content */}
          <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-hidden flex flex-col">
            {/* Search Input */}
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search brands..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
              </div>
            </div>

            {/* Brands List */}
            <div className="overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Loading brands...
                </div>
              ) : brands.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No brands found
                </div>
              ) : (
                <div className="p-1">
                  {brands.map((brand) => (
                    <button
                      key={brand.brand_id}
                      type="button"
                      onClick={() => selectBrand(brand)}
                      className="w-full flex items-center gap-3 p-3 rounded hover:bg-accent text-left"
                    >
                      {brand.logo_url ? (
                        <img
                          src={brand.logo_url}
                          alt={brand.label}
                          className="w-10 h-10 object-contain rounded"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                          <Tag className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-foreground">
                          {brand.label}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {brand.slug}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
