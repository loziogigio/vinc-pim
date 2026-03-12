"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Save,
  ArrowLeft,
  Percent,
  Euro,
  Calendar,
  Hash,
  Users,
  Clock,
  X,
  Search,
} from "lucide-react";
import {
  COUPON_STATUS_LABELS,
  COUPON_DISCOUNT_TYPE_LABELS,
} from "@/lib/constants/coupon";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import type { ICoupon } from "@/lib/db/models/coupon";
import {
  normalizeDecimalInput,
  parseDecimalValue,
  toDecimalInputValue,
} from "@/lib/utils/decimal-input";
import { useTranslation } from "@/lib/i18n/useTranslation";

export default function CouponDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const tenantMatch = pathname?.match(/^\/([^/]+)\/b2b/);
  const tenantPrefix = tenantMatch ? `/${tenantMatch[1]}` : "";

  // Extract coupon_id from path
  const couponIdMatch = pathname?.match(/\/coupons\/([^/]+)$/);
  const couponId = couponIdMatch?.[1] || "";

  const [coupon, setCoupon] = useState<ICoupon | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState<"details" | "usage">("details");

  // Editable fields
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">(
    "percentage"
  );
  const [discountValueInput, setDiscountValueInput] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [maxUsesPerCustomer, setMaxUsesPerCustomer] = useState("");
  const [includeShipping, setIncludeShipping] = useState(false);
  const [isCumulative, setIsCumulative] = useState(true);
  const [minOrderAmountInput, setMinOrderAmountInput] = useState("");
  const [maxOrderAmountInput, setMaxOrderAmountInput] = useState("");
  const [maxDiscountAmountInput, setMaxDiscountAmountInput] = useState("");
  const [notes, setNotes] = useState("");

  // Channel
  const [channel, setChannel] = useState("");
  const [channels, setChannels] = useState<{ code: string; name: string }[]>(
    []
  );

  // Customer restriction
  interface CustomerTag {
    email: string;
    company_name?: string;
  }
  const [customers, setCustomers] = useState<CustomerTag[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerTag[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch channels
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/b2b/b2c/storefronts?limit=50");
        const data = await res.json();
        const items = data.items || [];
        setChannels(
          items.map((s: any) => ({
            code: s.channel,
            name: s.name || s.channel,
          }))
        );
      } catch {
        // ignore
      }
    })();
  }, []);

  const searchCustomers = async (query: string) => {
    if (query.length < 2) {
      setCustomerResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(
        `/api/b2b/customers?search=${encodeURIComponent(query)}&limit=5`
      );
      const data = await res.json();
      const results: CustomerTag[] = (data.customers || [])
        .filter(
          (c: any) =>
            c.email && !customers.some((t) => t.email === c.email)
        )
        .map((c: any) => ({
          email: c.email,
          company_name: c.company_name || "",
        }));
      setCustomerResults(results);
    } catch {
      setCustomerResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const addCustomer = (c: CustomerTag) => {
    if (!customers.some((t) => t.email === c.email)) {
      setCustomers((prev) => [...prev, c]);
    }
    setCustomerSearch("");
    setCustomerResults([]);
  };

  const addCustomerByEmail = (email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (trimmed && trimmed.includes("@") && !customers.some((c) => c.email === trimmed)) {
      setCustomers((prev) => [...prev, { email: trimmed }]);
      setCustomerSearch("");
      setCustomerResults([]);
    }
  };

  const removeCustomer = (email: string) => {
    setCustomers((prev) => prev.filter((c) => c.email !== email));
  };

  const fetchCoupon = useCallback(async () => {
    if (!couponId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/b2b/coupons/${couponId}`);
      const data = await res.json();
      if (data.success && data.coupon) {
        const c = data.coupon as ICoupon;
        setCoupon(c);
        setLabel(c.label || "");
        setDescription(c.description || "");
        setDiscountType(c.discount_type);
        setDiscountValueInput(toDecimalInputValue(c.discount_value));
        setStartDate(
          c.start_date
            ? new Date(c.start_date).toISOString().split("T")[0]
            : ""
        );
        setEndDate(
          c.end_date ? new Date(c.end_date).toISOString().split("T")[0] : ""
        );
        setMaxUses(c.max_uses ? String(c.max_uses) : "");
        setMaxUsesPerCustomer(
          c.max_uses_per_customer ? String(c.max_uses_per_customer) : ""
        );
        setIncludeShipping(c.include_shipping);
        setIsCumulative(c.is_cumulative);
        setMinOrderAmountInput(
          c.min_order_amount ? toDecimalInputValue(c.min_order_amount) : ""
        );
        setMaxOrderAmountInput(
          c.max_order_amount ? toDecimalInputValue(c.max_order_amount) : ""
        );
        setMaxDiscountAmountInput(
          c.max_discount_amount
            ? toDecimalInputValue(c.max_discount_amount)
            : ""
        );
        setNotes(c.notes || "");
        setChannel((c as any).channel || "");

        // Load customer emails
        if ((c as any).customer_emails && (c as any).customer_emails.length > 0) {
          setCustomers(
            (c as any).customer_emails.map((email: string) => ({ email }))
          );
        }
      }
    } catch (err) {
      console.error("Error fetching coupon:", err);
    } finally {
      setIsLoading(false);
    }
  }, [couponId]);

  useEffect(() => {
    fetchCoupon();
  }, [fetchCoupon]);

  const handleDecimalChange = (
    rawValue: string,
    setter: (v: string) => void
  ) => {
    const normalized = normalizeDecimalInput(rawValue);
    if (normalized === null) return;
    setter(normalized);
  };

  const handleSave = async () => {
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const discountValue = parseDecimalValue(discountValueInput);
      if (!discountValue || discountValue <= 0) {
        setError(t("pages.store.couponDetail.errorInvalidDiscount"));
        setIsSaving(false);
        return;
      }

      const body: Record<string, unknown> = {
        channel: channel || undefined,
        label: label.trim() || undefined,
        description: description || undefined,
        discount_type: discountType,
        discount_value: discountValue,
        include_shipping: includeShipping,
        is_cumulative: isCumulative,
        notes: notes.trim() || undefined,
        customer_emails: customers.map((c) => c.email),
      };

      if (startDate) {
        body.start_date = new Date(startDate).toISOString();
      }
      if (endDate) {
        body.end_date = new Date(endDate).toISOString();
      }
      if (maxUses) body.max_uses = parseInt(maxUses);
      if (maxUsesPerCustomer)
        body.max_uses_per_customer = parseInt(maxUsesPerCustomer);

      const minOrderAmount = parseDecimalValue(minOrderAmountInput);
      if (minOrderAmount) body.min_order_amount = minOrderAmount;

      const maxOrderAmount = parseDecimalValue(maxOrderAmountInput);
      if (maxOrderAmount) body.max_order_amount = maxOrderAmount;

      const maxDiscountAmount = parseDecimalValue(maxDiscountAmountInput);
      if (maxDiscountAmount) body.max_discount_amount = maxDiscountAmount;

      const res = await fetch(`/api/b2b/coupons/${couponId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || t("pages.store.couponDetail.errorSave"));
        return;
      }

      setSuccess(t("pages.store.couponDetail.successUpdated"));
      fetchCoupon();
    } catch (err) {
      setError(t("pages.store.couponDetail.errorNetwork"));
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDateTime = (d?: string | Date) => {
    if (!d) return "-";
    return new Date(d).toLocaleString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    inactive: "bg-gray-100 text-gray-600",
    expired: "bg-red-100 text-red-700",
    depleted: "bg-amber-100 text-amber-800",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-[#b9b9c3]">
        {t("pages.store.couponDetail.loading")}
      </div>
    );
  }

  if (!coupon) {
    return (
      <div className="flex items-center justify-center py-24 text-red-500">
        {t("pages.store.couponDetail.couponNotFound")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Store", href: "/b2b/store" },
          { label: t("pages.store.coupons.title"), href: "/b2b/store/coupons" },
          { label: coupon.code },
        ]}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold font-mono text-[#5e5873]">
            {coupon.code}
          </h1>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[coupon.status] || ""}`}
          >
            {COUPON_STATUS_LABELS[coupon.status]}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("pages.store.couponDetail.back")}
          </Button>
          <Button
            className="bg-[#009688] hover:bg-[#00796b] text-white"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? t("pages.store.couponDetail.saving") : t("pages.store.couponDetail.save")}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#ebe9f1]">
        <button
          onClick={() => setActiveTab("details")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === "details"
              ? "border-[#009688] text-[#009688]"
              : "border-transparent text-[#6e6b7b] hover:text-[#5e5873]"
          }`}
        >
          {t("pages.store.couponDetail.details")}
        </button>
        <button
          onClick={() => setActiveTab("usage")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === "usage"
              ? "border-[#009688] text-[#009688]"
              : "border-transparent text-[#6e6b7b] hover:text-[#5e5873]"
          }`}
        >
          {t("pages.store.couponDetail.usageHistory")} ({coupon.usage_count})
        </button>
      </div>

      {activeTab === "details" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Core info */}
          <div className="space-y-6">
            <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
              <h2 className="text-lg font-semibold text-[#5e5873] mb-4">
                {t("pages.store.couponDetail.information")}
              </h2>
              <div className="space-y-4">
                <div>
                  <Label>{t("pages.store.couponDetail.channelRequired")}</Label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className="w-full rounded-md border border-[#ebe9f1] px-3 py-2 text-sm bg-white"
                  >
                    <option value="">{t("pages.store.couponDetail.selectChannel")}</option>
                    {channels.map((ch) => (
                      <option key={ch.code} value={ch.code}>
                        {ch.name} ({ch.code})
                      </option>
                    ))}
                    {/* Show current channel even if not in list */}
                    {channel &&
                      !channels.some((ch) => ch.code === channel) && (
                        <option value={channel}>{channel}</option>
                      )}
                  </select>
                </div>
                <div>
                  <Label>{t("pages.store.couponDetail.label")}</Label>
                  <Input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t("pages.store.couponDetail.descriptionInternal")}</Label>
                  <RichTextEditor
                    content={description}
                    onChange={setDescription}
                    placeholder={t("pages.store.couponDetail.descriptionPlaceholder")}
                    minHeight="150px"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
              <h2 className="text-lg font-semibold text-[#5e5873] mb-4">
                {t("pages.store.couponDetail.discountSection")}
              </h2>
              <div className="space-y-4">
                <div>
                  <Label>{t("pages.store.couponDetail.discountType")}</Label>
                  <select
                    value={discountType}
                    onChange={(e) =>
                      setDiscountType(
                        e.target.value as "percentage" | "fixed"
                      )
                    }
                    className="w-full rounded-md border border-[#ebe9f1] px-3 py-2 text-sm bg-white"
                  >
                    <option value="percentage">{t("pages.store.couponDetail.percentage")}</option>
                    <option value="fixed">{t("pages.store.couponDetail.fixedValue")}</option>
                  </select>
                </div>
                <div>
                  <Label>
                    {t("pages.store.couponDetail.value")}{" "}
                    {discountType === "percentage" ? "(%)" : "(EUR)"}
                  </Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={discountValueInput}
                    onChange={(e) =>
                      handleDecimalChange(
                        e.target.value,
                        setDiscountValueInput
                      )
                    }
                  />
                </div>
                <div>
                  <Label>{t("pages.store.couponDetail.maxDiscount")}</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={maxDiscountAmountInput}
                    onChange={(e) =>
                      handleDecimalChange(
                        e.target.value,
                        setMaxDiscountAmountInput
                      )
                    }
                    placeholder={t("pages.store.couponDetail.noLimitPlaceholder")}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="includeShipping"
                    checked={includeShipping}
                    onChange={(e) => setIncludeShipping(e.target.checked)}
                    className="rounded border-[#ebe9f1]"
                  />
                  <Label htmlFor="includeShipping" className="cursor-pointer">
                    {t("pages.store.couponDetail.applyToShipping")}
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isCumulative"
                    checked={isCumulative}
                    onChange={(e) => setIsCumulative(e.target.checked)}
                    className="rounded border-[#ebe9f1]"
                  />
                  <Label htmlFor="isCumulative" className="cursor-pointer">
                    {t("pages.store.couponDetail.cumulativeWithOthers")}
                  </Label>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Limits & validity */}
          <div className="space-y-6">
            <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
              <h2 className="text-lg font-semibold text-[#5e5873] mb-4">
                {t("pages.store.couponDetail.validitySection")}
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t("pages.store.couponDetail.startDate")}</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>{t("pages.store.couponDetail.endDate")}</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t("pages.store.couponDetail.maxUses")}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={maxUses}
                      onChange={(e) => setMaxUses(e.target.value)}
                      placeholder={t("pages.store.couponDetail.unlimitedPlaceholder")}
                    />
                  </div>
                  <div>
                    <Label>{t("pages.store.couponDetail.maxPerCustomer")}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={maxUsesPerCustomer}
                      onChange={(e) => setMaxUsesPerCustomer(e.target.value)}
                      placeholder={t("pages.store.couponDetail.unlimitedPlaceholder")}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
              <h2 className="text-lg font-semibold text-[#5e5873] mb-4">
                {t("pages.store.couponDetail.orderThresholds")}
              </h2>
              <div className="space-y-4">
                <div>
                  <Label>{t("pages.store.couponDetail.minOrderAmount")}</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={minOrderAmountInput}
                    onChange={(e) =>
                      handleDecimalChange(
                        e.target.value,
                        setMinOrderAmountInput
                      )
                    }
                    placeholder={t("pages.store.couponDetail.noMinimumPlaceholder")}
                  />
                </div>
                <div>
                  <Label>{t("pages.store.couponDetail.maxOrderAmount")}</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={maxOrderAmountInput}
                    onChange={(e) =>
                      handleDecimalChange(
                        e.target.value,
                        setMaxOrderAmountInput
                      )
                    }
                    placeholder={t("pages.store.couponDetail.noMaximumPlaceholder")}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
              <h2 className="text-lg font-semibold text-[#5e5873] mb-4 flex items-center gap-2">
                <Users className="h-4 w-4" />
                {t("pages.store.couponDetail.authorizedCustomers")}
              </h2>
              <p className="text-xs text-[#b9b9c3] mb-3">
                {t("pages.store.couponDetail.authorizedCustomersHint")}
              </p>
              <div className="relative">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-[#b9b9c3]" />
                  <Input
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      searchCustomers(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomerByEmail(customerSearch);
                      }
                    }}
                    placeholder={t("pages.store.couponDetail.searchOrTypeEmail")}
                    className="flex-1"
                  />
                </div>
                {customerResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-[#ebe9f1] bg-white shadow-lg max-h-48 overflow-auto">
                    {customerResults.map((c) => (
                      <button
                        key={c.email}
                        type="button"
                        onClick={() => addCustomer(c)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-[#f8f8f8] border-b border-[#ebe9f1] last:border-0"
                      >
                        <span className="font-medium">{c.email}</span>
                        {c.company_name && (
                          <span className="text-[#b9b9c3] ml-2">
                            ({c.company_name})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {isSearching && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-[#ebe9f1] bg-white shadow-lg p-3 text-sm text-[#b9b9c3]">
                    {t("pages.store.couponDetail.searching")}
                  </div>
                )}
              </div>
              {customers.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {customers.map((c) => (
                    <span
                      key={c.email}
                      className="inline-flex items-center gap-1 rounded-full bg-[#e0f2f1] px-3 py-1 text-xs text-[#00796b]"
                    >
                      {c.email}
                      {c.company_name && (
                        <span className="text-[#b9b9c3]">
                          ({c.company_name})
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeCustomer(c.email)}
                        className="ml-1 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
              <h2 className="text-lg font-semibold text-[#5e5873] mb-4">
                {t("pages.store.couponDetail.internalNotes")}
              </h2>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-md border border-[#ebe9f1] px-3 py-2 text-sm resize-none"
                rows={3}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === "usage" && (
        <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] overflow-hidden">
          {coupon.usage_history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[#b9b9c3]">
              <Clock className="h-12 w-12 mb-3 opacity-40" />
              <p>{t("pages.store.couponDetail.noUsageRecorded")}</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#ebe9f1] bg-[#fafafc]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e5873] uppercase">
                    {t("pages.store.couponDetail.orderCol")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e5873] uppercase">
                    {t("pages.store.couponDetail.customerCol")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e5873] uppercase">
                    {t("pages.store.couponDetail.discountApplied")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e5873] uppercase">
                    {t("pages.store.couponDetail.dateCol")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {coupon.usage_history.map((usage, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-[#ebe9f1] hover:bg-[#fafafc]"
                  >
                    <td className="px-4 py-3 text-sm font-mono text-[#009688]">
                      {usage.order_id}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#6e6b7b]">
                      {usage.customer_id || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-[#5e5873]">
                      EUR {usage.discount_amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#6e6b7b]">
                      {formatDateTime(usage.used_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
