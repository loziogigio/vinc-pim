"use client";

import { useState, useEffect } from "react";
import { X, Package, Tag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PackagingOption } from "@/lib/types/pim";
import { nanoid } from "nanoid";
import {
  calculatePackagePrice,
  calculateUnitPrice,
  formatPrice,
  syncPackagePrices,
} from "@/lib/utils/packaging";
import {
  normalizeDecimalInput,
  parseDecimalValue,
  toDecimalInputValue,
} from "@/lib/utils/decimal-input";

interface CustomerTagEntry {
  tag_id: string;
  full_tag: string;
  prefix: string;
  code: string;
  description?: string;
  color?: string;
}

interface PackagingOptionModalProps {
  open: boolean;
  option: PackagingOption | null; // null = create mode
  defaultValues?: PackagingOption | null; // Pre-fill values for duplicate (create mode with data)
  defaultLanguageCode: string;
  availablePackagingCodes: string[]; // Available codes for price_ref dropdown
  allPackagingOptions: PackagingOption[]; // Full packaging options for reference price lookup
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
    // Unit prices (per piece)
    list_unit: undefined,
    retail_unit: undefined,
    sale_unit: undefined,
    // Package prices (calculated)
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
  defaultValues,
  defaultLanguageCode,
  availablePackagingCodes,
  allPackagingOptions,
  onSave,
  onClose,
}: PackagingOptionModalProps) {
  const [formData, setFormData] = useState<PackagingOption>(emptyOption);
  const [qtyInput, setQtyInput] = useState("1"); // Separate string state for qty input
  const [pricingInputs, setPricingInputs] = useState<Record<string, string>>({});
  const [availableTags, setAvailableTags] = useState<CustomerTagEntry[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const isEditMode = option !== null;

  // Fetch customer tags when modal opens
  useEffect(() => {
    if (open && availableTags.length === 0) {
      setTagsLoading(true);
      fetch("/api/b2b/customer-tags")
        .then((res) => res.ok ? res.json() : null)
        .then((data) => { if (data?.tags) setAvailableTags(data.tags); })
        .catch(() => {})
        .finally(() => setTagsLoading(false));
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      // Use option for edit mode, or defaultValues for duplicate mode
      const source = option || defaultValues;
      if (source) {
        setQtyInput(String(source.qty));
        // Migrate existing data: if we have package prices but no unit prices, calculate them
        const pricing = source.pricing || {};
        const migratedPricing = {
          ...pricing,
          // Calculate unit prices from package prices if not set
          list_unit:
            pricing.list_unit ??
            calculateUnitPrice(pricing.list, source.qty),
          retail_unit:
            pricing.retail_unit ??
            calculateUnitPrice(pricing.retail, source.qty),
          sale_unit:
            pricing.sale_unit ??
            calculateUnitPrice(pricing.sale, source.qty),
        };
        // For duplicate mode (no option, has defaultValues), clear the code and pkg_id so user enters a new one
        const code = option ? source.code : "";
        const pkg_id = option ? source.pkg_id : undefined;
        setFormData({ ...source, code, pkg_id, pricing: migratedPricing });
        // Initialize string inputs from pricing values
        setPricingInputs({
          list_unit: toDecimalInputValue(migratedPricing.list_unit),
          retail_unit: toDecimalInputValue(migratedPricing.retail_unit),
          sale_unit: toDecimalInputValue(migratedPricing.sale_unit),
          list_discount_pct: toDecimalInputValue(pricing.list_discount_pct),
          sale_discount_pct: toDecimalInputValue(pricing.sale_discount_pct),
        });
      } else {
        setQtyInput("1");
        setFormData({ ...emptyOption, position: 1 });
        setPricingInputs({});
      }
    }
  }, [open, option, defaultValues]);

  if (!open) return null;

  // Parse qty from input string, default to 1 if invalid
  const parsedQty = parseFloat(qtyInput) || 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Use parsed qty value and sync package prices
    const finalData = { ...formData, qty: parsedQty };
    // Generate pkg_id for new packaging options (create or duplicate)
    if (!isEditMode) {
      finalData.pkg_id = nanoid(8);
    }
    const syncedPricing = syncPackagePrices(finalData.pricing, parsedQty);
    onSave({ ...finalData, pricing: syncedPricing });
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

  // Get retail_unit for discount calculations
  // If price_ref points to another packaging, use that; otherwise use current form's retail_unit
  const getRefRetailUnit = (): number | undefined => {
    const refCode = formData.pricing?.price_ref;
    if (!refCode || refCode === formData.code) {
      return formData.pricing?.retail_unit;
    }
    const refPkg = allPackagingOptions.find((p) => p.code === refCode);
    return refPkg?.pricing?.retail_unit;
  };

  const updatePricingInput = (field: string, rawValue: string) => {
    const normalized = normalizeDecimalInput(rawValue);
    if (normalized === null) return;
    setPricingInputs((prev) => ({ ...prev, [field]: normalized }));
    const numValue = parseDecimalValue(normalized);

    const refRetail = getRefRetailUnit();

    // Bi-directional: list_discount_pct → list_unit, cascade to sale_unit
    if (field === "list_discount_pct" && numValue !== undefined && refRetail && refRetail > 0) {
      const calcListUnit = Math.round(refRetail * (1 - numValue / 100) * 100) / 100;
      const saleDiscountPct = formData.pricing?.sale_discount_pct;
      const calcSaleUnit = saleDiscountPct !== undefined && calcListUnit > 0
        ? Math.round(calcListUnit * (1 - saleDiscountPct / 100) * 100) / 100
        : formData.pricing?.sale_unit;
      setPricingInputs((prev) => ({
        ...prev,
        list_unit: toDecimalInputValue(calcListUnit),
        ...(calcSaleUnit !== undefined ? { sale_unit: toDecimalInputValue(calcSaleUnit) } : {}),
      }));
      setFormData((prev) => ({
        ...prev,
        pricing: {
          ...prev.pricing,
          list_discount_pct: numValue,
          list_unit: calcListUnit,
          ...(calcSaleUnit !== undefined ? { sale_unit: calcSaleUnit } : {}),
        },
      }));
      return;
    }

    // Bi-directional: list_unit → list_discount_pct, cascade to sale_unit
    if (field === "list_unit" && numValue !== undefined && refRetail && refRetail > 0) {
      const calcDiscountPct = Math.round((1 - numValue / refRetail) * 10000) / 100;
      const saleDiscountPct = formData.pricing?.sale_discount_pct;
      const calcSaleUnit = saleDiscountPct !== undefined && numValue > 0
        ? Math.round(numValue * (1 - saleDiscountPct / 100) * 100) / 100
        : formData.pricing?.sale_unit;
      setPricingInputs((prev) => ({
        ...prev,
        list_discount_pct: toDecimalInputValue(calcDiscountPct),
        ...(calcSaleUnit !== undefined ? { sale_unit: toDecimalInputValue(calcSaleUnit) } : {}),
      }));
      setFormData((prev) => ({
        ...prev,
        pricing: {
          ...prev.pricing,
          list_unit: numValue,
          list_discount_pct: calcDiscountPct,
          ...(calcSaleUnit !== undefined ? { sale_unit: calcSaleUnit } : {}),
        },
      }));
      return;
    }

    // Bi-directional: sale_discount_pct → sale_unit (based on list_unit)
    if (field === "sale_discount_pct" && numValue !== undefined) {
      const listUnit = formData.pricing?.list_unit;
      if (listUnit && listUnit > 0) {
        const calcSaleUnit = Math.round(listUnit * (1 - numValue / 100) * 100) / 100;
        setPricingInputs((prev) => ({ ...prev, sale_unit: toDecimalInputValue(calcSaleUnit) }));
        setFormData((prev) => ({
          ...prev,
          pricing: { ...prev.pricing, sale_discount_pct: numValue, sale_unit: calcSaleUnit },
        }));
        return;
      }
    }

    // Bi-directional: sale_unit → sale_discount_pct (based on list_unit)
    if (field === "sale_unit" && numValue !== undefined) {
      const listUnit = formData.pricing?.list_unit;
      if (listUnit && listUnit > 0) {
        const calcDiscountPct = Math.round((1 - numValue / listUnit) * 10000) / 100;
        setPricingInputs((prev) => ({ ...prev, sale_discount_pct: toDecimalInputValue(calcDiscountPct) }));
        setFormData((prev) => ({
          ...prev,
          pricing: { ...prev.pricing, sale_unit: numValue, sale_discount_pct: calcDiscountPct },
        }));
        return;
      }
    }

    // When retail_unit changes, recalculate list_unit from discount and cascade to sale_unit
    if (field === "retail_unit" && numValue !== undefined && numValue > 0) {
      const discountPct = formData.pricing?.list_discount_pct;
      if (discountPct !== undefined) {
        const calcListUnit = Math.round(numValue * (1 - discountPct / 100) * 100) / 100;
        const saleDiscountPct = formData.pricing?.sale_discount_pct;
        const calcSaleUnit = saleDiscountPct !== undefined && calcListUnit > 0
          ? Math.round(calcListUnit * (1 - saleDiscountPct / 100) * 100) / 100
          : formData.pricing?.sale_unit;
        setPricingInputs((prev) => ({
          ...prev,
          list_unit: toDecimalInputValue(calcListUnit),
          ...(calcSaleUnit !== undefined ? { sale_unit: toDecimalInputValue(calcSaleUnit) } : {}),
        }));
        setFormData((prev) => ({
          ...prev,
          pricing: {
            ...prev.pricing,
            retail_unit: numValue,
            list_unit: calcListUnit,
            ...(calcSaleUnit !== undefined ? { sale_unit: calcSaleUnit } : {}),
          },
        }));
        return;
      }
    }

    // Default: just update the field
    updatePricing(field, numValue);
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
              {isEditMode ? "Edit Packaging Option" : defaultValues ? "Duplicate Packaging Option" : "Add Packaging Option"}
            </h3>
            <p className="text-sm text-slate-600">
              {isEditMode ? `Editing ${option?.code}` : defaultValues ? `Duplicating from ${defaultValues.code}` : "Create a new packaging option"}
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
                type="text"
                inputMode="decimal"
                value={qtyInput}
                onChange={(e) => setQtyInput(e.target.value)}
                placeholder="e.g., 1, 6, 0.75"
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

            {/* Row 1: Price Reference + Retail (Unit) */}
            <div className="grid grid-cols-2 gap-4">
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
                  Retail (Unit)
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={pricingInputs.retail_unit ?? toDecimalInputValue(formData.pricing?.retail_unit ?? formData.pricing?.retail)}
                  onChange={(e) => updatePricingInput("retail_unit", e.target.value)}
                  placeholder="0.00"
                />
                {parsedQty !== 1 && formData.pricing?.retail_unit && (
                  <p className="text-xs text-emerald-600 mt-1">
                    Pkg: {formatPrice(calculatePackagePrice(formData.pricing.retail_unit, parsedQty))}
                  </p>
                )}
              </div>
            </div>

            {/* Row 2: List Discount % + List (Unit) */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  List Discount %
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={pricingInputs.list_discount_pct ?? toDecimalInputValue(formData.pricing?.list_discount_pct)}
                  onChange={(e) => updatePricingInput("list_discount_pct", e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  List (Unit)
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={pricingInputs.list_unit ?? toDecimalInputValue(formData.pricing?.list_unit ?? formData.pricing?.list)}
                  onChange={(e) => updatePricingInput("list_unit", e.target.value)}
                  placeholder="0.00"
                />
                {parsedQty !== 1 && formData.pricing?.list_unit && (
                  <p className="text-xs text-emerald-600 mt-1">
                    Pkg: {formatPrice(calculatePackagePrice(formData.pricing.list_unit, parsedQty))}
                  </p>
                )}
              </div>
            </div>

            {/* Row 3: Sale Discount % + Sale (Unit) */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Sale Discount %
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={pricingInputs.sale_discount_pct ?? toDecimalInputValue(formData.pricing?.sale_discount_pct)}
                  onChange={(e) => updatePricingInput("sale_discount_pct", e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Sale (Unit)
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={pricingInputs.sale_unit ?? toDecimalInputValue(formData.pricing?.sale_unit ?? formData.pricing?.sale)}
                  onChange={(e) => updatePricingInput("sale_unit", e.target.value)}
                  placeholder="0.00"
                />
                {parsedQty !== 1 && formData.pricing?.sale_unit && (
                  <p className="text-xs text-emerald-600 mt-1">
                    Pkg: {formatPrice(calculatePackagePrice(formData.pricing.sale_unit, parsedQty))}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Customer Tag Filter */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Customer Tags
            </h4>
            <p className="text-xs text-slate-500 mb-3">
              Restrict this pricing to customers with specific tags. Leave empty to apply to all customers.
            </p>

            {tagsLoading ? (
              <div className="flex items-center gap-2 py-3 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading tags...
              </div>
            ) : availableTags.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">No customer tags defined yet.</p>
            ) : (
              <>
                {/* Selected tags */}
                {formData.pricing?.tag_filter && formData.pricing.tag_filter.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {formData.pricing.tag_filter.map((fullTag) => {
                      const tagDef = availableTags.find((t) => t.full_tag === fullTag);
                      return (
                        <span
                          key={fullTag}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
                        >
                          {tagDef ? `${tagDef.prefix}:${tagDef.code}` : fullTag}
                          <button
                            type="button"
                            onClick={() => {
                              const updated = (formData.pricing?.tag_filter || []).filter((t) => t !== fullTag);
                              updatePricing("tag_filter", updated.length > 0 ? updated : undefined);
                            }}
                            className="ml-0.5 hover:text-red-600 transition"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Tag selector */}
                <select
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const current = formData.pricing?.tag_filter || [];
                    if (!current.includes(e.target.value)) {
                      updatePricing("tag_filter", [...current, e.target.value]);
                    }
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Add a tag filter...</option>
                  {availableTags
                    .filter((t) => !(formData.pricing?.tag_filter || []).includes(t.full_tag))
                    .map((tag) => (
                      <option key={tag.tag_id} value={tag.full_tag}>
                        {tag.full_tag}{tag.description ? ` — ${tag.description}` : ""}
                      </option>
                    ))}
                </select>
              </>
            )}
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
