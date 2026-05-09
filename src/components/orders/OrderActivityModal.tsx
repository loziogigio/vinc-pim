"use client";

import { FullScreenModal } from "@/components/shared/FullScreenModal";
import { OrderActivityFeed } from "./OrderActivityFeed";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface OrderActivityModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  /** Short context shown in the header — e.g. order_id + status. */
  subtitle?: string;
  /** Drives the auto-poll cadence while the order is still processing. */
  processingStatus?: string | null;
}

export function OrderActivityModal({
  open,
  onClose,
  orderId,
  subtitle,
  processingStatus,
}: OrderActivityModalProps) {
  const { t } = useTranslation();

  const title = subtitle
    ? `${t("pages.store.orderActivity.title")} — ${subtitle}`
    : t("pages.store.orderActivity.title");

  return (
    <FullScreenModal
      open={open}
      onClose={onClose}
      title={title}
      maxWidth="max-w-6xl"
    >
      <OrderActivityFeed
        orderId={orderId}
        processingStatus={processingStatus}
        enabled={open}
      />
    </FullScreenModal>
  );
}
