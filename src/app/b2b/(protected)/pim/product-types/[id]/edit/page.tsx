"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { ArrowLeft, Save, Cpu } from "lucide-react";
import { toast } from "sonner";

type TechnicalFeature = {
  _id: string;
  feature_id: string;
  key: string;
  label: string;
  type: "text" | "number" | "select" | "multiselect" | "boolean";
  unit?: string;
  options?: string[];
  default_required: boolean;
  display_order: number;
  is_active: boolean;
};

type SelectedFeature = {
  feature_id: string;
  required: boolean;
  display_order: number;
};

type ProductType = {
  product_type_id: string;
  name: string;
  slug: string;
  description?: string;
  features?: SelectedFeature[];
  display_order: number;
  is_active: boolean;
};

export default function EditProductTypePage() {
  const router = useRouter();
  const params = useParams();
  const productTypeId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    display_order: 0,
    is_active: true,
  });

  // Available features from the Features management page
  const [availableFeatures, setAvailableFeatures] = useState<TechnicalFeature[]>([]);

  // Selected features with overrides
  const [selectedFeatures, setSelectedFeatures] = useState<Map<string, SelectedFeature>>(new Map());

  useEffect(() => {
    Promise.all([fetchProductType(), fetchFeatures()]);
  }, [productTypeId]);

  async function fetchProductType() {
    try {
      const res = await fetch(`/api/b2b/pim/product-types?include_inactive=true`);
      if (res.ok) {
        const data = await res.json();
        const productType = data.productTypes.find((pt: ProductType) => pt.product_type_id === productTypeId);

        if (productType) {
          setFormData({
            name: productType.name,
            slug: productType.slug,
            description: productType.description || "",
            display_order: productType.display_order,
            is_active: productType.is_active,
          });

          // Pre-populate selected features
          const selected = new Map<string, SelectedFeature>();
          (productType.features || []).forEach((f: SelectedFeature) => {
            selected.set(f.feature_id, f);
          });
          setSelectedFeatures(selected);
        } else {
          toast.error("Product type not found");
          router.push("/b2b/pim/product-types");
        }
      }
    } catch (error) {
      console.error("Error fetching product type:", error);
      toast.error("Failed to load product type");
    }
  }

  async function fetchFeatures() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/b2b/pim/features?include_inactive=false");
      if (res.ok) {
        const data = await res.json();
        setAvailableFeatures(data.features);
      }
    } catch (error) {
      console.error("Error fetching features:", error);
      toast.error("Failed to load features");
    } finally {
      setIsLoading(false);
    }
  }

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  function toggleFeature(feature: TechnicalFeature) {
    const newSelected = new Map(selectedFeatures);

    if (newSelected.has(feature.feature_id)) {
      newSelected.delete(feature.feature_id);
    } else {
      newSelected.set(feature.feature_id, {
        feature_id: feature.feature_id,
        required: feature.default_required,
        display_order: newSelected.size,
      });
    }

    setSelectedFeatures(newSelected);
  }

  function updateFeatureOverride(featureId: string, updates: Partial<SelectedFeature>) {
    const newSelected = new Map(selectedFeatures);
    const current = newSelected.get(featureId);
    if (current) {
      newSelected.set(featureId, { ...current, ...updates });
      setSelectedFeatures(newSelected);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (selectedFeatures.size === 0) {
      toast.error("Please select at least one feature");
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        display_order: formData.display_order,
        is_active: formData.is_active,
        features: Array.from(selectedFeatures.values()),
      };

      const res = await fetch(`/api/b2b/pim/product-types/${productTypeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Product type updated successfully");
        router.push("/b2b/pim/product-types");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to update product type");
      }
    } catch (error) {
      console.error("Error updating product type:", error);
      toast.error("Failed to update product type");
    } finally {
      setIsSaving(false);
    }
  }

  // Group features by type
  const groupedFeatures = availableFeatures.reduce((acc, feat) => {
    if (!acc[feat.type]) acc[feat.type] = [];
    acc[feat.type].push(feat);
    return acc;
  }, {} as Record<string, TechnicalFeature[]>);

  const typeLabels: Record<string, string> = {
    text: "Text",
    number: "Number",
    select: "Select",
    multiselect: "Multi-select",
    boolean: "Boolean",
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-96 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Product Information Management", href: "/b2b/pim" },
          { label: "Product Types", href: "/b2b/pim/product-types" },
          { label: "Edit Product Type" },
        ]}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/b2b/pim/product-types")}
              className="p-2 rounded border border-border hover:bg-muted transition"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Edit Product Type</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Update product type and features
              </p>
            </div>
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
          >
            <Save className="h-5 w-5" />
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>

        {/* Basic Information */}
        <div className="rounded-lg bg-card shadow-sm border border-border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            Basic Information
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setFormData({
                    ...formData,
                    name,
                    slug: formData.slug || generateSlug(name),
                  });
                }}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="e.g., Water Meter, Pump, Valve"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Slug <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="water-meter"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              placeholder="Brief description of this product type..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="w-full">
              <label className="block text-sm font-medium text-foreground mb-1">
                Display Order
              </label>
              <input
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-foreground">Active (available for products)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Features Selection */}
        <div className="rounded-lg bg-card shadow-sm border border-border p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Select Features</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Choose which features apply to this product type. Selected: {selectedFeatures.size}
            </p>
          </div>

          {availableFeatures.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-border rounded-lg">
              <p className="text-sm text-muted-foreground">
                No features available. Please create features first in the Features page.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedFeatures).map(([type, features]) => (
                <div key={type} className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    {typeLabels[type]} Features
                  </h3>
                  <div className="space-y-2">
                    {features.map((feature) => {
                      const isSelected = selectedFeatures.has(feature.feature_id);
                      const selectedData = selectedFeatures.get(feature.feature_id);

                      return (
                        <div
                          key={feature.feature_id}
                          className={`p-4 rounded-lg border transition ${
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border bg-muted/30 hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleFeature(feature)}
                              className="mt-1 w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm text-primary bg-primary/10 px-2 py-0.5 rounded">
                                  {feature.key}
                                </span>
                                <span className="font-medium text-foreground">{feature.label}</span>
                                {feature.unit && (
                                  <span className="text-xs text-muted-foreground">({feature.unit})</span>
                                )}
                                {feature.default_required && (
                                  <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800">
                                    Required by default
                                  </span>
                                )}
                              </div>
                              {feature.options && feature.options.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Options: {feature.options.slice(0, 3).join(", ")}
                                  {feature.options.length > 3 && ` +${feature.options.length - 3} more`}
                                </p>
                              )}

                              {/* Override settings when selected */}
                              {isSelected && selectedData && (
                                <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-4">
                                  <label className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={selectedData.required}
                                      onChange={(e) =>
                                        updateFeatureOverride(feature.feature_id, {
                                          required: e.target.checked,
                                        })
                                      }
                                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <span className="text-sm text-foreground">Required for this product type</span>
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <label className="text-sm text-foreground">Display Order:</label>
                                    <input
                                      type="number"
                                      value={selectedData.display_order}
                                      onChange={(e) =>
                                        updateFeatureOverride(feature.feature_id, {
                                          display_order: parseInt(e.target.value),
                                        })
                                      }
                                      className="w-20 rounded border border-border bg-white px-2 py-1 text-sm focus:border-primary focus:outline-none"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push("/b2b/pim/product-types")}
            className="px-4 py-2 rounded border border-border hover:bg-muted transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition disabled:opacity-50"
          >
            <Save className="h-5 w-5" />
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
