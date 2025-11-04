"use client";

import { useState } from "react";
import { X } from "lucide-react";

type BulkUpdateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  onUpdate: (updates: BulkUpdateData) => Promise<void>;
};

export type BulkUpdateData = {
  status?: "draft" | "published" | "archived";
  brand?: string;
  category?: string;
  currency?: string;
};

export function BulkUpdateModal({
  isOpen,
  onClose,
  selectedCount,
  onUpdate,
}: BulkUpdateModalProps) {
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [values, setValues] = useState<BulkUpdateData>({});
  const [isUpdating, setIsUpdating] = useState(false);

  if (!isOpen) return null;

  const toggleField = (field: string) => {
    setSelectedFields((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(field)) {
        newSet.delete(field);
        // Clear the value when unchecking
        setValues((v) => {
          const newValues = { ...v };
          delete newValues[field as keyof BulkUpdateData];
          return newValues;
        });
      } else {
        newSet.add(field);
      }
      return newSet;
    });
  };

  const handleUpdate = async () => {
    if (selectedFields.size === 0) {
      alert("Please select at least one field to update");
      return;
    }

    // Filter values to only include selected fields
    const updates: BulkUpdateData = {};
    selectedFields.forEach((field) => {
      const value = values[field as keyof BulkUpdateData];
      if (value) {
        updates[field as keyof BulkUpdateData] = value as any;
      }
    });

    if (Object.keys(updates).length === 0) {
      alert("Please provide values for the selected fields");
      return;
    }

    setIsUpdating(true);
    try {
      await onUpdate(updates);
      // Reset form and close
      setSelectedFields(new Set());
      setValues({});
      onClose();
    } catch (error) {
      console.error("Bulk update error:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Bulk Update Products
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Update {selectedCount} selected product{selectedCount !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-md transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-sm text-muted-foreground mb-4">
            Select the fields you want to update and provide new values. The changes
            will be applied to all selected products.
          </p>

          <div className="space-y-4">
            {/* Status Field */}
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  id="field-status"
                  checked={selectedFields.has("status")}
                  onChange={() => toggleField("status")}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
                <label
                  htmlFor="field-status"
                  className="text-sm font-medium cursor-pointer"
                >
                  Status
                </label>
              </div>
              {selectedFields.has("status") && (
                <select
                  value={values.status || ""}
                  onChange={(e) =>
                    setValues({ ...values, status: e.target.value as any })
                  }
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="">Select status...</option>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              )}
            </div>

            {/* Brand Field */}
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  id="field-brand"
                  checked={selectedFields.has("brand")}
                  onChange={() => toggleField("brand")}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
                <label
                  htmlFor="field-brand"
                  className="text-sm font-medium cursor-pointer"
                >
                  Brand Name
                </label>
              </div>
              {selectedFields.has("brand") && (
                <input
                  type="text"
                  placeholder="Enter brand name"
                  value={values.brand || ""}
                  onChange={(e) =>
                    setValues({ ...values, brand: e.target.value })
                  }
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              )}
            </div>

            {/* Category Field */}
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  id="field-category"
                  checked={selectedFields.has("category")}
                  onChange={() => toggleField("category")}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
                <label
                  htmlFor="field-category"
                  className="text-sm font-medium cursor-pointer"
                >
                  Category Name
                </label>
              </div>
              {selectedFields.has("category") && (
                <input
                  type="text"
                  placeholder="Enter category name"
                  value={values.category || ""}
                  onChange={(e) =>
                    setValues({ ...values, category: e.target.value })
                  }
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              )}
            </div>

            {/* Currency Field */}
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  id="field-currency"
                  checked={selectedFields.has("currency")}
                  onChange={() => toggleField("currency")}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
                <label
                  htmlFor="field-currency"
                  className="text-sm font-medium cursor-pointer"
                >
                  Currency
                </label>
              </div>
              {selectedFields.has("currency") && (
                <input
                  type="text"
                  placeholder="e.g. USD, EUR"
                  value={values.currency || ""}
                  onChange={(e) =>
                    setValues({ ...values, currency: e.target.value.toUpperCase() })
                  }
                  maxLength={3}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
          <button
            onClick={onClose}
            disabled={isUpdating}
            className="px-4 py-2 rounded-md border border-border hover:bg-muted text-sm font-medium transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdate}
            disabled={isUpdating || selectedFields.size === 0}
            className="px-4 py-2 rounded-md bg-primary text-white hover:bg-primary/90 text-sm font-medium transition disabled:opacity-50"
          >
            {isUpdating ? "Updating..." : "Update Products"}
          </button>
        </div>
      </div>
    </div>
  );
}
