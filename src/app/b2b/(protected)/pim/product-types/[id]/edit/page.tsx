"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { ArrowLeft, Save, Cpu } from "lucide-react";
import { toast } from "sonner";
import { getLocalizedString, type MultiLangString } from "@/lib/types/pim";

type TechnicalSpecification = {
  _id: string;
  technical_specification_id: string;
  key: string;
  label: string;
  type: "text" | "number" | "select" | "multiselect" | "boolean";
  unit?: string;
  options?: string[];
  default_required: boolean;
  display_order: number;
  is_active: boolean;
};

type SelectedSpecification = {
  technical_specification_id: string;
  required: boolean;
  display_order: number;
};

type ProductType = {
  product_type_id: string;
  code?: string;
  name: MultiLangString;
  slug: string;
  description?: MultiLangString;
  technical_specifications?: SelectedSpecification[];
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
    code: "",
    name: "",
    slug: "",
    description: "",
    display_order: 0,
    is_active: true,
  });

  // Available specifications from the Technical Specifications management page
  const [availableSpecifications, setAvailableSpecifications] = useState<TechnicalSpecification[]>([]);

  // Selected specifications with overrides
  const [selectedSpecifications, setSelectedSpecifications] = useState<Map<string, SelectedSpecification>>(new Map());

  useEffect(() => {
    Promise.all([fetchProductType(), fetchSpecifications()]);
  }, [productTypeId]);

  async function fetchProductType() {
    try {
      const res = await fetch(`/api/b2b/pim/product-types?include_inactive=true`);
      if (res.ok) {
        const data = await res.json();
        const productType = data.productTypes.find((pt: ProductType) => pt.product_type_id === productTypeId);

        if (productType) {
          setFormData({
            code: productType.code || "",
            name: getLocalizedString(productType.name, ""),
            slug: productType.slug,
            description: getLocalizedString(productType.description, ""),
            display_order: productType.display_order,
            is_active: productType.is_active,
          });

          // Pre-populate selected specifications
          const selected = new Map<string, SelectedSpecification>();
          (productType.technical_specifications || []).forEach((s: SelectedSpecification) => {
            selected.set(s.technical_specification_id, s);
          });
          setSelectedSpecifications(selected);
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

  async function fetchSpecifications() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/b2b/pim/technical-specifications?include_inactive=false");
      if (res.ok) {
        const data = await res.json();
        setAvailableSpecifications(data.technical_specifications);
      }
    } catch (error) {
      console.error("Error fetching technical specifications:", error);
      toast.error("Failed to load technical specifications");
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

  function toggleSpecification(spec: TechnicalSpecification) {
    const newSelected = new Map(selectedSpecifications);

    if (newSelected.has(spec.technical_specification_id)) {
      newSelected.delete(spec.technical_specification_id);
    } else {
      newSelected.set(spec.technical_specification_id, {
        technical_specification_id: spec.technical_specification_id,
        required: spec.default_required,
        display_order: newSelected.size,
      });
    }

    setSelectedSpecifications(newSelected);
  }

  function updateSpecificationOverride(specId: string, updates: Partial<SelectedSpecification>) {
    const newSelected = new Map(selectedSpecifications);
    const current = newSelected.get(specId);
    if (current) {
      newSelected.set(specId, { ...current, ...updates });
      setSelectedSpecifications(newSelected);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (selectedSpecifications.size === 0) {
      toast.error("Please select at least one technical specification");
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        code: formData.code || undefined, // Optional ERP code
        name: { it: formData.name }, // Multilingual: store as object
        slug: formData.slug,
        description: formData.description ? { it: formData.description } : undefined,
        display_order: formData.display_order,
        is_active: formData.is_active,
        technical_specifications: Array.from(selectedSpecifications.values()),
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

  // Group specifications by type
  const groupedSpecifications = availableSpecifications.reduce((acc, spec) => {
    if (!acc[spec.type]) acc[spec.type] = [];
    acc[spec.type].push(spec);
    return acc;
  }, {} as Record<string, TechnicalSpecification[]>);

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
                Update product type and technical specifications
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

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Code (ERP)
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="e.g., 001, 037"
              />
            </div>
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

        {/* Technical Specifications Selection */}
        <div className="rounded-lg bg-card shadow-sm border border-border p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Select Technical Specifications</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Choose which specifications apply to this product type. Selected: {selectedSpecifications.size}
            </p>
          </div>

          {availableSpecifications.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-border rounded-lg">
              <p className="text-sm text-muted-foreground">
                No technical specifications available. Please create specifications first in the Technical Specifications page.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedSpecifications).map(([type, specs]) => (
                <div key={type} className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    {typeLabels[type]} Specifications
                  </h3>
                  <div className="space-y-2">
                    {specs.map((spec) => {
                      const isSelected = selectedSpecifications.has(spec.technical_specification_id);
                      const selectedData = selectedSpecifications.get(spec.technical_specification_id);

                      return (
                        <div
                          key={spec.technical_specification_id}
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
                              onChange={() => toggleSpecification(spec)}
                              className="mt-1 w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm text-primary bg-primary/10 px-2 py-0.5 rounded">
                                  {spec.key}
                                </span>
                                <span className="font-medium text-foreground">{spec.label}</span>
                                {spec.unit && (
                                  <span className="text-xs text-muted-foreground">({spec.unit})</span>
                                )}
                                {spec.default_required && (
                                  <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800">
                                    Required by default
                                  </span>
                                )}
                              </div>
                              {spec.options && spec.options.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Options: {spec.options.slice(0, 3).join(", ")}
                                  {spec.options.length > 3 && ` +${spec.options.length - 3} more`}
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
                                        updateSpecificationOverride(spec.technical_specification_id, {
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
                                        updateSpecificationOverride(spec.technical_specification_id, {
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
