"use client";

import { Loader2, Send } from "lucide-react";

interface Props {
  sendEmail: string;
  sendSubject: string;
  sendMessage: string;
  actionLoading: string;
  onEmailChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onMessageChange: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
}

export function SendDocumentModal({
  sendEmail,
  sendSubject,
  sendMessage,
  actionLoading,
  onEmailChange,
  onSubjectChange,
  onMessageChange,
  onSend,
  onClose,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-lg font-bold text-[#5e5873]">
          Invia Documento
        </h3>
        <div>
          <label className="block text-sm font-medium text-[#5e5873] mb-1">
            Email Destinatario
          </label>
          <input
            type="email"
            value={sendEmail}
            onChange={(e) => onEmailChange(e.target.value)}
            className="w-full px-3 py-2 border border-[#ebe9f1] rounded-lg text-sm"
            placeholder="email@esempio.it"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#5e5873] mb-1">
            Oggetto (opzionale)
          </label>
          <input
            type="text"
            value={sendSubject}
            onChange={(e) => onSubjectChange(e.target.value)}
            className="w-full px-3 py-2 border border-[#ebe9f1] rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#5e5873] mb-1">
            Messaggio (opzionale)
          </label>
          <textarea
            value={sendMessage}
            onChange={(e) => onMessageChange(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-[#ebe9f1] rounded-lg text-sm resize-none"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-[#ebe9f1] rounded-lg text-sm hover:bg-[#f8f8f8]"
          >
            Annulla
          </button>
          <button
            onClick={onSend}
            disabled={!sendEmail || actionLoading === "send"}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium disabled:opacity-50"
          >
            {actionLoading === "send" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Invia Email
          </button>
        </div>
      </div>
    </div>
  );
}
