"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import {
  ArrowLeft,
  Save,
  Database,
  Settings,
  FileText,
  TrendingUp,
  Package,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { PIM_PRODUCT_SCHEMA, FIELD_CATEGORIES, type PIMFieldCategory } from "@/lib/pim/schema";

type ImportSource = {
  _id: string;
  source_id: string;
  source_name: string;
  source_type: string;
  // wholesaler_id removed - database per wholesaler provides isolation
  field_mappings: Record<string, string>;
  auto_publish_enabled: boolean;
  min_score_threshold: number;
  required_fields: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  stats: {
    total_imports: number;
    total_products: number;
    last_import_at?: string;
    last_import_status?: string;
  };
};

type Statistics = {
  total_products: number;
  published_products: number;
  draft_products: number;
};

export default function SourceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sourceId = params?.source_id as string;

  const [source, setSource] = useState<ImportSource | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Edit form state (for basic settings only, not mappings)
  const [editData, setEditData] = useState({
    source_name: "",
    auto_publish_enabled: false,
    min_score_threshold: 70,
    required_fields: [] as string[],
    overwrite_level: "automatic" as "automatic" | "manual",
  });

  // Field mapping editor state
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["core", "pricing", "inventory"])
  );
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<{ supplierField: string; pimField: string }>({ supplierField: "", pimField: "" });
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isNewFieldRequired, setIsNewFieldRequired] = useState(false);

  useEffect(() => {
    fetchSource();
  }, [sourceId]);

  async function fetchSource() {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/b2b/pim/sources/${sourceId}`);
      if (res.ok) {
        const data = await res.json();
        setSource(data.source);
        setStatistics(data.statistics);
        setEditData({
          source_name: data.source.source_name,
          auto_publish_enabled: data.source.auto_publish_enabled,
          min_score_threshold: data.source.min_score_threshold,
          required_fields: data.source.required_fields || [],
          overwrite_level: data.source.overwrite_level || "automatic",
        });
      } else {
        router.push("/b2b/pim/sources");
      }
    } catch (error) {
      console.error("Error fetching source:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/b2b/pim/sources/${sourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });

      if (res.ok) {
        await fetchSource();
        setIsEditing(false);
      } else {
        const error = await res.json();
        alert(error.error || "Failed to save changes");
      }
    } catch (error) {
      console.error("Error saving source:", error);
      alert("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  }

  // Field mapping helper functions - per-row operations
  function startEditingRow(supplierField: string, pimField: string) {
    setEditingRow(supplierField);
    setEditingData({ supplierField, pimField });
  }

  function cancelEditingRow() {
    setEditingRow(null);
    setEditingData({ supplierField: "", pimField: "" });
    setIsAddingNew(false);
    setIsNewFieldRequired(false);
  }

  async function saveFieldMapping(oldSupplierField: string) {
    if (!editingData.supplierField.trim() || !editingData.pimField.trim()) {
      alert("Both supplier field and PIM field are required");
      return;
    }

    try {
      const newMappings = { ...source?.field_mappings };

      // Remove old key if field name changed
      if (oldSupplierField && oldSupplierField !== editingData.supplierField) {
        delete newMappings[oldSupplierField];
      }

      // Add new/updated mapping
      newMappings[editingData.supplierField] = editingData.pimField;

      // Handle required fields when adding new mapping
      let newRequiredFields = source?.required_fields || [];
      if (isAddingNew && isNewFieldRequired && !newRequiredFields.includes(editingData.pimField)) {
        newRequiredFields = [...newRequiredFields, editingData.pimField];
      }

      const updateData: any = { field_mappings: newMappings };
      if (isAddingNew && isNewFieldRequired) {
        updateData.required_fields = newRequiredFields;
      }

      const res = await fetch(`/api/b2b/pim/sources/${sourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (res.ok) {
        await fetchSource();
        cancelEditingRow();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to save mapping");
      }
    } catch (error) {
      console.error("Error saving mapping:", error);
      alert("Failed to save mapping");
    }
  }

  async function deleteFieldMapping(supplierField: string) {
    if (!confirm(`Delete mapping for "${supplierField}"?`)) return;

    try {
      const newMappings = { ...source?.field_mappings };
      delete newMappings[supplierField];

      const res = await fetch(`/api/b2b/pim/sources/${sourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field_mappings: newMappings }),
      });

      if (res.ok) {
        await fetchSource();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to delete mapping");
      }
    } catch (error) {
      console.error("Error deleting mapping:", error);
      alert("Failed to delete mapping");
    }
  }

  function toggleCategory(category: string) {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-96 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  if (!source) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Product Information Management", href: "/b2b/pim" },
          { label: "Import Sources", href: "/b2b/pim/sources" },
          { label: source.source_name },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/b2b/pim/sources")}
            className="p-2 rounded border border-border hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-foreground">
                {source.source_name}
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                {source.source_type.toUpperCase()}
              </span>
              {source.is_active ? (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" />
                  Active
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                  <XCircle className="h-3 w-3" />
                  Inactive
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Source ID: <span className="font-mono">{source.source_id}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditData({
                    source_name: source.source_name,
                    auto_publish_enabled: source.auto_publish_enabled,
                    min_score_threshold: source.min_score_threshold,
                    required_fields: source.required_fields || [],
                  });
                }}
                className="px-4 py-2 rounded border border-border hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Settings className="h-4 w-4" />
              Edit Source
            </button>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-lg bg-card p-4 shadow-sm border">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded bg-blue-100 text-blue-600">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold">{statistics.total_products}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-card p-4 shadow-sm border">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Published</p>
                <p className="text-2xl font-bold">{statistics.published_products}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-card p-4 shadow-sm border">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded bg-amber-100 text-amber-600">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Drafts</p>
                <p className="text-2xl font-bold">{statistics.draft_products}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-card p-4 shadow-sm border">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded bg-purple-100 text-purple-600">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Imports</p>
                <p className="text-2xl font-bold">{source.stats.total_imports}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Settings */}
        <div className="rounded-lg bg-card p-6 shadow-sm border">
          <h2 className="text-lg font-semibold mb-4">Basic Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Source Name</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.source_name}
                  onChange={(e) =>
                    setEditData({ ...editData, source_name: e.target.value })
                  }
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              ) : (
                <p className="text-sm text-muted-foreground">{source.source_name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Source Type</label>
              <p className="text-sm text-muted-foreground uppercase">{source.source_type}</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Wholesaler ID</label>
              {/* wholesaler_id removed - database per wholesaler provides isolation */}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Created At</label>
              <p className="text-sm text-muted-foreground">
                {new Date(source.created_at).toLocaleString()}
              </p>
            </div>

            {source.stats.last_import_at && (
              <div>
                <label className="block text-sm font-medium mb-1">Last Import</label>
                <p className="text-sm text-muted-foreground">
                  {new Date(source.stats.last_import_at).toLocaleString()}
                  {source.stats.last_import_status && (
                    <span className="ml-2 px-2 py-0.5 rounded text-xs bg-muted">
                      {source.stats.last_import_status}
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Auto-Publish Settings */}
        <div className="rounded-lg bg-card p-6 shadow-sm border">
          <h2 className="text-lg font-semibold mb-4">Auto-Publish Settings</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {isEditing ? (
                <input
                  type="checkbox"
                  id="auto_publish"
                  checked={editData.auto_publish_enabled}
                  onChange={(e) =>
                    setEditData({ ...editData, auto_publish_enabled: e.target.checked })
                  }
                  className="rounded border-border"
                />
              ) : (
                <span className="text-sm text-muted-foreground">Status:</span>
              )}
              <label htmlFor="auto_publish" className="text-sm font-medium">
                {isEditing
                  ? "Enable auto-publish"
                  : source.auto_publish_enabled
                  ? "Enabled"
                  : "Disabled"}
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Quality Score Threshold
              </label>
              {isEditing ? (
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={editData.min_score_threshold}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      min_score_threshold: parseInt(e.target.value),
                    })
                  }
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {source.min_score_threshold}%
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Products with score above this will auto-publish
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Conflict Resolution
              </label>
              {isEditing ? (
                <select
                  value={editData.overwrite_level}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      overwrite_level: e.target.value as "automatic" | "manual",
                    })
                  }
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="automatic">Automatic (API always overwrites)</option>
                  <option value="manual">Manual (Protect manual edits)</option>
                </select>
              ) : (
                <p className="text-sm text-muted-foreground capitalize">
                  {source.overwrite_level || "automatic"}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {editData.overwrite_level === "automatic"
                  ? "API updates will always overwrite manual edits without creating conflicts"
                  : "Manual edits will be protected - conflicts created when API tries to update them"}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Required Fields</label>
              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={editData.required_fields.join(", ")}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        required_fields: e.target.value
                          .split(",")
                          .map((f) => f.trim())
                          .filter(Boolean),
                      })
                    }
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    rows={3}
                    placeholder="name, sku, price, image"
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated list of required field names
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {source.required_fields.map((field) => (
                    <span
                      key={field}
                      className="px-2 py-1 rounded text-xs bg-muted text-muted-foreground font-mono"
                    >
                      {field}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Field Mappings - Always Visible with Inline Editing */}
        <div className="rounded-lg bg-card p-6 shadow-sm border lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Field Mappings</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {Object.keys(source.field_mappings || {}).length} mappings configured.
                Fields not listed use 1:1 mapping.
              </p>
            </div>
            <button
              onClick={() => {
                setIsAddingNew(true);
                setEditingData({ supplierField: "", pimField: "" });
              }}
              className="flex items-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Add Mapping
            </button>
          </div>

          <div className="mb-4 p-3 rounded bg-blue-50 border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Mapping Rules:</strong> Only add mappings when your supplier uses different field names than the PIM standard.
              Unmapped fields automatically use 1:1 mapping (supplier field = PIM field).
            </p>
            <p className="text-sm text-blue-800 mt-2">
              <strong>Required Fields:</strong> <span className="px-1 py-0.5 rounded text-xs bg-purple-600 text-white">schema required</span> fields (entity_code, sku, name) cannot be unmarked.
              Use the &quot;Required&quot; checkbox to mark additional fields as <span className="px-1 py-0.5 rounded text-xs bg-red-600 text-white">required</span> for this supplier.
            </p>
          </div>

          {/* Mappings List */}
          <div className="space-y-2">
            {/* Existing Mappings */}
            {Object.entries(source.field_mappings || {}).map(([supplierField, pimField]) => {
              const isEditing = editingRow === supplierField;
              const isOneToOne = supplierField === pimField;

              if (isEditing) {
                // Edit mode for this row
                return (
                  <div key={supplierField} className="flex items-center gap-2 p-3 rounded border border-primary bg-blue-50">
                    <input
                      type="text"
                      value={editingData.supplierField}
                      onChange={(e) => setEditingData({ ...editingData, supplierField: e.target.value })}
                      placeholder="Supplier field name"
                      className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none font-mono"
                    />
                    <span className="text-muted-foreground">→</span>
                    <select
                      value={editingData.pimField}
                      onChange={(e) => setEditingData({ ...editingData, pimField: e.target.value })}
                      className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none font-mono"
                    >
                      <option value="">Select PIM field...</option>
                      {FIELD_CATEGORIES.map(category => (
                        <optgroup key={category.key} label={category.label}>
                          {PIM_PRODUCT_SCHEMA.filter(f => f.category === category.key).map(field => (
                            <option key={field.name} value={field.name}>
                              {field.name} ({field.type})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <button
                      onClick={() => saveFieldMapping(supplierField)}
                      className="p-2 rounded bg-green-600 text-white hover:bg-green-700"
                      title="Save"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                    <button
                      onClick={cancelEditingRow}
                      className="p-2 rounded border border-border hover:bg-muted"
                      title="Cancel"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                );
              }

              // View mode for this row
              const schemaField = PIM_PRODUCT_SCHEMA.find(f => f.name === pimField);
              const isSchemaRequired = schemaField?.required === true;
              const isUserRequired = source.required_fields?.includes(pimField);
              const isRequired = isSchemaRequired || isUserRequired;

              return (
                <div
                  key={supplierField}
                  className={`flex items-center gap-2 p-3 rounded border ${
                    isOneToOne ? 'bg-gray-50 border-gray-200' : 'bg-amber-50 border-amber-200'
                  }`}
                >
                  <span className="font-mono text-sm flex-1">{supplierField}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-mono text-sm font-medium flex-1">{pimField}</span>
                  {!isOneToOne && (
                    <span className="px-2 py-0.5 rounded text-xs bg-amber-600 text-white">
                      custom
                    </span>
                  )}
                  {isOneToOne && (
                    <span className="px-2 py-0.5 rounded text-xs bg-gray-400 text-white">
                      1:1
                    </span>
                  )}
                  {isSchemaRequired && (
                    <span className="px-2 py-0.5 rounded text-xs bg-purple-600 text-white">
                      schema required
                    </span>
                  )}
                  {!isSchemaRequired && isRequired && (
                    <span className="px-2 py-0.5 rounded text-xs bg-red-600 text-white">
                      required
                    </span>
                  )}
                  <label className={`flex items-center gap-1 ${isSchemaRequired ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`} title={isSchemaRequired ? "Schema-level required field (cannot be changed)" : "Toggle required"}>
                    <input
                      type="checkbox"
                      checked={isRequired}
                      disabled={isSchemaRequired}
                      onChange={async (e) => {
                        if (isSchemaRequired) return;

                        const newRequiredFields = e.target.checked
                          ? [...(source.required_fields || []), pimField]
                          : (source.required_fields || []).filter(f => f !== pimField);

                        try {
                          const res = await fetch(`/api/b2b/pim/sources/${sourceId}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ required_fields: newRequiredFields }),
                          });

                          if (res.ok) {
                            await fetchSource();
                          }
                        } catch (error) {
                          console.error("Error updating required fields:", error);
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="text-xs text-muted-foreground">Required</span>
                  </label>
                  <button
                    onClick={() => startEditingRow(supplierField, pimField)}
                    className="p-2 rounded border border-border hover:bg-muted"
                    title="Edit"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteFieldMapping(supplierField)}
                    className="p-2 rounded border border-border hover:bg-red-50 hover:border-red-200 text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}

            {/* Add New Row */}
            {isAddingNew && (
              <div className="flex items-center gap-2 p-3 rounded border-2 border-dashed border-primary bg-blue-50">
                <input
                  type="text"
                  value={editingData.supplierField}
                  onChange={(e) => setEditingData({ ...editingData, supplierField: e.target.value })}
                  placeholder="Supplier field name"
                  className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none font-mono"
                />
                <span className="text-muted-foreground">→</span>
                <select
                  value={editingData.pimField}
                  onChange={(e) => setEditingData({ ...editingData, pimField: e.target.value })}
                  className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none font-mono"
                >
                  <option value="">Select PIM field...</option>
                  {FIELD_CATEGORIES.map(category => (
                    <optgroup key={category.key} label={category.label}>
                      {PIM_PRODUCT_SCHEMA.filter(f => f.category === category.key).map(field => (
                        <option key={field.name} value={field.name}>
                          {field.name} ({field.type})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap" title="Mark as required field">
                  <input
                    type="checkbox"
                    checked={isNewFieldRequired}
                    onChange={(e) => setIsNewFieldRequired(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-xs text-muted-foreground">Required</span>
                </label>
                <button
                  onClick={() => saveFieldMapping("")}
                  className="p-2 rounded bg-green-600 text-white hover:bg-green-700"
                  title="Save"
                >
                  <Save className="h-4 w-4" />
                </button>
                <button
                  onClick={cancelEditingRow}
                  className="p-2 rounded border border-border hover:bg-muted"
                  title="Cancel"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Empty State */}
            {Object.keys(source.field_mappings || {}).length === 0 && !isAddingNew && (
              <div className="text-center py-12 text-muted-foreground">
                <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">No custom field mappings configured.</p>
                <p className="text-xs mt-1">All fields will use 1:1 mapping by default.</p>
              </div>
            )}
          </div>

          {/* PIM Schema Reference - Collapsible */}
          <div className="border-t mt-6 pt-6">
            <h3 className="text-sm font-medium mb-3">PIM Product Schema Reference</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Click on categories to view available PIM fields and their descriptions
            </p>
            <div className="space-y-2">
              {FIELD_CATEGORIES.map(category => {
                const categoryFields = PIM_PRODUCT_SCHEMA.filter(f => f.category === category.key);
                const isExpanded = expandedCategories.has(category.key);

                return (
                  <div key={category.key} className="border rounded overflow-hidden">
                    <button
                      onClick={() => toggleCategory(category.key)}
                      className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 text-left"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="font-medium">{category.label}</span>
                        <span className="text-xs text-muted-foreground">
                          ({categoryFields.length} fields)
                        </span>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="p-3 space-y-2 bg-card">
                        {categoryFields.map(field => (
                          <div key={field.name} className="flex items-start gap-3 p-2 rounded hover:bg-muted/30">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono text-sm font-medium">{field.name}</span>
                                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  {field.type}
                                </span>
                                {field.required && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                                    required
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{field.description}</p>
                              {field.example && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Example: <span className="font-mono">{field.example}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
