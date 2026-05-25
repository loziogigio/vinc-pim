"use client";

import { CheckCircle, Clock, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/useTranslation";

type SuccessType = "sent" | "scheduled";

interface CampaignSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: SuccessType;
  campaignName?: string;
  recipientCount?: number;
  scheduledAt?: Date;
}

export function CampaignSuccessModal({
  isOpen,
  onClose,
  type,
  campaignName,
  recipientCount,
  scheduledAt,
}: CampaignSuccessModalProps) {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const formatDate = (date: Date) => {
    return date.toLocaleString("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isSent = type === "sent";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl shadow-xl border border-border max-w-md w-full overflow-hidden">
        {/* Success Header */}
        <div className={`p-6 text-center ${isSent ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-blue-50 dark:bg-blue-950/30"}`}>
          <div
            className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${
              isSent ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-blue-100 dark:bg-blue-900/40"
            }`}
          >
            {isSent ? (
              <Send className="w-8 h-8 text-emerald-600 dark:text-emerald-300" />
            ) : (
              <Clock className="w-8 h-8 text-blue-600 dark:text-blue-300" />
            )}
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className={`w-5 h-5 ${isSent ? "text-emerald-600 dark:text-emerald-300" : "text-blue-600 dark:text-blue-300"}`} />
              <h3 className={`text-lg font-semibold ${isSent ? "text-emerald-900 dark:text-emerald-300" : "text-blue-900 dark:text-blue-300"}`}>
                {isSent ? t("pages.notifications.campaigns.successModal.campaignSent") : t("pages.notifications.campaigns.successModal.campaignScheduled")}
              </h3>
            </div>
            <p className={`text-sm mt-1 ${isSent ? "text-emerald-700 dark:text-emerald-400" : "text-blue-700 dark:text-blue-400"}`}>
              {isSent
                ? t("pages.notifications.campaigns.successModal.sentSuccess")
                : t("pages.notifications.campaigns.successModal.scheduledSuccess")}
            </p>
          </div>
        </div>

        {/* Details */}
        <div className="p-6 space-y-4">
          {campaignName && (
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">{t("pages.notifications.campaigns.successModal.campaignLabel")}</span>
              <span className="text-sm font-medium text-foreground">{campaignName}</span>
            </div>
          )}

          {isSent && recipientCount !== undefined && (
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">{t("pages.notifications.campaigns.successModal.recipientsLabel")}</span>
              <span className="text-sm font-medium text-foreground">
                {recipientCount === 1
                  ? t("pages.notifications.campaigns.successModal.userSingular", { count: recipientCount })
                  : t("pages.notifications.campaigns.successModal.userPlural", { count: recipientCount })}
              </span>
            </div>
          )}

          {!isSent && scheduledAt && (
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">{t("pages.notifications.campaigns.successModal.sendDateLabel")}</span>
              <span className="text-sm font-medium text-foreground">{formatDate(scheduledAt)}</span>
            </div>
          )}

          <div className={`p-3 rounded-lg ${isSent ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-blue-50 dark:bg-blue-950/30"}`}>
            <p className={`text-sm ${isSent ? "text-emerald-700 dark:text-emerald-400" : "text-blue-700 dark:text-blue-400"}`}>
              {isSent
                ? t("pages.notifications.campaigns.successModal.sentMonitorHint")
                : t("pages.notifications.campaigns.successModal.scheduledMonitorHint")}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted">
          <Button onClick={onClose} className="gap-2">
            <CheckCircle className="w-4 h-4" />
            {t("pages.notifications.campaigns.successModal.okGotIt")}
          </Button>
        </div>
      </div>
    </div>
  );
}
