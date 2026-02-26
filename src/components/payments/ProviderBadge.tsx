"use client";

import { PAYMENT_PROVIDER_LABELS } from "@/lib/constants/payment";
import type { PaymentProvider } from "@/lib/constants/payment";

const PROVIDER_COLORS: Record<PaymentProvider, string> = {
  stripe: "bg-violet-100 text-violet-700",
  mangopay: "bg-orange-100 text-orange-700",
  paypal: "bg-blue-100 text-blue-700",
  nexi: "bg-cyan-100 text-cyan-700",
  axerve: "bg-teal-100 text-teal-700",
  satispay: "bg-red-100 text-red-700",
  scalapay: "bg-lime-100 text-lime-700",
  manual: "bg-gray-100 text-gray-700",
};

interface Props {
  provider: PaymentProvider;
}

export function ProviderBadge({ provider }: Props) {
  const label = PAYMENT_PROVIDER_LABELS[provider] || provider;
  const color = PROVIDER_COLORS[provider] || "bg-gray-100 text-gray-700";

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}
    >
      {label}
    </span>
  );
}
