"use client";

import { useState } from "react";
import { X, EyeOff, Eye } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

type BulkUpdateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  onUpdate: (updates: BulkUpdateData) => Promise<void>;
};

export type BulkUpdateData = {
  status?: "draft" | "published" | "archived";
  not_visible?: boolean;
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
  const { t } = useTranslation();
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
      alert(t("pages.pim.bulkUpdateModal.selectAtLeastOne"));
      return;
    }

    // Filter values to only include selected fields
    const booleanFields = new Set(["not_visible"]);
    const updates: BulkUpdateData = {};
    selectedFields.forEach((field) => {
      const value = values[field as keyof BulkUpdateData];
      // Boolean fields are always valid when selected; string fields need a truthy value
      if (booleanFields.has(field) || value) {
        (updates as Record<string, unknown>)[field] = value;
      }
    });

    if (Object.keys(updates).length === 0) {
      alert(t("pages.pim.bulkUpdate.provideValues"));
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
              {t("pages.pim.bulkUpdate.title")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("pages.pim.bulkUpdate.subtitle", { count: String(selectedCount) })}
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
            {t("pages.pim.bulkUpdate.description")}
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
                  {t("pages.pim.bulkUpdateModal.statusLabel")}
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
                  <option value="">{t("pages.pim.bulkUpdateModal.selectStatus")}</option>
                  <option value="draft">{t("pages.pim.bulkUpdateModal.draft")}</option>
                  <option value="published">{t("pages.pim.bulkUpdateModal.published")}</option>
                  <option value="archived">{t("pages.pim.bulkUpdateModal.archived")}</option>
                </select>
              )}
            </div>

            {/* Not Visible Field */}
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  id="field-not_visible"
                  checked={selectedFields.has("not_visible")}
                  onChange={() => toggleField("not_visible")}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
                <label
                  htmlFor="field-not_visible"
                  className="text-sm font-medium cursor-pointer"
                >
                  {t("pages.pim.bulkUpdate.visibility")}
                </label>
              </div>
              {selectedFields.has("not_visible") && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setValues({ ...values, not_visible: false })}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium transition ${
                      values.not_visible === false || values.not_visible === undefined
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Eye className="h-4 w-4" />
                    {t("pages.pim.bulkUpdate.visible")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setValues({ ...values, not_visible: true })}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium transition ${
                      values.not_visible === true
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <EyeOff className="h-4 w-4" />
                    {t("pages.pim.bulkUpdate.notVisible")}
                  </button>
                </div>
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
                  {t("pages.pim.bulkUpdateModal.brandNameLabel")}
                </label>
              </div>
              {selectedFields.has("brand") && (
                <input
                  type="text"
                  placeholder={t("pages.pim.bulkUpdateModal.enterBrandName")}
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
                  {t("pages.pim.bulkUpdateModal.categoryNameLabel")}
                </label>
              </div>
              {selectedFields.has("category") && (
                <input
                  type="text"
                  placeholder={t("pages.pim.bulkUpdateModal.enterCategoryName")}
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
                  {t("pages.pim.bulkUpdateModal.currencyLabel")}
                </label>
              </div>
              {selectedFields.has("currency") && (
                <input
                  type="text"
                  placeholder={t("pages.pim.bulkUpdateModal.currencyPlaceholder")}
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
            {t("common.cancel")}
          </button>
          <button
            onClick={handleUpdate}
            disabled={isUpdating || selectedFields.size === 0}
            className="px-4 py-2 rounded-md bg-primary text-white hover:bg-primary/90 text-sm font-medium transition disabled:opacity-50"
          >
            {isUpdating ? t("pages.pim.bulkUpdate.updating") : t("pages.pim.bulkUpdate.updateButton")}
          </button>
        </div>
      </div>
    </div>
  );
}
