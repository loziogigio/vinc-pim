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
  created_at: string;
  updated_at: string;
};

export default function TechnicalSpecificationsPage() {
  const [technicalSpecifications, setTechnicalSpecifications] = useState<TechnicalSpecification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSpec, setEditingSpec] = useState<TechnicalSpecification | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(true);

  useEffect(() => {
    fetchTechnicalSpecifications();
  }, []);

  async function fetchTechnicalSpecifications() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/b2b/pim/technical-specifications?include_inactive=true");
      if (res.ok) {
        const data = await res.json();
        setTechnicalSpecifications(data.technical_specifications);
      }
    } catch (error) {
      console.error("Error fetching technical specifications:", error);
      toast.error("Failed to load technical specifications");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(spec: TechnicalSpecification) {
    if (!confirm(`Are you sure you want to delete "${spec.label}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/b2b/pim/technical-specifications/${spec.technical_specification_id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Technical specification deleted successfully");
        fetchTechnicalSpecifications();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to delete technical specification");
      }
    } catch (error) {
      console.error("Error deleting technical specification:", error);
      toast.error("Failed to delete technical specification");
    }
  }

  // Filter specifications based on search and active status
  const filteredSpecifications = technicalSpecifications.filter((spec) => {
    const matchesSearch =
      spec.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      spec.key.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesActive = showInactive || spec.is_active;
    return matchesSearch && matchesActive;
  });

  const typeLabels: Record<string, string> = {
    text: "Text",
    number: "Number",
    select: "Select",
    multiselect: "Multi-select",
    boolean: "Boolean",
  };

  const typeColors: Record<string, string> = {
    text: "bg-blue-100 text-blue-700",
    number: "bg-emerald-100 text-emerald-700",
    select: "bg-purple-100 text-purple-700",
    multiselect: "bg-indigo-100 text-indigo-700",
    boolean: "bg-amber-100 text-amber-700",
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
            { label: "Technical Specifications" },
          ]}
        />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Technical Specifications</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {technicalSpecifications.length} total specifications
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
          >
            <Plus className="h-5 w-5" />
            New Specification
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search specifications by label or key..."
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

        {/* Specifications Table */}
        <div className="rounded-lg bg-card shadow-sm border border-border overflow-hidden">
          {filteredSpecifications.length === 0 ? (
            <div className="p-12 text-center">
              <Sliders className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {searchQuery ? "No specifications found" : "No specifications yet"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery
                  ? "Try adjusting your search query"
                  : "Create reusable technical specifications for your product types"}
              </p>
              {!searchQuery && (
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
                >
                  <Plus className="h-5 w-5" />
                  New Specification
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                      Label
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                      Key
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">
                      Type
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">
                      Unit
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">
                      Options
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredSpecifications.map((spec) => (
                    <tr
                      key={spec.technical_specification_id}
                      className={`hover:bg-muted/30 transition ${!spec.is_active ? "opacity-60" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Sliders className="h-5 w-5 text-primary flex-shrink-0" />
                          <span className="font-medium text-foreground">{spec.label}</span>
                          {spec.default_required && (
                            <span className="px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-700">
                              Required
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="px-2 py-0.5 bg-muted rounded text-xs font-mono">
                          {spec.key}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${typeColors[spec.type] || "bg-gray-100 text-gray-700"}`}>
                          {typeLabels[spec.type] || spec.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {spec.unit ? (
                          <span className="text-sm text-muted-foreground">{spec.unit}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {spec.options && spec.options.length > 0 ? (
                          <span className="text-sm text-muted-foreground">
                            {spec.options.length} option{spec.options.length !== 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {spec.is_active ? (
                          <span className="inline-flex px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingSpec(spec)}
                            className="p-2 rounded border border-border hover:bg-muted transition"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(spec)}
                            className="p-2 rounded border border-border hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingSpec) && (
        <TechnicalSpecificationModal
          specification={editingSpec}
          onClose={() => {
            setShowCreateModal(false);
            setEditingSpec(null);
          }}
          onSuccess={() => {
            setShowCreateModal(false);
            setEditingSpec(null);
            fetchTechnicalSpecifications();
          }}
        />
      )}
    </>
  );
}

// Technical Specification Create/Edit Modal Component
function TechnicalSpecificationModal({
  specification,
  onClose,
  onSuccess,
}: {
  specification: TechnicalSpecification | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    key: specification?.key || "",
    label: specification?.label || "",
    type: specification?.type || ("text" as const),
    unit: specification?.unit || "",
    options: specification?.options?.join(", ") || "",
    default_required: specification?.default_required || false,
    display_order: specification?.display_order || 0,
    is_active: specification?.is_active ?? true,
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
      const payload: Record<string, unknown> = {
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

      const url = specification
        ? `/api/b2b/pim/technical-specifications/${specification.technical_specification_id}`
        : "/api/b2b/pim/technical-specifications";

      const method = specification ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(specification ? "Specification updated successfully" : "Specification created successfully");
        onSuccess();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to save specification");
      }
    } catch (error) {
      console.error("Error saving specification:", error);
      toast.error("Failed to save specification");
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
              {specification ? "Edit Technical Specification" : "Create Technical Specification"}
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
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as "text" | "number" | "select" | "multiselect" | "boolean" })}
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
              {isSaving ? "Saving..." : specification ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
