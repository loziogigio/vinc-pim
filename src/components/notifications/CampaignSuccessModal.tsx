"use client";

import { CheckCircle, Clock, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Success Header */}
        <div className={`p-6 text-center ${isSent ? "bg-emerald-50" : "bg-blue-50"}`}>
          <div
            className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${
              isSent ? "bg-emerald-100" : "bg-blue-100"
            }`}
          >
            {isSent ? (
              <Send className="w-8 h-8 text-emerald-600" />
            ) : (
              <Clock className="w-8 h-8 text-blue-600" />
            )}
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className={`w-5 h-5 ${isSent ? "text-emerald-600" : "text-blue-600"}`} />
              <h3 className={`text-lg font-semibold ${isSent ? "text-emerald-900" : "text-blue-900"}`}>
                {isSent ? "Campagna Inviata!" : "Campagna Programmata!"}
              </h3>
            </div>
            <p className={`text-sm mt-1 ${isSent ? "text-emerald-700" : "text-blue-700"}`}>
              {isSent
                ? "La tua campagna è stata inviata con successo"
                : "La tua campagna è stata programmata con successo"}
            </p>
          </div>
        </div>

        {/* Details */}
        <div className="p-6 space-y-4">
          {campaignName && (
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-sm text-slate-500">Campagna</span>
              <span className="text-sm font-medium text-slate-900">{campaignName}</span>
            </div>
          )}

          {isSent && recipientCount !== undefined && (
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-sm text-slate-500">Destinatari</span>
              <span className="text-sm font-medium text-slate-900">
                {recipientCount} {recipientCount === 1 ? "utente" : "utenti"}
              </span>
            </div>
          )}

          {!isSent && scheduledAt && (
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-sm text-slate-500">Data invio</span>
              <span className="text-sm font-medium text-slate-900">{formatDate(scheduledAt)}</span>
            </div>
          )}

          <div className={`p-3 rounded-lg ${isSent ? "bg-emerald-50" : "bg-blue-50"}`}>
            <p className={`text-sm ${isSent ? "text-emerald-700" : "text-blue-700"}`}>
              {isSent
                ? "Puoi monitorare i risultati nella sezione Storico."
                : "La campagna verrà inviata automaticamente alla data programmata. Puoi annullarla dalla sezione Storico."}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-slate-200 bg-slate-50">
          <Button onClick={onClose} className="gap-2">
            <CheckCircle className="w-4 h-4" />
            OK, Capito
          </Button>
        </div>
      </div>
    </div>
  );
}
