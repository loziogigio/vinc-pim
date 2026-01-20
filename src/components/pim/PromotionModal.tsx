"use client";

import { useState, useEffect } from "react";
import { X, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Promotion, PackagingOption } from "@/lib/types/pim";

interface PromotionModalProps {
  open: boolean;
  promotion: Promotion | null; // null = create mode
  packagingCode: string; // Which packaging this promotion belongs to
  packagingOptions: PackagingOption[]; // Available packaging options
  defaultLanguageCode: string;
  onSave: (packagingCode: string, promotion: Promotion) => void;
  onClose: () => void;
}

const emptyPromotion: Promotion = {
  promo_code: "",
  is_active: true,
  promo_type: "STD",
  label: {},
  discount_percentage: undefined,
  discount_amount: undefined,
  promo_price: undefined,
  min_quantity: undefined,
  is_stackable: false,
  priority: 1,
  start_date: undefined,
  end_date: undefined,
};

export function PromotionModal({
  open,
  promotion,
  packagingCode,
  packagingOptions,
  defaultLanguageCode,
  onSave,
  onClose,
}: PromotionModalProps) {
  const [formData, setFormData] = useState<Promotion>(emptyPromotion);
  const [selectedPackagingCode, setSelectedPackagingCode] = useState(packagingCode);
  const isEditMode = promotion !== null;

  useEffect(() => {
    if (open) {
      setFormData(promotion || { ...emptyPromotion });
      setSelectedPackagingCode(packagingCode || packagingOptions[0]?.code || "");
    }
  }, [open, promotion, packagingCode, packagingOptions]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(selectedPackagingCode, formData);
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateLabel = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      label: { ...prev.label, [defaultLanguageCode]: value },
    }));
  };

  const formatDateForInput = (date: Date | string | undefined) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toISOString().split("T")[0];
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-slate-200 p-6 sticky top-0 bg-white z-10">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
            <Tag className="h-6 w-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900">
              {isEditMode ? "Edit Promotion" : "Add Promotion"}
            </h3>
            <p className="text-sm text-slate-600">
              {isEditMode ? `Editing ${promotion?.promo_code}` : "Create a new promotion for a packaging option"}
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
          {/* Packaging Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Packaging Option <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedPackagingCode}
              onChange={(e) => setSelectedPackagingCode(e.target.value)}
              disabled={isEditMode}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              required
            >
              {packagingOptions.map((pkg) => (
                <option key={pkg.code} value={pkg.code}>
                  {pkg.code} - {(pkg.label as Record<string, string>)?.[defaultLanguageCode] || pkg.code}
                </option>
              ))}
            </select>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Promo Code <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.promo_code || ""}
                onChange={(e) => updateField("promo_code", e.target.value.toUpperCase())}
                placeholder="e.g., SUMMER-SALE"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Promo Type
              </label>
              <select
                value={formData.promo_type || "STD"}
                onChange={(e) => updateField("promo_type", e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="STD">Standard (STD)</option>
                <option value="EOL">End of Life (EOL)</option>
                <option value="BREVE-SCAD">Short Expiry</option>
                <option value="OMG">OMG Deal</option>
                <option value="XXX">Special</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Label ({defaultLanguageCode.toUpperCase()}) <span className="text-red-500">*</span>
            </label>
            <Input
              value={(formData.label as Record<string, string>)?.[defaultLanguageCode] || ""}
              onChange={(e) => updateLabel(e.target.value)}
              placeholder="e.g., Sconto quantità, Offerta speciale"
              required
            />
          </div>

          {/* Discount */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Discount</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Discount %
                </label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.discount_percentage || ""}
                  onChange={(e) => updateField("discount_percentage", e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="e.g., 10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Discount Amount
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.discount_amount || ""}
                  onChange={(e) => updateField("discount_amount", e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="e.g., 5.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Promo Price
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.promo_price || ""}
                  onChange={(e) => updateField("promo_price", e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="e.g., 99.00"
                />
              </div>
            </div>
          </div>

          {/* Conditions */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Conditions</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Minimum Quantity
                </label>
                <Input
                  type="number"
                  min="1"
                  value={formData.min_quantity || ""}
                  onChange={(e) => updateField("min_quantity", e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="e.g., 3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Priority
                </label>
                <Input
                  type="number"
                  min="1"
                  value={formData.priority || 1}
                  onChange={(e) => updateField("priority", parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Validity Period</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Start Date
                </label>
                <Input
                  type="date"
                  value={formatDateForInput(formData.start_date)}
                  onChange={(e) => updateField("start_date", e.target.value ? new Date(e.target.value) : undefined)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  End Date
                </label>
                <Input
                  type="date"
                  value={formatDateForInput(formData.end_date)}
                  onChange={(e) => updateField("end_date", e.target.value ? new Date(e.target.value) : undefined)}
                />
              </div>
            </div>
          </div>

          {/* Flags */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => updateField("is_active", e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm text-slate-700">Active</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_stackable || false}
                onChange={(e) => updateField("is_stackable", e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm text-slate-700">Stackable with other promotions</span>
            </label>
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-4 border-t">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1 bg-amber-600 hover:bg-amber-700 text-white">
              {isEditMode ? "Save Changes" : "Add Promotion"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
