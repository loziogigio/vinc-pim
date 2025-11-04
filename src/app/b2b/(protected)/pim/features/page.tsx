"use client";

import { useState, useEffect } from "react";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import {
  Sliders,
  Plus,
  Edit2,
  Trash2,
  Search,
  Filter,
} from "lucide-react";
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
  created_at: string;
  updated_at: string;
};

export default function FeaturesPage() {
  const [features, setFeatures] = useState<TechnicalFeature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingFeature, setEditingFeature] = useState<TechnicalFeature | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(true);

  useEffect(() => {
    fetchFeatures();
  }, []);

  async function fetchFeatures() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/b2b/pim/features?include_inactive=true");
      if (res.ok) {
        const data = await res.json();
        setFeatures(data.features);
      }
    } catch (error) {
      console.error("Error fetching features:", error);
      toast.error("Failed to load features");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(feature: TechnicalFeature) {
    if (!confirm(`Are you sure you want to delete "${feature.label}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/b2b/pim/features/${feature.feature_id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Feature deleted successfully");
        fetchFeatures();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to delete feature");
      }
    } catch (error) {
      console.error("Error deleting feature:", error);
      toast.error("Failed to delete feature");
    }
  }

  // Filter features based on search and active status
  const filteredFeatures = features.filter((feat) => {
    const matchesSearch =
      feat.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      feat.key.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesActive = showInactive || feat.is_active;
    return matchesSearch && matchesActive;
  });

  // Group features by type
  const groupedFeatures = filteredFeatures.reduce((acc, feat) => {
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
    <>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Product Information Management", href: "/b2b/pim" },
            { label: "Features" },
          ]}
        />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Features</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {features.length} total features
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
          >
            <Plus className="h-5 w-5" />
            New Feature
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search features by label or key..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowInactive(!showInactive)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition ${
              showInactive
                ? "border-border bg-background"
                : "border-primary bg-primary/10 text-primary"
            }`}
            title="Filter"
          >
            <Filter className="h-5 w-5" />
            {!showInactive && "Active only"}
          </button>
        </div>

        {/* Features List */}
        <div className="space-y-4">
          {filteredFeatures.length === 0 ? (
            <div className="rounded-lg bg-card shadow-sm border border-border p-12 text-center">
              <Sliders className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {searchQuery ? "No features found" : "No features yet"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery
                  ? "Try adjusting your search query"
                  : "Create reusable features for your product types"}
              </p>
              {!searchQuery && (
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
                >
                  <Plus className="h-5 w-5" />
                  Create Feature
                </button>
              )}
            </div>
          ) : (
            Object.entries(groupedFeatures).map(([type, typeFeatures]) => (
              <div key={type} className="rounded-lg bg-card shadow-sm border border-border overflow-hidden">
                <div className="px-4 py-3 bg-muted/50 border-b border-border">
                  <h3 className="font-semibold text-foreground">
                    {typeLabels[type]} ({typeFeatures.length})
                  </h3>
                </div>
                <div className="p-2">
                  {typeFeatures.map((feature) => (
                    <div
                      key={feature.feature_id}
                      className={`flex items-center gap-3 p-3 rounded-lg border border-border mb-2 hover:shadow-sm transition ${
                        !feature.is_active ? "opacity-60" : ""
                      }`}
                    >
                      <Sliders className="h-8 w-8 text-primary flex-shrink-0" />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-foreground">{feature.label}</h4>
                          {feature.default_required && (
                            <span className="px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-700">
                              Required by default
                            </span>
                          )}
                          {!feature.is_active && (
                            <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <code className="px-2 py-0.5 bg-muted rounded text-xs font-mono">
                            {feature.key}
                          </code>
                          {feature.unit && (
                            <span className="text-xs">Unit: {feature.unit}</span>
                          )}
                          {feature.options && feature.options.length > 0 && (
                            <span className="text-xs">
                              {feature.options.length} option{feature.options.length !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        {feature.options && feature.options.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {feature.options.slice(0, 5).map((opt, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs"
                              >
                                {opt}
                              </span>
                            ))}
                            {feature.options.length > 5 && (
                              <span className="px-2 py-0.5 bg-gray-50 text-gray-600 rounded text-xs">
                                +{feature.options.length - 5} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingFeature(feature)}
                          className="flex items-center gap-2 px-3 py-2 rounded border border-border hover:bg-muted transition text-sm"
                        >
                          <Edit2 className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(feature)}
                          className="px-3 py-2 rounded border border-border hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingFeature) && (
        <FeatureModal
          feature={editingFeature}
          onClose={() => {
            setShowCreateModal(false);
            setEditingFeature(null);
          }}
          onSuccess={() => {
            setShowCreateModal(false);
            setEditingFeature(null);
            fetchFeatures();
          }}
        />
      )}
    </>
  );
}

// Feature Create/Edit Modal Component
function FeatureModal({
  feature,
  onClose,
  onSuccess,
}: {
  feature: TechnicalFeature | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    key: feature?.key || "",
    label: feature?.label || "",
    type: feature?.type || ("text" as const),
    unit: feature?.unit || "",
    options: feature?.options?.join(", ") || "",
    default_required: feature?.default_required || false,
    display_order: feature?.display_order || 0,
    is_active: feature?.is_active ?? true,
  });

  const [isSaving, setIsSaving] = useState(false);

  function generateKey(label: string) {
    return label
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);

    try {
      const payload: any = {
        key: formData.key,
        label: formData.label,
        type: formData.type,
        unit: formData.unit || undefined,
        options:
          formData.type === "select" || formData.type === "multiselect"
            ? formData.options.split(",").map((o) => o.trim()).filter(Boolean)
            : undefined,
        default_required: formData.default_required,
        display_order: formData.display_order,
        is_active: formData.is_active,
      };

      const url = feature
        ? `/api/b2b/pim/features/${feature.feature_id}`
        : "/api/b2b/pim/features";

      const method = feature ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(feature ? "Feature updated successfully" : "Feature created successfully");
        onSuccess();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to save feature");
      }
    } catch (error) {
      console.error("Error saving feature:", error);
      toast.error("Failed to save feature");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-xl font-bold text-foreground">
              {feature ? "Edit Feature" : "Create Feature"}
            </h2>
          </div>

          {/* Body */}
          <div className="px-6 py-4 space-y-4">
            {/* Label & Key */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Label *
                </label>
                <input
                  type="text"
                  required
                  value={formData.label}
                  onChange={(e) => {
                    const label = e.target.value;
                    setFormData({
                      ...formData,
                      label,
                      key: formData.key || generateKey(label),
                    });
                  }}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  placeholder="Diameter"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Key * <span className="text-muted-foreground text-xs">(unique identifier)</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none font-mono"
                  placeholder="diameter"
                />
              </div>
            </div>

            {/* Type & Unit */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="select">Select</option>
                  <option value="multiselect">Multi-select</option>
                  <option value="boolean">Boolean</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Unit <span className="text-muted-foreground text-xs">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  placeholder="mm, kg, bar..."
                />
              </div>
            </div>

            {/* Options for select/multiselect */}
            {(formData.type === "select" || formData.type === "multiselect") && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Options * <span className="text-muted-foreground text-xs">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.options}
                  onChange={(e) => setFormData({ ...formData, options: e.target.value })}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  placeholder="Option 1, Option 2, Option 3"
                />
              </div>
            )}

            {/* Display Order */}
            <div className="w-48">
              <label className="block text-sm font-medium text-foreground mb-1">
                Display Order
              </label>
              <input
                type="number"
                value={formData.display_order}
                onChange={(e) =>
                  setFormData({ ...formData, display_order: parseInt(e.target.value) })
                }
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>

            {/* Default Required & Active Status */}
            <div className="space-y-2 pt-3 border-t border-border">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="default_required"
                  checked={formData.default_required}
                  onChange={(e) => setFormData({ ...formData, default_required: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="default_required" className="text-sm text-foreground">
                  Required by default (when added to product types)
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="is_active" className="text-sm text-foreground">
                  Active (available for selection)
                </label>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded border border-border hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition disabled:opacity-50"
            >
              {isSaving ? "Saving..." : feature ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
