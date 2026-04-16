"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface HoldExpiryCountdownProps {
  expiresAt: string;
  onExpired?: () => void;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function HoldExpiryCountdown({ expiresAt, onExpired }: HoldExpiryCountdownProps) {
  const { t } = useTranslation();
  const [remaining, setRemaining] = useState(() => new Date(expiresAt).getTime() - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setRemaining(ms);
      if (ms <= 0) {
        clearInterval(interval);
        onExpired?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  const expired = remaining <= 0;
  const urgent = remaining > 0 && remaining < 120000; // < 2 min

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
        expired
          ? "bg-red-100 text-red-700"
          : urgent
            ? "bg-amber-100 text-amber-700 animate-pulse"
            : "bg-amber-50 text-amber-600"
      }`}
    >
      <Clock className="h-3.5 w-3.5" />
      {expired ? (
        <span>{t("pages.bookings.statuses.booking.expired")}</span>
      ) : (
        <span>{t("pages.bookings.reservationDetail.holdExpiresIn")} {formatRemaining(remaining)}</span>
      )}
    </div>
  );
}
