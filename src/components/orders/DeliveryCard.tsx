"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import {
  Truck,
  Package,
  Calendar,
  ExternalLink,
  Edit,
  Save,
  X,
  Loader2,
  CheckCircle,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import type { Order, DeliveryData } from "@/lib/types/order";

interface DeliveryCardProps {
  order: Order;
  onDeliveryChange?: () => void;
}

export function DeliveryCard({ order, onDeliveryChange }: DeliveryCardProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editData, setEditData] = useState({
    carrier: order.delivery?.carrier || "",
    tracking_number: order.delivery?.tracking_number || "",
    tracking_url: order.delivery?.tracking_url || "",
  });

  // Only show if delivery is required AND order is shipped/delivered
  // Use explicit === false to handle null/undefined (defaults to true for existing orders)
  if (order.requires_delivery === false || !["shipped", "delivered"].includes(order.status)) {
    return null;
  }

  const delivery = order.delivery;
  const isDelivered = order.status === "delivered";

  // Common carrier tracking URL patterns
  const getTrackingUrl = (carrier?: string, trackingNumber?: string) => {
    if (!trackingNumber) return null;

    const carrierLower = (carrier || "").toLowerCase();

    const trackingUrls: Record<string, (tn: string) => string> = {
      dhl: (tn) => `https://www.dhl.com/en/express/tracking.html?AWB=${tn}`,
      fedex: (tn) => `https://www.fedex.com/apps/fedextrack/?tracknumbers=${tn}`,
      ups: (tn) => `https://www.ups.com/track?tracknum=${tn}`,
      tnt: (tn) => `https://www.tnt.com/express/en_us/site/tracking.html?searchType=con&cons=${tn}`,
      gls: (tn) => `https://www.gls-info.nl/tracking/${tn}`,
      sda: (tn) => `https://www.sda.it/wps/portal/Servizi_online/ricerca_spedizioni?locale=it&tression=${tn}`,
      brt: (tn) => `https://www.brt.it/it/tracking?spession=${tn}`,
      poste: (tn) => `https://www.poste.it/cerca/index.html#/ricerca-spedizione/${tn}`,
    };

    for (const [key, urlFn] of Object.entries(trackingUrls)) {
      if (carrierLower.includes(key)) {
        return urlFn(trackingNumber);
      }
    }

    return null;
  };

  const trackingUrl = delivery?.tracking_url || getTrackingUrl(delivery?.carrier, delivery?.tracking_number);

  // Handle save delivery info
  const handleSave = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/b2b/orders/${order.order_id}/delivery`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrier: editData.carrier || undefined,
          tracking_number: editData.tracking_number || undefined,
          tracking_url: editData.tracking_url || undefined,
        }),
      });

      if (res.ok) {
        toast.success(t("pages.store.deliveryCard.deliveryUpdated"));
        setIsEditing(false);
        onDeliveryChange?.();
      } else {
        const error = await res.json();
        toast.error(error.error || t("pages.store.deliveryCard.failedToUpdate"));
      }
    } catch (err) {
      console.error("Error updating delivery:", err);
      toast.error(t("pages.store.deliveryCard.failedToUpdate"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-lg bg-card shadow-sm border border-border">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isDelivered ? (
              <Package className="h-5 w-5 text-emerald-500" />
            ) : (
              <Truck className="h-5 w-5 text-purple-500" />
            )}
            <h2 className="font-semibold text-foreground">
              {isDelivered ? t("pages.store.deliveryCard.titleDelivery") : t("pages.store.deliveryCard.titleShipping")}
            </h2>
          </div>
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
              isDelivered
                ? "bg-emerald-100 text-emerald-700"
                : "bg-purple-100 text-purple-700"
            }`}
          >
            {isDelivered ? (
              <>
                <CheckCircle className="h-3 w-3" />
                {t("pages.store.deliveryCard.statusDelivered")}
              </>
            ) : (
              <>
                <Truck className="h-3 w-3" />
                {t("pages.store.deliveryCard.statusInTransit")}
              </>
            )}
          </span>
        </div>
      </div>
      <div className="p-4 space-y-4">
        {isEditing ? (
          // Edit Form
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">{t("pages.store.deliveryCard.carrier")}</label>
              <input
                type="text"
                placeholder={t("pages.store.deliveryCard.carrierPlaceholder")}
                value={editData.carrier}
                onChange={(e) =>
                  setEditData({ ...editData, carrier: e.target.value })
                }
                className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">
                {t("pages.store.deliveryCard.trackingNumber")}
              </label>
              <input
                type="text"
                placeholder={t("pages.store.deliveryCard.trackingNumberPlaceholder")}
                value={editData.tracking_number}
                onChange={(e) =>
                  setEditData({ ...editData, tracking_number: e.target.value })
                }
                className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">
                {t("pages.store.deliveryCard.trackingUrl")}
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={editData.tracking_url}
                onChange={(e) =>
                  setEditData({ ...editData, tracking_url: e.target.value })
                }
                className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("pages.store.deliveryCard.trackingUrlHint")}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 text-sm font-medium disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {t("common.save")}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditData({
                    carrier: delivery?.carrier || "",
                    tracking_number: delivery?.tracking_number || "",
                    tracking_url: delivery?.tracking_url || "",
                  });
                }}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          // Display Info
          <div className="space-y-3">
            {delivery?.carrier && (
              <div>
                <p className="text-xs text-muted-foreground">{t("pages.store.deliveryCard.carrier")}</p>
                <p className="text-sm font-medium">{delivery.carrier}</p>
              </div>
            )}

            {delivery?.tracking_number && (
              <div>
                <p className="text-xs text-muted-foreground">{t("pages.store.deliveryCard.trackingNumber")}</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono font-medium">
                    {delivery.tracking_number}
                  </p>
                  {trackingUrl && (
                    <a
                      href={trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-xs flex items-center gap-1"
                    >
                      Track <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {delivery?.tracking_url && (
              <div>
                <p className="text-xs text-muted-foreground">{t("pages.store.deliveryCard.trackingUrl")}</p>
                <a
                  href={delivery.tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline break-all flex items-center gap-1"
                >
                  {delivery.tracking_url}
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                </a>
              </div>
            )}

            {delivery?.shipped_at && (
              <div>
                <p className="text-xs text-muted-foreground">{t("pages.store.deliveryCard.shippedAt")}</p>
                <p className="text-sm font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  {new Date(delivery.shipped_at).toLocaleDateString("it-IT", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            )}

            {delivery?.delivered_at && (
              <div>
                <p className="text-xs text-muted-foreground">{t("pages.store.deliveryCard.deliveredAt")}</p>
                <p className="text-sm font-medium flex items-center gap-1 text-emerald-600">
                  <CheckCircle className="h-3 w-3" />
                  {new Date(delivery.delivered_at).toLocaleDateString("it-IT", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            )}

            {(!delivery?.carrier || !delivery?.tracking_number) && !isDelivered && (
              <p className="text-xs text-muted-foreground italic">
                {t("pages.store.deliveryCard.noTracking")}
              </p>
            )}

            {!isDelivered && (
              <button
                onClick={() => setIsEditing(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition"
              >
                <Edit className="h-4 w-4" />
                {delivery?.tracking_number ? t("pages.store.deliveryCard.editTracking") : t("pages.store.deliveryCard.addTracking")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
