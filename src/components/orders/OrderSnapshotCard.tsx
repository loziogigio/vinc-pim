"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import Link from "next/link";
import {
  User,
  MapPin,
  FileText,
  Building2,
  Store,
  ExternalLink,
  ChevronDown,
  Globe,
  Receipt,
} from "lucide-react";
import type { Order } from "@/lib/types/order";

interface OrderSnapshotCardProps {
  order: Order;
  /** Link to customer profile page (B2B only) */
  customerProfileUrl?: string;
}

/** Renders a single address snapshot block */
function AddressBlock({
  label,
  icon: Icon,
  snapshot,
}: {
  label: string;
  icon: typeof MapPin;
  snapshot: Order["shipping_snapshot"];
}) {
  if (!snapshot) return null;

  return (
    <div className="border-t border-border pt-3 space-y-1">
      <div className="flex items-center gap-1 mb-1">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-semibold text-muted-foreground uppercase">
          {label}
        </p>
      </div>
      <div className="text-sm space-y-0.5">
        <p className="font-medium">{snapshot.recipient_name}</p>
        <p>{snapshot.street_address}</p>
        {snapshot.street_address_2 && <p>{snapshot.street_address_2}</p>}
        <p>
          {snapshot.postal_code} {snapshot.city} ({snapshot.province})
        </p>
        <p>{snapshot.country}</p>
      </div>
      {snapshot.phone && (
        <p className="text-xs text-muted-foreground">Tel: {snapshot.phone}</p>
      )}
    </div>
  );
}

const TYPE_STYLES: Record<
  string,
  { bg: string; text: string; icon?: typeof Building2 }
> = {
  business: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    icon: Building2,
  },
  reseller: { bg: "bg-amber-100", text: "text-amber-700", icon: Store },
  private: { bg: "bg-purple-100", text: "text-purple-700" },
};

export function OrderSnapshotCard({
  order,
  customerProfileUrl,
}: OrderSnapshotCardProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const buyer = order.buyer;
  const shipping = order.shipping_snapshot;
  const billing = order.billing_snapshot;
  const fiscal = order.invoice_data;

  // Nothing to show if no snapshots exist
  const hasAnyData = buyer || shipping || billing || fiscal;
  if (!hasAnyData) return null;

  const buyerName = buyer
    ? `${buyer.first_name} ${buyer.last_name}`.trim()
    : null;
  const typeStyle = buyer?.customer_type
    ? TYPE_STYLES[buyer.customer_type] || TYPE_STYLES.private
    : null;
  const TypeIcon = typeStyle?.icon;

  const hasFiscal =
    fiscal &&
    (fiscal.vat_number ||
      fiscal.fiscal_code ||
      fiscal.pec_email ||
      fiscal.sdi_code);

  // Channel display
  const channelLabel =
    order.channel && order.channel !== "default" ? order.channel : null;

  // Invoice request status
  const invoiceLabel = order.invoice_requested
    ? buyer?.customer_type === "business" || buyer?.customer_type === "reseller"
      ? t("pages.store.orderSnapshotCard.invoiceCompany")
      : t("pages.store.orderSnapshotCard.invoicePrivate")
    : null;

  // Summary line for collapsed state
  const summaryParts: string[] = [];
  if (buyer?.company_name) summaryParts.push(buyer.company_name);
  else if (buyerName) summaryParts.push(buyerName);
  if (buyer?.email) summaryParts.push(buyer.email);

  return (
    <div className="rounded-lg bg-card shadow-sm border border-border">
      {/* Accordion Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <User className="h-5 w-5 text-primary shrink-0" />
          <h2 className="font-semibold text-foreground">
            {t("pages.store.orderSnapshotCard.title")}
          </h2>
          {!isOpen && typeStyle && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeStyle.bg} ${typeStyle.text} shrink-0`}
            >
              {TypeIcon && <TypeIcon className="h-3 w-3" />}
              {buyer!.customer_type.charAt(0).toUpperCase() +
                buyer!.customer_type.slice(1)}
            </span>
          )}
          {!isOpen && channelLabel && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700 shrink-0">
              <Globe className="h-3 w-3" />
              {channelLabel}
            </span>
          )}
          {!isOpen && invoiceLabel && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 shrink-0">
              <Receipt className="h-3 w-3" />
              {invoiceLabel}
            </span>
          )}
          {!isOpen && summaryParts.length > 0 && (
            <span className="text-sm text-muted-foreground truncate">
              — {summaryParts.join(" · ")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {customerProfileUrl && (
            <Link
              href={customerProfileUrl}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              {t("pages.store.orderSnapshotCard.profile")}
            </Link>
          )}
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Accordion Content */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
          {/* Channel & Invoice Flags */}
          {(channelLabel || order.invoice_requested !== undefined) && (
            <div className="flex flex-wrap items-center gap-2">
              {channelLabel && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700">
                  <Globe className="h-3 w-3" />
                  {t("pages.store.orderSnapshotCard.channel")}: {channelLabel}
                </span>
              )}
              {order.invoice_requested ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  <Receipt className="h-3 w-3" />
                  {invoiceLabel}
                </span>
              ) : order.invoice_requested === false ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                  <Receipt className="h-3 w-3" />
                  {t("pages.store.orderSnapshotCard.noInvoice")}
                </span>
              ) : null}
            </div>
          )}

          {/* Customer Identity */}
          {buyer && (
            <div className="space-y-2">
              {typeStyle && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeStyle.bg} ${typeStyle.text}`}
                >
                  {TypeIcon && <TypeIcon className="h-3 w-3" />}
                  {buyer.customer_type.charAt(0).toUpperCase() +
                    buyer.customer_type.slice(1)}
                </span>
              )}
              {buyer.company_name && (
                <p className="text-sm font-semibold">{buyer.company_name}</p>
              )}
              {buyerName && (
                <div>
                  <p className="text-xs text-muted-foreground">{t("pages.store.orderSnapshotCard.contact")}</p>
                  <p className="text-sm font-medium">{buyerName}</p>
                </div>
              )}
              {buyer.email && (
                <div>
                  <p className="text-xs text-muted-foreground">{t("pages.store.orderSnapshotCard.email")}</p>
                  <p className="text-sm font-medium">{buyer.email}</p>
                </div>
              )}
              {buyer.phone && (
                <div>
                  <p className="text-xs text-muted-foreground">{t("pages.store.orderSnapshotCard.phone")}</p>
                  <p className="text-sm font-medium">{buyer.phone}</p>
                </div>
              )}
              {buyer.is_guest && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  {t("pages.store.orderSnapshotCard.guest")}
                </span>
              )}
            </div>
          )}

          {/* Shipping Address */}
          <AddressBlock label={t("pages.store.orderSnapshotCard.shipping")} icon={MapPin} snapshot={shipping} />

          {/* Billing Address */}
          {billing ? (
            <AddressBlock label={t("pages.store.orderSnapshotCard.billing")} icon={FileText} snapshot={billing} />
          ) : shipping ? (
            <div className="border-t border-border pt-3">
              <div className="flex items-center gap-1 mb-1">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  {t("pages.store.orderSnapshotCard.billing")}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("pages.store.orderSnapshotCard.sameAsShipping")}
              </p>
            </div>
          ) : null}

          {/* Fiscal Data */}
          {hasFiscal && (
            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                {t("pages.store.orderSnapshotCard.fiscalData")}
              </p>
              {fiscal.company_name && (
                <div>
                  <p className="text-xs text-muted-foreground">{t("pages.store.orderSnapshotCard.company")}</p>
                  <p className="text-sm font-medium">{fiscal.company_name}</p>
                </div>
              )}
              {fiscal.vat_number && (
                <div>
                  <p className="text-xs text-muted-foreground">{t("pages.store.orderSnapshotCard.vatNumber")}</p>
                  <p className="text-sm font-mono">{fiscal.vat_number}</p>
                </div>
              )}
              {fiscal.fiscal_code && (
                <div>
                  <p className="text-xs text-muted-foreground">{t("pages.store.orderSnapshotCard.fiscalCode")}</p>
                  <p className="text-sm font-mono">{fiscal.fiscal_code}</p>
                </div>
              )}
              {fiscal.pec_email && (
                <div>
                  <p className="text-xs text-muted-foreground">{t("pages.store.orderSnapshotCard.pec")}</p>
                  <p className="text-sm font-medium">{fiscal.pec_email}</p>
                </div>
              )}
              {fiscal.sdi_code && (
                <div>
                  <p className="text-xs text-muted-foreground">{t("pages.store.orderSnapshotCard.sdiCode")}</p>
                  <p className="text-sm font-mono">{fiscal.sdi_code}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
