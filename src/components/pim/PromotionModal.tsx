"use client";

import { useState, useEffect } from "react";
import { X, Tag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Promotion, PackagingOption, DiscountStep } from "@/lib/types/pim";
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

interface PromotionModalProps {
  open: boolean;
  promotion: Promotion | null; // null = create mode
  packagingPkgIds: string[]; // Which packaging(s) this promotion belongs to (by pkg_id). Empty = all.
  packagingOptions: PackagingOption[]; // Available packaging options
  defaultLanguageCode: string;
  onSave: (packagingPkgIds: string[], promotion: Promotion) => void;
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

// Build a human-readable label for a packaging option (handles duplicates)
function pkgDisplayLabel(pkg: PackagingOption, lang: string): string {
  const label = (pkg.label as Record<string, string>)?.[lang] || pkg.code;
  const tags = pkg.pricing?.tag_filter;
  const price = pkg.pricing?.retail_unit ?? pkg.pricing?.list_unit;
  let suffix = "";
  if (tags && tags.length > 0) suffix += ` [${tags.join(", ")}]`;
  else if (price !== undefined) suffix += ` [€${price.toFixed(2)}]`;
  return `${pkg.code} - ${label}${suffix}`;
}

export function PromotionModal({
  open,
  promotion,
  packagingPkgIds,
  packagingOptions,
  defaultLanguageCode,
  onSave,
  onClose,
}: PromotionModalProps) {
  const [formData, setFormData] = useState<Promotion>(emptyPromotion);
  const [selectedPkgIds, setSelectedPkgIds] = useState<string[]>(packagingPkgIds);
  const [pricingMethod, setPricingMethod] = useState<"percentage" | "amount" | "direct">("percentage");
  const [promoInputs, setPromoInputs] = useState<Record<string, string>>({});
  const [availableTags, setAvailableTags] = useState<CustomerTagEntry[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const isEditMode = promotion !== null;

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
      const promo = promotion || { ...emptyPromotion };
      setFormData(promo);
      setPromoInputs({
        discount_percentage: toDecimalInputValue(promo.discount_percentage),
        discount_amount: toDecimalInputValue(promo.discount_amount),
        promo_price: toDecimalInputValue(promo.promo_price),
      });
      setSelectedPkgIds(packagingPkgIds);

      // For pricing method detection, use first selected packaging (or first available)
      const firstId = packagingPkgIds[0] || packagingOptions[0]?.pkg_id || "";
      const pkg = packagingOptions.find((p) => p.pkg_id === firstId);
      const qty = pkg?.qty || 1;
      const unitListPrice = pkg?.pricing?.list_unit ?? (pkg?.pricing?.list ? pkg.pricing.list / qty : 0);
      const hasListPrice = unitListPrice > 0;

      // Determine pricing method from existing data
      if (!hasListPrice) {
        setPricingMethod("direct");
      } else if (promo.discount_percentage && promo.discount_percentage > 0) {
        setPricingMethod("percentage");
      } else if (promo.discount_amount && promo.discount_amount > 0) {
        setPricingMethod("amount");
      } else if (promo.promo_price && promo.promo_price > 0) {
        setPricingMethod("direct");
      } else {
        setPricingMethod("percentage");
      }
    }
  }, [open, promotion, packagingPkgIds, packagingOptions]);

  // Get the first selected packaging's pricing for price display (always use UNIT prices)
  const firstSelectedId = selectedPkgIds[0] || packagingOptions[0]?.pkg_id;
  const selectedPackaging = packagingOptions.find((p) => p.pkg_id === firstSelectedId);
  const pkgQty = selectedPackaging?.qty || 1;

  // Calculate unit prices: prefer list_unit, otherwise derive from list/qty
  const listPrice = selectedPackaging?.pricing?.list_unit
    ?? (selectedPackaging?.pricing?.list ? selectedPackaging.pricing.list / pkgQty : 0);
  // Calculate sale unit price: prefer sale_unit, otherwise derive from sale/qty
  const salePrice = selectedPackaging?.pricing?.sale_unit
    ?? (selectedPackaging?.pricing?.sale ? selectedPackaging.pricing.sale / pkgQty : undefined);
  // Use sale_price as base if available (promo stacks on sale), otherwise use list_price
  const basePrice = salePrice && salePrice > 0 ? salePrice : listPrice;
  const hasSalePrice = salePrice && salePrice > 0 && salePrice !== listPrice;

  // Auto-switch to "direct" when no list price available
  useEffect(() => {
    if (listPrice <= 0 && pricingMethod !== "direct") {
      setPricingMethod("direct");
      // Clear discount fields since they can't be used without list price
      setFormData((prev) => ({
        ...prev,
        discount_percentage: undefined,
        discount_amount: undefined,
      }));
    }
  }, [listPrice, pricingMethod]);

  // Auto-calculate promo_price when using discount methods
  useEffect(() => {
    if (basePrice <= 0) return;

    if (pricingMethod === "percentage" && formData.discount_percentage && formData.discount_percentage > 0) {
      const calculatedPrice = basePrice * (1 - formData.discount_percentage / 100);
      const roundedPrice = Math.round(Math.max(0, calculatedPrice) * 100) / 100;
      if (formData.promo_price !== roundedPrice) {
        setFormData((prev) => ({ ...prev, promo_price: roundedPrice }));
      }
    } else if (pricingMethod === "amount" && formData.discount_amount && formData.discount_amount > 0) {
      const calculatedPrice = basePrice - formData.discount_amount;
      const roundedPrice = Math.round(Math.max(0, calculatedPrice) * 100) / 100;
      if (formData.promo_price !== roundedPrice) {
        setFormData((prev) => ({ ...prev, promo_price: roundedPrice }));
      }
    }
  }, [pricingMethod, basePrice, formData.discount_percentage, formData.discount_amount, formData.promo_price]);

  // Determine if multiple packaging targets are selected (for hiding inline single-result)
  const sellablePackaging = packagingOptions.filter((p) => p.is_sellable !== false);
  const targetPackaging = selectedPkgIds.length > 0
    ? sellablePackaging.filter((p) => selectedPkgIds.includes(p.pkg_id!))
    : sellablePackaging;
  const hasMultipleTargets = targetPackaging.length > 1;

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Build structured discount_chain array
    const discountChain: DiscountStep[] = [];
    let orderNum = 1;

    if (pricingMethod === "direct") {
      // Direct net price
      discountChain.push({
        type: "net",
        source: "promo",
        order: orderNum,
      });
    } else {
      // Add sale discount step if applicable (from price_list_sale)
      if (hasSalePrice && listPrice > 0) {
        const salePct = Math.round((1 - salePrice! / listPrice) * 100);
        discountChain.push({
          type: "percentage",
          value: salePct,
          source: "price_list_sale",
          order: orderNum++,
        });
      }

      // Add promo discount step
      if (pricingMethod === "percentage" && formData.discount_percentage) {
        discountChain.push({
          type: "percentage",
          value: formData.discount_percentage,
          source: "promo",
          order: orderNum++,
        });
      } else if (pricingMethod === "amount" && formData.discount_amount) {
        discountChain.push({
          type: "amount",
          value: formData.discount_amount,
          source: "promo",
          order: orderNum++,
        });
      }
    }

    // Save with structured discount_chain
    const promoToSave = {
      ...formData,
      discount_chain: discountChain.length > 0 ? discountChain : undefined,
    };

    onSave(selectedPkgIds, promoToSave);
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updatePromoInput = (field: string, rawValue: string) => {
    const normalized = normalizeDecimalInput(rawValue);
    if (normalized === null) return;
    setPromoInputs((prev) => ({ ...prev, [field]: normalized }));
    updateField(field, parseDecimalValue(normalized));
  };

  // Switch pricing method and clear other fields
  const switchPricingMethod = (method: "percentage" | "amount" | "direct") => {
    setPricingMethod(method);
    setFormData((prev) => ({
      ...prev,
      discount_percentage: undefined,
      discount_amount: undefined,
      promo_price: undefined,
    }));
    setPromoInputs({ discount_percentage: "", discount_amount: "", promo_price: "" });
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
          {/* Packaging Selection (multi-select chips) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Packaging Options
            </label>
            <p className="text-xs text-slate-500 mb-2">
              Select which sellable packaging options this promotion applies to. Leave empty for all sellable.
            </p>

            {/* Selected packaging chips */}
            {selectedPkgIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedPkgIds.map((pkgId) => {
                  const pkg = packagingOptions.find((p) => p.pkg_id === pkgId);
                  if (!pkg) return null;
                  return (
                    <span
                      key={pkgId}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"
                    >
                      {pkgDisplayLabel(pkg, defaultLanguageCode)}
                      <button
                        type="button"
                        onClick={() => setSelectedPkgIds((prev) => prev.filter((id) => id !== pkgId))}
                        className="ml-0.5 hover:text-red-600 transition"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Add packaging dropdown */}
            <select
                value=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  if (!selectedPkgIds.includes(e.target.value)) {
                    setSelectedPkgIds((prev) => [...prev, e.target.value]);
                  }
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{selectedPkgIds.length === 0 ? "All sellable packaging options" : "Add packaging..."}</option>
                {packagingOptions
                  .filter((pkg) => pkg.is_sellable !== false && !selectedPkgIds.includes(pkg.pkg_id!))
                  .map((pkg) => (
                    <option key={pkg.pkg_id} value={pkg.pkg_id}>
                      {pkgDisplayLabel(pkg, defaultLanguageCode)}
                    </option>
                  ))}
              </select>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-3 gap-4">
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
                Row
              </label>
              <Input
                value={formData.promo_row ?? ""}
                disabled
                className="bg-slate-50 text-slate-500"
                placeholder="Auto"
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

          {/* Pricing Method - Tab Selection */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-900">Pricing Method</h4>
              {listPrice > 0 ? (
                <div className="text-xs text-right">
                  {hasSalePrice ? (
                    <>
                      <span className="text-slate-400 line-through">€{listPrice.toFixed(2)}</span>
                      <span className="ml-2 text-emerald-600 font-medium">Sale: €{salePrice!.toFixed(2)}</span>
                    </>
                  ) : (
                    <span className="text-slate-500">List: €{listPrice.toFixed(2)}</span>
                  )}
                </div>
              ) : (
                <div className="text-xs text-amber-600">No list price set</div>
              )}
            </div>

            {/* Method Tabs */}
            <div className="flex rounded-lg bg-slate-100 p-1 mb-4">
              <button
                type="button"
                onClick={() => listPrice > 0 && switchPricingMethod("percentage")}
                disabled={listPrice <= 0}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all ${
                  pricingMethod === "percentage"
                    ? "bg-white text-amber-700 shadow-sm"
                    : listPrice <= 0
                    ? "text-slate-400 cursor-not-allowed"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Discount %
              </button>
              <button
                type="button"
                onClick={() => listPrice > 0 && switchPricingMethod("amount")}
                disabled={listPrice <= 0}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all ${
                  pricingMethod === "amount"
                    ? "bg-white text-amber-700 shadow-sm"
                    : listPrice <= 0
                    ? "text-slate-400 cursor-not-allowed"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Discount €
              </button>
              <button
                type="button"
                onClick={() => switchPricingMethod("direct")}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all ${
                  pricingMethod === "direct"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Net Price
              </button>
            </div>

            {/* Active Input */}
            <div className="bg-slate-50 rounded-lg p-4">
              {pricingMethod === "percentage" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Discount Percentage
                  </label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={promoInputs.discount_percentage ?? toDecimalInputValue(formData.discount_percentage)}
                      onChange={(e) => updatePromoInput("discount_percentage", e.target.value)}
                      placeholder="e.g., 10"
                      className="text-lg"
                    />
                    <span className="text-2xl text-slate-400">%</span>
                  </div>
                  {/* Promo Price Result with Calculation Breakdown (hidden when multiple packagings targeted) */}
                  {!hasMultipleTargets && formData.discount_percentage && formData.discount_percentage > 0 && listPrice > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      {/* Calculation breakdown */}
                      <div className="text-xs text-slate-600 mb-3 font-mono bg-white rounded p-2 border border-slate-200">
                        €{listPrice.toFixed(2)}
                        {hasSalePrice && (
                          <> <span className="text-amber-600">→ -{Math.round((1 - salePrice! / listPrice) * 100)}% sale</span> → €{salePrice!.toFixed(2)}</>
                        )}
                        <span className="text-amber-600"> → -{formData.discount_percentage}% promo</span>
                        <span className="text-emerald-700 font-bold"> = €{(formData.promo_price || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          <div className="text-xs text-emerald-600 mb-1">Promo Unit Price</div>
                          <div className="text-2xl font-bold text-emerald-700">€{(formData.promo_price || 0).toFixed(2)}</div>
                        </div>
                        {selectedPackaging && selectedPackaging.qty > 1 && formData.promo_price && (
                          <div className="text-right">
                            <div className="text-xs text-slate-500 mb-1">Package ({selectedPackaging.code} × {selectedPackaging.qty})</div>
                            <div className="text-lg font-semibold text-slate-700">€{(formData.promo_price * selectedPackaging.qty).toFixed(2)}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {pricingMethod === "amount" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Discount Amount
                  </label>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl text-slate-400">€</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={promoInputs.discount_amount ?? toDecimalInputValue(formData.discount_amount)}
                      onChange={(e) => updatePromoInput("discount_amount", e.target.value)}
                      placeholder="e.g., 5.00"
                      className="text-lg"
                    />
                  </div>
                  {/* Promo Price Result with Calculation Breakdown (hidden when multiple packagings targeted) */}
                  {!hasMultipleTargets && formData.discount_amount && formData.discount_amount > 0 && listPrice > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      {/* Calculation breakdown */}
                      <div className="text-xs text-slate-600 mb-3 font-mono bg-white rounded p-2 border border-slate-200">
                        €{listPrice.toFixed(2)}
                        {hasSalePrice && (
                          <> <span className="text-amber-600">→ -{Math.round((1 - salePrice! / listPrice) * 100)}% sale</span> → €{salePrice!.toFixed(2)}</>
                        )}
                        <span className="text-amber-600"> → -€{formData.discount_amount.toFixed(2)} promo</span>
                        <span className="text-emerald-700 font-bold"> = €{(formData.promo_price || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          <div className="text-xs text-emerald-600 mb-1">Promo Unit Price</div>
                          <div className="text-2xl font-bold text-emerald-700">€{(formData.promo_price || 0).toFixed(2)}</div>
                        </div>
                        {selectedPackaging && selectedPackaging.qty > 1 && formData.promo_price && (
                          <div className="text-right">
                            <div className="text-xs text-slate-500 mb-1">Package ({selectedPackaging.code} × {selectedPackaging.qty})</div>
                            <div className="text-lg font-semibold text-slate-700">€{(formData.promo_price * selectedPackaging.qty).toFixed(2)}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {pricingMethod === "direct" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Net Price (Direct)
                  </label>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl text-slate-400">€</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={promoInputs.promo_price ?? toDecimalInputValue(formData.promo_price)}
                      onChange={(e) => updatePromoInput("promo_price", e.target.value)}
                      placeholder="e.g., 45.00"
                      className="text-lg"
                    />
                  </div>
                  {/* Result display (hidden when multiple packagings targeted) */}
                  {!hasMultipleTargets && formData.promo_price && formData.promo_price > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <div className="text-xs text-slate-500 mb-2 font-mono bg-white rounded p-2 border border-slate-200">
                        Net price (no discount calculation)
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          <div className="text-xs text-emerald-600 mb-1">Promo Unit Price</div>
                          <div className="text-2xl font-bold text-emerald-700">€{formData.promo_price.toFixed(2)}</div>
                        </div>
                        {selectedPackaging && selectedPackaging.qty > 1 && (
                          <div className="text-right">
                            <div className="text-xs text-slate-500 mb-1">Package ({selectedPackaging.code} × {selectedPackaging.qty})</div>
                            <div className="text-lg font-semibold text-slate-700">€{(formData.promo_price * selectedPackaging.qty).toFixed(2)}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Per-Packaging Price Preview */}
          {(() => {
            const sellable = packagingOptions.filter((p) => p.is_sellable !== false);
            const targets = selectedPkgIds.length > 0
              ? sellable.filter((p) => selectedPkgIds.includes(p.pkg_id!))
              : sellable;
            if (targets.length <= 1) return null; // Single-packaging preview is already shown inline
            const hasDiscount =
              (pricingMethod === "percentage" && formData.discount_percentage && formData.discount_percentage > 0) ||
              (pricingMethod === "amount" && formData.discount_amount && formData.discount_amount > 0) ||
              (pricingMethod === "direct" && formData.promo_price && formData.promo_price > 0);
            if (!hasDiscount) return null;

            return (
              <div className="bg-slate-50 rounded-lg p-4 -mt-2">
                <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Per-Packaging Preview</h4>
                <div className="space-y-1.5">
                  {targets.map((pkg) => {
                    const qty = pkg.qty || 1;
                    const pkgList = pkg.pricing?.list_unit ?? (pkg.pricing?.list ? pkg.pricing.list / qty : 0);
                    const pkgSale = pkg.pricing?.sale_unit ?? (pkg.pricing?.sale ? pkg.pricing.sale / qty : undefined);
                    const pkgBase = pkgSale && pkgSale > 0 ? pkgSale : pkgList;

                    let promoPrice: number | undefined;
                    if (pricingMethod === "percentage" && formData.discount_percentage && pkgBase > 0) {
                      promoPrice = Math.round(pkgBase * (1 - formData.discount_percentage / 100) * 100) / 100;
                    } else if (pricingMethod === "amount" && formData.discount_amount && pkgBase > 0) {
                      promoPrice = Math.round(Math.max(0, pkgBase - formData.discount_amount) * 100) / 100;
                    } else if (pricingMethod === "direct" && formData.promo_price) {
                      promoPrice = formData.promo_price;
                    }

                    return (
                      <div key={pkg.pkg_id} className="flex items-center justify-between text-xs bg-white rounded px-3 py-2 border border-slate-200">
                        <span className="text-slate-700 font-medium truncate mr-3">
                          {pkgDisplayLabel(pkg, defaultLanguageCode)}
                        </span>
                        <span className="flex-shrink-0 font-mono">
                          {pkgBase > 0 && (
                            <>
                              <span className="text-slate-400">€{pkgBase.toFixed(2)}</span>
                              {pricingMethod === "percentage" && formData.discount_percentage && (
                                <span className="text-amber-600 mx-1">-{formData.discount_percentage}%</span>
                              )}
                              {pricingMethod === "amount" && formData.discount_amount && (
                                <span className="text-amber-600 mx-1">-€{formData.discount_amount.toFixed(2)}</span>
                              )}
                              {pricingMethod !== "direct" && <span className="text-slate-400 mx-1">=</span>}
                            </>
                          )}
                          <span className="text-emerald-700 font-bold">
                            {promoPrice !== undefined ? `€${promoPrice.toFixed(2)}` : "-"}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

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

          {/* Customer Tag Filter */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Customer Tags
            </h4>
            <p className="text-xs text-slate-500 mb-3">
              Restrict this promotion to customers with specific tags. Leave empty to apply to all customers.
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
                {formData.tag_filter && formData.tag_filter.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {formData.tag_filter.map((fullTag) => {
                      const tagDef = availableTags.find((t) => t.full_tag === fullTag);
                      return (
                        <span
                          key={fullTag}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"
                        >
                          {tagDef ? `${tagDef.prefix}:${tagDef.code}` : fullTag}
                          <button
                            type="button"
                            onClick={() => {
                              const updated = (formData.tag_filter || []).filter((t) => t !== fullTag);
                              updateField("tag_filter", updated.length > 0 ? updated : undefined);
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
                    const current = formData.tag_filter || [];
                    if (!current.includes(e.target.value)) {
                      updateField("tag_filter", [...current, e.target.value]);
                    }
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Add a tag filter...</option>
                  {availableTags
                    .filter((t) => !(formData.tag_filter || []).includes(t.full_tag))
                    .map((tag) => (
                      <option key={tag.tag_id} value={tag.full_tag}>
                        {tag.full_tag}{tag.description ? ` — ${tag.description}` : ""}
                      </option>
                    ))}
                </select>
              </>
            )}
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
