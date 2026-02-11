import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { DocumentType } from "@/lib/constants/document";
import type { Document } from "@/lib/types/document";

interface UseDocumentActionsParams {
  documentId: string;
  doc: Document | null;
  tenantPrefix: string;
  fetchDocument: () => void;
}

export function useDocumentActions({
  documentId,
  doc,
  tenantPrefix,
  fetchDocument,
}: UseDocumentActionsParams) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState("");

  const callApi = useCallback(
    async (
      endpoint: string,
      method: string = "POST",
      body?: Record<string, unknown>,
      loadingKey?: string,
    ) => {
      setActionLoading(loadingKey || endpoint);
      try {
        const res = await fetch(
          `/api/b2b/documents/${documentId}/${endpoint}`,
          {
            method,
            ...(body
              ? {
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                }
              : {}),
          },
        );
        return await res.json();
      } catch {
        alert("Errore di rete");
        return null;
      } finally {
        setActionLoading("");
      }
    },
    [documentId],
  );

  const handleFinalize = useCallback(async (): Promise<Document | null> => {
    if (
      !confirm(
        "Sei sicuro di voler finalizzare? Il documento non sarà più modificabile.",
      )
    )
      return null;
    const data = await callApi("finalize", "POST", undefined, "finalize");
    if (data?.success) return data.document;
    if (data) alert(data.error || "Errore");
    return null;
  }, [callApi]);

  const handleMarkPaid = useCallback(async (): Promise<Document | null> => {
    const data = await callApi("mark-paid", "POST", undefined, "paid");
    if (data?.success) return data.document;
    if (data) alert(data.error || "Errore");
    return null;
  }, [callApi]);

  const handleVoid = useCallback(async (): Promise<Document | null> => {
    if (!confirm("Sei sicuro di voler annullare questo documento?")) return null;
    const data = await callApi("void", "POST", {}, "void");
    if (data?.success) return data.document;
    if (data) alert(data.error || "Errore");
    return null;
  }, [callApi]);

  const handleDuplicate = useCallback(async () => {
    const data = await callApi("duplicate", "POST", undefined, "duplicate");
    if (data?.success) {
      router.push(
        `${tenantPrefix}/b2b/documents/${data.document.document_id}`,
      );
    } else if (data) {
      alert(data.error || "Errore");
    }
  }, [callApi, router, tenantPrefix]);

  const handleConvert = useCallback(
    async (targetType: DocumentType) => {
      const data = await callApi(
        "convert",
        "POST",
        { target_type: targetType },
        "convert",
      );
      if (data?.success) {
        router.push(
          `${tenantPrefix}/b2b/documents/${data.document.document_id}`,
        );
      } else if (data) {
        alert(data.error || "Errore");
      }
    },
    [callApi, router, tenantPrefix],
  );

  const handleDownloadPdf = useCallback(async () => {
    setActionLoading("pdf");
    try {
      const res = await fetch(`/api/b2b/documents/${documentId}/pdf`);
      if (!res.ok) {
        alert("Errore generazione PDF");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc?.document_number || doc?.document_id || "document"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Errore di rete");
    } finally {
      setActionLoading("");
    }
  }, [documentId, doc]);

  const handleDelete = useCallback(async () => {
    const isFinalized = doc?.status === "finalized";
    const msg = isFinalized
      ? `Eliminare questo documento? Il numero ${doc?.document_number || ""} potrebbe creare un buco nella numerazione. L'azione è irreversibile.`
      : "Eliminare questa bozza? L'azione è irreversibile.";
    if (!confirm(msg)) return;
    setActionLoading("delete");
    try {
      const res = await fetch(`/api/b2b/documents/${documentId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        router.push(`${tenantPrefix}/b2b/documents/list`);
      } else {
        alert(data.error || "Errore");
      }
    } catch {
      alert("Errore di rete");
    } finally {
      setActionLoading("");
    }
  }, [doc, documentId, router, tenantPrefix]);

  const handleMarkSentManually = useCallback(async (): Promise<Document | null> => {
    if (
      !confirm(
        "Confermi che questo documento è stato inviato? Non sarà più possibile modificare il numero o eliminarlo.",
      )
    )
      return null;
    const data = await callApi("mark-sent", "POST", undefined, "mark-sent");
    if (data?.success) return data.document;
    if (data) alert(data.error || "Errore");
    return null;
  }, [callApi]);

  const handleUpdateNumber = useCallback(
    async (num: number): Promise<Document | null> => {
      const data = await callApi(
        "update-number",
        "POST",
        { number: num },
        "update-number",
      );
      if (data?.success) return data.document;
      if (data) alert(data.error || "Errore");
      return null;
    },
    [callApi],
  );

  const handleSend = useCallback(
    async (email: string, subject?: string, message?: string) => {
      if (!email) return false;
      setActionLoading("send");
      try {
        const res = await fetch(`/api/b2b/documents/${documentId}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient_email: email,
            subject: subject || undefined,
            message: message || undefined,
          }),
        });
        const data = await res.json();
        if (data.success) {
          fetchDocument();
          return true;
        }
        alert(data.error || "Errore invio");
        return false;
      } catch {
        alert("Errore di rete");
        return false;
      } finally {
        setActionLoading("");
      }
    },
    [documentId, fetchDocument],
  );

  return {
    actionLoading,
    handleFinalize,
    handleSend,
    handleMarkPaid,
    handleVoid,
    handleDuplicate,
    handleConvert,
    handleDownloadPdf,
    handleDelete,
    handleMarkSentManually,
    handleUpdateNumber,
  };
}
