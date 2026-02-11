"use client";

import { useState } from "react";
import { ArrowLeft, Pencil, Check, X, Loader2 } from "lucide-react";
import { DOCUMENT_TYPE_LABELS } from "@/lib/constants/document";
import type { DocumentType, DocumentStatus } from "@/lib/constants/document";
import { DocumentStatusBadge } from "./DocumentStatusBadge";
import type { Document } from "@/lib/types/document";

interface Props {
  doc: Document;
  actionLoading: string;
  onBack: () => void;
  onUpdateNumber: (num: number) => Promise<void>;
}

export function DocumentHeader({
  doc,
  actionLoading,
  onBack,
  onUpdateNumber,
}: Props) {
  const [editingNumber, setEditingNumber] = useState(false);
  const [editNumberValue, setEditNumberValue] = useState("");

  const handleConfirmNumber = async () => {
    const num = parseInt(editNumberValue);
    if (isNaN(num) || num < 1) {
      alert("Il numero deve essere un intero positivo");
      return;
    }
    await onUpdateNumber(num);
    setEditingNumber(false);
  };

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={onBack}
        className="p-2 rounded-lg hover:bg-[#f8f8f8]"
      >
        <ArrowLeft className="w-5 h-5 text-[#5e5873]" />
      </button>
      <div>
        <div className="flex items-center gap-3">
          {editingNumber ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={editNumberValue}
                onChange={(e) => setEditNumberValue(e.target.value)}
                className="w-24 px-2 py-1 border border-[#ebe9f1] rounded text-lg font-bold text-[#5e5873] focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmNumber();
                  if (e.key === "Escape") setEditingNumber(false);
                }}
              />
              <button
                onClick={handleConfirmNumber}
                disabled={actionLoading === "update-number"}
                className="p-1.5 rounded-lg text-green-600 hover:bg-green-50"
                title="Conferma"
              >
                {actionLoading === "update-number" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => setEditingNumber(false)}
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                title="Annulla"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-[#5e5873]">
                {doc.document_number || (
                  <span className="text-muted-foreground italic">Bozza</span>
                )}
              </h1>
              {doc.status === "finalized" && (
                <button
                  onClick={() => {
                    setEditNumberValue(
                      String((doc as any).document_number_raw || ""),
                    );
                    setEditingNumber(true);
                  }}
                  className="p-1 rounded hover:bg-[#f8f8f8] text-muted-foreground hover:text-[#5e5873]"
                  title="Modifica numero"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          <DocumentStatusBadge status={doc.status as DocumentStatus} />
        </div>
        {editingNumber && (
          <p className="text-xs text-amber-600 mt-1">
            Attenzione: modificare il numero potrebbe creare buchi nella
            numerazione. Il contatore verrà aggiornato automaticamente.
          </p>
        )}
        <p className="text-sm text-muted-foreground mt-0.5">
          {DOCUMENT_TYPE_LABELS[doc.document_type as DocumentType]} —{" "}
          {new Date(doc.created_at).toLocaleDateString("it-IT")}
        </p>
      </div>
    </div>
  );
}
