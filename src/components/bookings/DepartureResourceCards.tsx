"use client";

import { Bed, Armchair, Clock, Theater, Box } from "lucide-react";
import { CapacityBar } from "./CapacityBar";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { RESOURCE_TYPE_LABELS, type ResourceType } from "@/lib/constants/booking";

interface Resource {
  resource_id: string;
  resource_type: ResourceType;
  child_entity_code: string;
  total_capacity: number;
  available: number;
  held: number;
  booked: number;
  price_override?: number;
  currency?: string;
}

interface DepartureResourceCardsProps {
  resources: Resource[];
}

const RESOURCE_ICONS: Record<ResourceType, typeof Bed> = {
  cabin: Bed,
  room: Bed,
  slot: Clock,
  seat: Theater,
  generic: Box,
};

const currencyFormat = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

export function DepartureResourceCards({ resources }: DepartureResourceCardsProps) {
  const { t } = useTranslation();

  if (resources.length === 0) {
    return (
      <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-8 text-center">
        <p className="text-sm text-[#b9b9c3]">{t("pages.bookings.departureDetail.noResources")}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {resources.map((res) => {
        const Icon = RESOURCE_ICONS[res.resource_type] || Box;
        const typeLabel = t(`pages.bookings.statuses.departure.${res.resource_type}`) || RESOURCE_TYPE_LABELS[res.resource_type] || res.resource_type;

        return (
          <div
            key={res.resource_id}
            className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-4 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-teal-50">
                <Icon className="h-4 w-4 text-teal-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#5e5873] truncate">
                  {res.child_entity_code}
                </div>
                <div className="text-xs text-[#b9b9c3]">{RESOURCE_TYPE_LABELS[res.resource_type]}</div>
              </div>
              {res.price_override !== undefined && (
                <span className="text-sm font-semibold text-[#5e5873]">
                  {currencyFormat.format(res.price_override)}
                </span>
              )}
            </div>

            <CapacityBar
              total={res.total_capacity}
              available={res.available}
              held={res.held}
              booked={res.booked}
              showLabels
              height="md"
            />
          </div>
        );
      })}
    </div>
  );
}
