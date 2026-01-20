"use client";

import { useState, useEffect } from "react";
import { X, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PackagingOption } from "@/lib/types/pim";

interface PackagingOptionModalProps {
  open: boolean;
  option: PackagingOption | null; // null = create mode
  defaultLanguageCode: string;
  availablePackagingCodes: string[]; // Available codes for price_ref dropdown
  onSave: (option: PackagingOption) => void;
  onClose: () => void;
}

const emptyOption: PackagingOption = {
  code: "",
  label: {},
  qty: 1,
  uom: "PZ",
  is_default: false,
  is_smallest: false,
  is_sellable: true,
  ean: "",
  position: 1,
  pricing: {
    list: undefined,
    retail: undefined,
    sale: undefined,
    price_ref: undefined,
    list_discount_pct: undefined,
    sale_discount_pct: undefined,
  },
};

export function PackagingOptionModal({
  open,
  option,
  defaultLanguageCode,
  availablePackagingCodes,
  onSave,
  onClose,
}: PackagingOptionModalProps) {
  const [formData, setFormData] = useState<PackagingOption>(emptyOption);
  const isEditMode = option !== null;

  useEffect(() => {
    if (open) {
      setFormData(option || { ...emptyOption, position: 1 });
    }
  }, [open, option]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updatePricing = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      pricing: { ...prev.pricing, [field]: value },
    }));
  };

  const updateLabel = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      label: { ...prev.label, [defaultLanguageCode]: value },
    }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-slate-200 p-6 sticky top-0 bg-white z-10">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <Package className="h-6 w-6 text-emerald-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900">
              {isEditMode ? "Edit Packaging Option" : "Add Packaging Option"}
            </h3>
            <p className="text-sm text-slate-600">
              {isEditMode ? `Editing ${option?.code}` : "Create a new packaging option"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Code <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.code}
                onChange={(e) => updateField("code", e.target.value.toUpperCase())}
                placeholder="e.g., PZ, BOX, CF"
                required
                disabled={isEditMode}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Label ({defaultLanguageCode.toUpperCase()}) <span className="text-red-500">*</span>
              </label>
              <Input
                value={(formData.label as Record<string, string>)?.[defaultLanguageCode] || ""}
                onChange={(e) => updateLabel(e.target.value)}
                placeholder="e.g., Pezzo, Scatola da 6"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Quantity <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min="1"
                value={formData.qty}
                onChange={(e) => updateField("qty", parseInt(e.target.value) || 1)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Unit of Measure <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.uom}
                onChange={(e) => updateField("uom", e.target.value.toUpperCase())}
                placeholder="e.g., PZ, CF"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                EAN Barcode
              </label>
              <Input
                value={formData.ean || ""}
                onChange={(e) => updateField("ean", e.target.value)}
                placeholder="e.g., 8001234567890"
              />
            </div>
          </div>

          {/* Flags */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_default}
                onChange={(e) => updateField("is_default", e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-700">Default Packaging</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_smallest}
                onChange={(e) => updateField("is_smallest", e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-700">Smallest Unit</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_sellable !== false}
                onChange={(e) => updateField("is_sellable", e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-700">Sellable</span>
            </label>
          </div>

          {/* Pricing */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Pricing</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  List Price
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.pricing?.list || ""}
                  onChange={(e) => updatePricing("list", e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Retail Price (MSRP)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.pricing?.retail || ""}
                  onChange={(e) => updatePricing("retail", e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Sale Price
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.pricing?.sale || ""}
                  onChange={(e) => updatePricing("sale", e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Price Reference
                </label>
                <select
                  value={formData.pricing?.price_ref || ""}
                  onChange={(e) => updatePricing("price_ref", e.target.value || undefined)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">-- None --</option>
                  {availablePackagingCodes.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  List Discount %
                </label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.pricing?.list_discount_pct || ""}
                  onChange={(e) => updatePricing("list_discount_pct", e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Sale Discount %
                </label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.pricing?.sale_discount_pct || ""}
                  onChange={(e) => updatePricing("sale_discount_pct", e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-4 border-t">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
              {isEditMode ? "Save Changes" : "Add Packaging"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
