"use client";

import { useState } from "react";
import Link from "next/link";
import { Ticket, X, Search, Loader2, Check, Percent, Euro, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { Order } from "@/lib/types/order";
import type { CouponValidationResult } from "@/lib/types/coupon";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface CouponCardProps {
  order: Order;
  onCouponChange: () => void;
  tenantPrefix?: string;
}

export function CouponCard({ order, onCouponChange, tenantPrefix = "" }: CouponCardProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [validation, setValidation] = useState<CouponValidationResult | null>(null);

  const canModify = order.status === "draft" || order.status === "quotation";
  const hasCoupon = !!order.coupon_code;
  const currency = order.currency || "EUR";

  const fmt = (amount: number) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(amount);

  // Find the coupon discount in cart_discounts
  const couponDiscount = order.cart_discounts?.find((d) => d.reason === "coupon");

  const handleValidate = async () => {
    if (!code.trim()) return;
    setIsValidating(true);
    setValidation(null);
    try {
      const res = await fetch("/api/b2b/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), order_id: order.order_id }),
      });
      const data = await res.json();
      setValidation(data);
    } catch {
      toast.error(t("pages.store.couponCard.errorValidating"));
    } finally {
      setIsValidating(false);
    }
  };

  const handleApply = async () => {
    if (!code.trim()) return;
    setIsApplying(true);
    try {
      const res = await fetch(`/api/b2b/orders/${order.order_id}/coupon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t("pages.store.couponCard.couponApplied", { code: code.toUpperCase(), discount: fmt(data.discount_applied) }));
        setCode("");
        setValidation(null);
        onCouponChange();
      } else {
        toast.error(data.error || t("pages.store.couponCard.errorApplying"));
      }
    } catch {
      toast.error(t("pages.store.couponCard.errorApplying"));
    } finally {
      setIsApplying(false);
    }
  };

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      const res = await fetch(`/api/b2b/orders/${order.order_id}/coupon`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t("pages.store.couponCard.couponRemoved"));
        onCouponChange();
      } else {
        toast.error(data.error || t("pages.store.couponCard.errorRemoving"));
      }
    } catch {
      toast.error(t("pages.store.couponCard.errorRemoving"));
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="rounded-lg bg-card shadow-sm border border-border">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Ticket className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">{t("pages.store.couponCard.title")}</h2>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {hasCoupon ? (
          <>
            {/* Applied coupon info */}
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600" />
                <div>
                  <span className="font-mono font-semibold text-emerald-800 text-sm">
                    {order.coupon_code}
                  </span>
                  {couponDiscount && (
                    <p className="text-xs text-emerald-600">
                      {couponDiscount.description} &mdash; {fmt(couponDiscount.value)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {order.coupon_id && (
                  <Link
                    href={`${tenantPrefix}/b2b/store/coupons/${order.coupon_id}`}
                    className="p-1 rounded hover:bg-emerald-100 transition"
                    title={t("pages.store.couponCard.couponDetails")}
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-emerald-600" />
                  </Link>
                )}
                {canModify && (
                  <button
                    onClick={handleRemove}
                    disabled={isRemoving}
                    className="p-1 rounded hover:bg-red-100 transition"
                    title={t("pages.store.couponCard.removeCoupon")}
                  >
                    {isRemoving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-red-500" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-red-500" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </>
        ) : canModify ? (
          <>
            {/* Apply coupon form */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={t("pages.store.couponCard.codePlaceholder")}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setValidation(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (validation?.valid) {
                      handleApply();
                    } else {
                      handleValidate();
                    }
                  }
                }}
                className="flex-1 px-3 py-2 text-sm font-mono border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 uppercase"
              />
              {validation?.valid ? (
                <button
                  onClick={handleApply}
                  disabled={isApplying}
                  className="px-3 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {isApplying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </button>
              ) : (
                <button
                  onClick={handleValidate}
                  disabled={isValidating || !code.trim()}
                  className="px-3 py-2 text-sm font-medium bg-muted text-foreground rounded-lg hover:bg-muted/80 transition disabled:opacity-50"
                >
                  {isValidating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>

            {/* Validation result */}
            {validation && (
              <div
                className={`rounded-lg px-3 py-2 text-sm ${
                  validation.valid
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                    : "bg-red-50 border border-red-200 text-red-700"
                }`}
              >
                {validation.valid && validation.coupon ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {validation.coupon.discount_type === "percentage" ? (
                        <Percent className="h-3.5 w-3.5" />
                      ) : (
                        <Euro className="h-3.5 w-3.5" />
                      )}
                      <span className="font-medium">
                        {validation.coupon.discount_type === "percentage"
                          ? `${validation.coupon.discount_value}%`
                          : fmt(validation.coupon.discount_value)}
                      </span>
                      {validation.coupon.label && (
                        <span className="text-emerald-600"> &mdash; {validation.coupon.label}</span>
                      )}
                    </div>
                    <span className="font-semibold">
                      -{fmt(validation.coupon.estimated_discount)}
                    </span>
                  </div>
                ) : (
                  <span>{validation.error}</span>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("pages.store.couponCard.noCouponApplied")}</p>
        )}
      </div>
    </div>
  );
}
