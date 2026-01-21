"use client";

import { useState, useEffect } from "react";
import { Search, X, Cpu } from "lucide-react";
import { getLocalizedString, type MultiLangString } from "@/lib/types/pim";

type ProductType = {
  product_type_id: string;
  name: MultiLangString;
  slug: string;
  description?: MultiLangString;
  features?: {
    feature_id: string;
    required: boolean;
    display_order: number;
  }[];
};

type ProductTypeWithFeatureDetails = ProductType & {
  featureDetails?: {
    feature_id: string;
    key: string;
    label: string;
    type: "text" | "number" | "select" | "multiselect" | "boolean";
    unit?: string;
    options?: string[];
    required: boolean;
  }[];
};

type Props = {
  value?: {
    id: string;
    name: MultiLangString;
    slug: string;
  };
  onChange: (productType: ProductTypeWithFeatureDetails | null) => void;
  disabled?: boolean;
};

export function ProductTypeSelector({ value, onChange, disabled }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [allFeatures, setAllFeatures] = useState<Map<string, any>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    Promise.all([fetchProductTypes(), fetchFeatures()]);
  }, []);

  async function fetchProductTypes() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/b2b/pim/product-types?include_inactive=false");
      if (res.ok) {
        const data = await res.json();
        setProductTypes(data.productTypes);
      }
    } catch (error) {
      console.error("Error fetching product types:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchFeatures() {
    try {
      const res = await fetch("/api/b2b/pim/features?include_inactive=false");
      if (res.ok) {
        const data = await res.json();
        const featuresMap = new Map();
        data.features.forEach((f: any) => {
          featuresMap.set(f.feature_id, f);
        });
        setAllFeatures(featuresMap);
      }
    } catch (error) {
      console.error("Error fetching features:", error);
    }
  }

  function selectProductType(productType: ProductType) {
    // Populate feature details
    const featureDetails = (productType.features || []).map((f) => {
      const featureInfo = allFeatures.get(f.feature_id);
      return {
        feature_id: f.feature_id,
        key: featureInfo?.key || "",
        label: featureInfo?.label || "",
        type: featureInfo?.type || "text",
        unit: featureInfo?.unit,
        options: featureInfo?.options,
        required: f.required,
      };
    });

    onChange({
      ...productType,
      featureDetails,
    });
    setIsOpen(false);
    setSearchQuery("");
  }

  function clearSelection() {
    onChange(null);
  }

  const filteredProductTypes = productTypes.filter((pt) => {
    const nameStr = getLocalizedString(pt.name, "").toLowerCase();
    return nameStr.includes(searchQuery.toLowerCase()) ||
      pt.slug.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-foreground mb-1">
        Product Type
      </label>

      {/* Selected Value Display */}
      {value ? (
        <div className="flex items-center justify-between p-3 rounded border border-border bg-background">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">{getLocalizedString(value.name)}</p>
              <p className="text-xs text-muted-foreground">{value.slug}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={clearSelection}
            disabled={disabled}
            className="p-1 rounded hover:bg-muted transition disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(true)}
          disabled={disabled}
          className="w-full flex items-center justify-between p-3 rounded border border-border bg-background hover:border-primary transition disabled:opacity-50 text-left"
        >
          <span className="text-sm text-muted-foreground">Select a product type...</span>
          <Cpu className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {/* Dropdown Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[600px] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-foreground">Select Product Type</h3>
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
                  placeholder="Search product types..."
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
                  <div className="text-sm text-muted-foreground">Loading product types...</div>
                </div>
              ) : filteredProductTypes.length === 0 ? (
                <div className="text-center py-12">
                  <Cpu className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? "No product types found" : "No product types available"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredProductTypes.map((pt) => (
                    <button
                      key={pt.product_type_id}
                      onClick={() => selectProductType(pt)}
                      className="w-full text-left p-4 rounded border border-border hover:border-primary hover:bg-primary/5 transition"
                    >
                      <div className="flex items-start gap-3">
                        <Cpu className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">{getLocalizedString(pt.name)}</p>
                          <p className="text-xs text-muted-foreground mb-1">{pt.slug}</p>
                          {pt.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{getLocalizedString(pt.description)}</p>
                          )}
                          <div className="mt-2 text-xs text-muted-foreground">
                            {(pt.features || []).length} technical features
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
