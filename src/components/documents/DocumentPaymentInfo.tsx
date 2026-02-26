"use client";

import { PAYMENT_TERMS, PAYMENT_TERMS_LABELS } from "@/lib/constants/document";
import type { Document } from "@/lib/types/document";

interface Props {
  doc: Document;
  isDraft: boolean;
  editPaymentTerms: string;
  editCustomDays: string;
  editDueDate: string;
  onPaymentTermsChange: (value: string) => void;
  onCustomDaysChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
}

export function DocumentPaymentInfo({
  doc,
  isDraft,
  editPaymentTerms,
  editCustomDays,
  editDueDate,
  onPaymentTermsChange,
  onCustomDaysChange,
  onDueDateChange,
}: Props) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="bg-white rounded-lg border border-[#ebe9f1] p-4">
        <div className="text-xs text-muted-foreground mb-1">
          Termini di Pagamento
        </div>
        {isDraft ? (
          <div className="space-y-2">
            <select
              value={editPaymentTerms}
              onChange={(e) => onPaymentTermsChange(e.target.value)}
              className="w-full px-2 py-1 border border-[#ebe9f1] rounded text-sm"
            >
              <option value="">—</option>
              {PAYMENT_TERMS.map((t) => (
                <option key={t} value={t}>
                  {PAYMENT_TERMS_LABELS[t]}
                </option>
              ))}
            </select>
            {editPaymentTerms === "custom_days" && (
              <input
                type="number"
                min={1}
                value={editCustomDays}
                onChange={(e) => onCustomDaysChange(e.target.value)}
                placeholder="Giorni"
                className="w-full px-2 py-1 border border-[#ebe9f1] rounded text-sm"
              />
            )}
            {editPaymentTerms === "custom_date" && (
              <input
                type="date"
                value={editDueDate}
                onChange={(e) => onDueDateChange(e.target.value)}
                className="w-full px-2 py-1 border border-[#ebe9f1] rounded text-sm"
              />
            )}
          </div>
        ) : (
          <div className="font-medium text-sm">
            {doc.payment_terms
              ? PAYMENT_TERMS_LABELS[
                  doc.payment_terms as keyof typeof PAYMENT_TERMS_LABELS
                ] || doc.payment_terms
              : "—"}
          </div>
        )}
      </div>
      <div className="bg-white rounded-lg border border-[#ebe9f1] p-4">
        <div className="text-xs text-muted-foreground mb-1">Scadenza</div>
        <div className="font-medium text-sm">
          {doc.due_date
            ? new Date(doc.due_date).toLocaleDateString("it-IT", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })
            : "—"}
        </div>
      </div>
      <div className="bg-white rounded-lg border border-[#ebe9f1] p-4">
        <div className="text-xs text-muted-foreground mb-1">Valuta</div>
        <div className="font-medium text-sm">{doc.currency || "EUR"}</div>
      </div>
      <div className="bg-white rounded-lg border border-[#ebe9f1] p-4">
        <div className="text-xs text-muted-foreground mb-1">Ultimo Invio</div>
        <div className="font-medium text-sm">
          {doc.last_sent_at
            ? new Date(doc.last_sent_at).toLocaleDateString("it-IT", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "—"}
        </div>
      </div>
    </div>
  );
}
