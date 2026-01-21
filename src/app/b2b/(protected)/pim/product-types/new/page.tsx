"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { ArrowLeft, Save, Cpu, Plus, X } from "lucide-react";
import { toast } from "sonner";

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

export default function NewProductTypePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    slug: "",
    description: "",
    display_order: 0,
  });

  // Available technical specifications from the Technical Specifications management page
  const [availableSpecifications, setAvailableSpecifications] = useState<TechnicalSpecification[]>([]);

  // Selected specifications with overrides
  const [selectedSpecifications, setSelectedSpecifications] = useState<Map<string, SelectedSpecification>>(new Map());

  // Specification creation dialog
  const [showSpecDialog, setShowSpecDialog] = useState(false);
  const [isCreatingSpec, setIsCreatingSpec] = useState(false);
  const [isSpecKeyManuallyEdited, setIsSpecKeyManuallyEdited] = useState(false);
  const [specFormData, setSpecFormData] = useState({
    key: "",
    label: "",
    type: "text" as "text" | "number" | "select" | "multiselect" | "boolean",
    unit: "",
    options: [] as string[],
    optionInput: "",
    default_required: false,
    display_order: 0,
  });

  useEffect(() => {
    fetchSpecifications();
  }, []);

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

  function generateSpecKey(label: string) {
    return label
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, "_");
  }

  function resetSpecForm() {
    setSpecFormData({
      key: "",
      label: "",
      type: "text",
      unit: "",
      options: [],
      optionInput: "",
      default_required: false,
      display_order: availableSpecifications.length,
    });
    setIsSpecKeyManuallyEdited(false);
  }

  function addOption() {
    const option = specFormData.optionInput.trim();
    if (option && !specFormData.options.includes(option)) {
      setSpecFormData({
        ...specFormData,
        options: [...specFormData.options, option],
        optionInput: "",
      });
    }
  }

  function removeOption(option: string) {
    setSpecFormData({
      ...specFormData,
      options: specFormData.options.filter((o) => o !== option),
    });
  }

  async function handleCreateSpecification(e: React.FormEvent) {
    e.preventDefault();
    setIsCreatingSpec(true);

    try {
      const payload = {
        key: specFormData.key,
        label: specFormData.label,
        type: specFormData.type,
        unit: specFormData.unit || undefined,
        options: specFormData.options.length > 0 ? specFormData.options : undefined,
        default_required: specFormData.default_required,
        display_order: specFormData.display_order,
      };

      const res = await fetch("/api/b2b/pim/technical-specifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success("Technical specification created successfully");

        // Refresh specifications list
        await fetchSpecifications();

        // Auto-select the newly created specification
        const newSpec = data.technical_specification;
        const newSelected = new Map(selectedSpecifications);
        newSelected.set(newSpec.technical_specification_id, {
          technical_specification_id: newSpec.technical_specification_id,
          required: newSpec.default_required,
          display_order: newSelected.size,
        });
        setSelectedSpecifications(newSelected);

        // Close dialog and reset form
        setShowSpecDialog(false);
        resetSpecForm();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to create technical specification");
      }
    } catch (error) {
      console.error("Error creating technical specification:", error);
      toast.error("Failed to create technical specification");
    } finally {
      setIsCreatingSpec(false);
    }
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
        technical_specifications: Array.from(selectedSpecifications.values()),
      };

      const res = await fetch("/api/b2b/pim/product-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Product type created successfully");
        router.push("/b2b/pim/product-types");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to create product type");
      }
    } catch (error) {
      console.error("Error creating product type:", error);
      toast.error("Failed to create product type");
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
          { label: "New Product Type" },
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
              <h1 className="text-2xl font-bold text-foreground">Create Product Type</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Define a new product type with technical specifications
              </p>
            </div>
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
          >
            <Save className="h-5 w-5" />
            {isSaving ? "Creating..." : "Create Product Type"}
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
                    // Auto-generate slug only if it hasn't been manually edited
                    slug: isSlugManuallyEdited ? formData.slug : generateSlug(name),
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
                onChange={(e) => {
                  setFormData({ ...formData, slug: e.target.value });
                  setIsSlugManuallyEdited(true);
                }}
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

          <div className="w-48">
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
        </div>

        {/* Technical Specifications Selection */}
        <div className="rounded-lg bg-card shadow-sm border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Select Technical Specifications</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Choose which specifications apply to this product type. Selected: {selectedSpecifications.size}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSpecDialog(true)}
              className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded hover:bg-primary/90 transition text-sm"
            >
              <Plus className="h-4 w-4" />
              New Specification
            </button>
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
            {isSaving ? "Creating..." : "Create Product Type"}
          </button>
        </div>
      </form>

      {/* Create Technical Specification Dialog */}
      {showSpecDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleCreateSpecification}>
              {/* Dialog Header */}
              <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-white">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">New Technical Specification</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add a technical specification to your catalog
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowSpecDialog(false);
                    resetSpecForm();
                  }}
                  className="p-2 rounded hover:bg-gray-100 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Dialog Body */}
              <div className="p-6 space-y-4">
                {/* Label and Key */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Label <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={specFormData.label}
                      onChange={(e) => {
                        const label = e.target.value;
                        setSpecFormData({
                          ...specFormData,
                          label,
                          // Auto-generate key only if it hasn't been manually edited
                          key: isSpecKeyManuallyEdited ? specFormData.key : generateSpecKey(label),
                        });
                      }}
                      className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="e.g., Maximum Pressure"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Key <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={specFormData.key}
                      onChange={(e) => {
                        setSpecFormData({ ...specFormData, key: e.target.value });
                        setIsSpecKeyManuallyEdited(true);
                      }}
                      className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                      placeholder="max_pressure"
                    />
                  </div>
                </div>

                {/* Type and Unit */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={specFormData.type}
                      onChange={(e) =>
                        setSpecFormData({
                          ...specFormData,
                          type: e.target.value as "text" | "number" | "select" | "multiselect" | "boolean",
                          options: [], // Reset options when type changes
                        })
                      }
                      className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="select">Select (dropdown)</option>
                      <option value="multiselect">Multi-select</option>
                      <option value="boolean">Boolean (yes/no)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Unit
                    </label>
                    <input
                      type="text"
                      value={specFormData.unit}
                      onChange={(e) =>
                        setSpecFormData({ ...specFormData, unit: e.target.value })
                      }
                      className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="e.g., bar, mm, kg"
                    />
                  </div>
                </div>

                {/* Options for select/multiselect */}
                {(specFormData.type === "select" || specFormData.type === "multiselect") && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Options <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={specFormData.optionInput}
                          onChange={(e) =>
                            setSpecFormData({
                              ...specFormData,
                              optionInput: e.target.value,
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addOption();
                            }
                          }}
                          className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          placeholder="Type an option and press Enter"
                        />
                        <button
                          type="button"
                          onClick={addOption}
                          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition text-sm"
                        >
                          Add
                        </button>
                      </div>
                      {specFormData.options.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {specFormData.options.map((option) => (
                            <span
                              key={option}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                            >
                              {option}
                              <button
                                type="button"
                                onClick={() => removeOption(option)}
                                className="hover:text-red-600"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Display Order and Default Required */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Display Order
                    </label>
                    <input
                      type="number"
                      value={specFormData.display_order}
                      onChange={(e) =>
                        setSpecFormData({
                          ...specFormData,
                          display_order: parseInt(e.target.value),
                        })
                      }
                      className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={specFormData.default_required}
                        onChange={(e) =>
                          setSpecFormData({
                            ...specFormData,
                            default_required: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-foreground">Required by default</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Dialog Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-gray-50">
                <button
                  type="button"
                  onClick={() => {
                    setShowSpecDialog(false);
                    resetSpecForm();
                  }}
                  className="px-4 py-2 rounded border border-border hover:bg-muted transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingSpec}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {isCreatingSpec ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
