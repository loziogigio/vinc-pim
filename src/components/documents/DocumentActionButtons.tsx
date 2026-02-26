"use client";

import { useState } from "react";
import {
  Download,
  Send,
  Copy,
  Lock,
  Ban,
  CheckCircle,
  Loader2,
  Save,
  Trash2,
  Eye,
  RefreshCw,
  MailCheck,
} from "lucide-react";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  canDeleteDocument,
} from "@/lib/constants/document";
import type { DocumentType, DocumentStatus } from "@/lib/constants/document";
import type { Document } from "@/lib/types/document";

interface Props {
  doc: Document;
  documentId: string;
  isDraft: boolean;
  hasChanges: boolean;
  isSaving: boolean;
  actionLoading: string;
  allowedTransitions: string[];
  tenantPrefix: string;
  onSave: () => void;
  onFinalize: () => void;
  onSendModal: () => void;
  onMarkSentManually: () => void;
  onMarkPaid: () => void;
  onDownloadPdf: () => void;
  onDuplicate: () => void;
  onConvert: (targetType: DocumentType) => void;
  onVoid: () => void;
  onDelete: () => void;
}

export function DocumentActionButtons({
  doc,
  documentId,
  isDraft,
  hasChanges,
  isSaving,
  actionLoading,
  allowedTransitions,
  onSave,
  onFinalize,
  onSendModal,
  onMarkSentManually,
  onMarkPaid,
  onDownloadPdf,
  onDuplicate,
  onConvert,
  onVoid,
  onDelete,
}: Props) {
  const [showConvertMenu, setShowConvertMenu] = useState(false);

  return (
    <div className="flex items-center gap-2">
      {isDraft && hasChanges && (
        <button
          onClick={onSave}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#009688] text-white rounded-lg hover:bg-[#00796b] text-sm font-medium disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Salva
        </button>
      )}

      {isDraft && allowedTransitions.includes("finalized") && (
        <button
          onClick={onFinalize}
          disabled={!!actionLoading}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
        >
          {actionLoading === "finalize" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Lock className="w-4 h-4" />
          )}
          Finalizza
        </button>
      )}

      {allowedTransitions.includes("sent") && (
        <>
          <button
            onClick={onSendModal}
            disabled={!!actionLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            Invia
          </button>
          <button
            onClick={onMarkSentManually}
            disabled={!!actionLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 text-sm font-medium disabled:opacity-50"
          >
            {actionLoading === "mark-sent" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <MailCheck className="w-4 h-4" />
            )}
            Segna Inviato
          </button>
        </>
      )}

      {allowedTransitions.includes("paid") && (
        <button
          onClick={onMarkPaid}
          disabled={!!actionLoading}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
        >
          {actionLoading === "paid" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          Segna Pagato
        </button>
      )}

      {isDraft && (
        <button
          onClick={() =>
            window.open(`/api/b2b/documents/${documentId}/pdf`, "_blank")
          }
          disabled={!!actionLoading}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#ebe9f1] rounded-lg hover:bg-[#f8f8f8] text-sm font-medium disabled:opacity-50"
        >
          <Eye className="w-4 h-4" />
          Anteprima
        </button>
      )}

      {!isDraft && (
        <button
          onClick={onDownloadPdf}
          disabled={!!actionLoading}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#ebe9f1] rounded-lg hover:bg-[#f8f8f8] text-sm font-medium disabled:opacity-50"
        >
          {actionLoading === "pdf" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          PDF
        </button>
      )}

      <button
        onClick={onDuplicate}
        disabled={!!actionLoading}
        className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#ebe9f1] rounded-lg hover:bg-[#f8f8f8] text-sm font-medium disabled:opacity-50"
      >
        {actionLoading === "duplicate" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
        Duplica
      </button>

      {/* Convert to other document type */}
      <div
        className="relative"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget))
            setShowConvertMenu(false);
        }}
      >
        <button
          onClick={() => setShowConvertMenu(!showConvertMenu)}
          disabled={!!actionLoading}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#ebe9f1] rounded-lg hover:bg-[#f8f8f8] text-sm font-medium disabled:opacity-50"
        >
          {actionLoading === "convert" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Converti in...
        </button>
        {showConvertMenu && (
          <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-[#ebe9f1] rounded-lg shadow-lg min-w-[180px]">
            {DOCUMENT_TYPES.filter((t) => t !== doc.document_type).map((t) => (
              <button
                key={t}
                onClick={() => {
                  onConvert(t);
                  setShowConvertMenu(false);
                }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-[#f8f8f8] first:rounded-t-lg last:rounded-b-lg"
              >
                {DOCUMENT_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        )}
      </div>

      {allowedTransitions.includes("voided") && (
        <button
          onClick={onVoid}
          disabled={!!actionLoading}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm font-medium disabled:opacity-50"
        >
          {actionLoading === "void" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Ban className="w-4 h-4" />
          )}
          Annulla
        </button>
      )}

      {canDeleteDocument(doc.status as DocumentStatus) && (
        <button
          onClick={onDelete}
          disabled={!!actionLoading}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm font-medium disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          Elimina
        </button>
      )}
    </div>
  );
}
