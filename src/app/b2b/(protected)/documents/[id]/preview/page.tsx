"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ArrowLeft, Download, Printer, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import {
  DOCUMENT_TYPE_LABELS,
} from "@/lib/constants/document";
import type { DocumentType } from "@/lib/constants/document";
import type { Document } from "@/lib/types/document";

export default function DocumentPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const tenantPrefix =
    pathname?.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [documentId, setDocumentId] = useState("");
  const [doc, setDoc] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    params.then(({ id }) => setDocumentId(id));
  }, [params]);

  useEffect(() => {
    if (!documentId) return;
    (async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/b2b/documents/${documentId}`);
        const data = await res.json();
        if (data.success) setDoc(data.document);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [documentId]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch(`/api/b2b/documents/${documentId}/pdf`);
      if (!res.ok) {
        alert(t("pages.documents.preview.pdfError"));
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
      alert(t("pages.documents.preview.networkError"));
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (n: number, currency: string = "EUR") =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(n);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        {t("pages.documents.preview.documentNotFound")}
      </div>
    );
  }

  const typeLabel = DOCUMENT_TYPE_LABELS[doc.document_type as DocumentType] || doc.document_type;
  const customerName =
    doc.customer?.company_name ||
    [doc.customer?.first_name, doc.customer?.last_name]
      .filter(Boolean)
      .join(" ") ||
    "—";

  return (
    <div>
      {/* Toolbar (hidden on print) */}
      <div className="print:hidden px-6 py-3 flex items-center justify-between border-b border-[#ebe9f1] bg-white sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() =>
              router.push(`${tenantPrefix}/b2b/documents/${documentId}`)
            }
            className="p-2 rounded-lg hover:bg-[#f8f8f8]"
          >
            <ArrowLeft className="w-5 h-5 text-[#5e5873]" />
          </button>
          <span className="font-semibold text-[#5e5873]">
            {t("pages.documents.preview.previewLabel")} {doc.document_number || t("pages.documents.preview.draftLabel")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#ebe9f1] rounded-lg hover:bg-[#f8f8f8] text-sm"
          >
            <Printer className="w-4 h-4" />
            {t("pages.documents.preview.print")}
          </button>
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#009688] text-white rounded-lg hover:bg-[#00796b] text-sm font-medium disabled:opacity-50"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {t("pages.documents.preview.downloadPdf")}
          </button>
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex justify-center bg-gray-100 print:bg-white min-h-screen p-8 print:p-0">
        <div
          className="bg-white shadow-lg print:shadow-none w-full max-w-[210mm] p-[15mm]"
          style={{ minHeight: "297mm" }}
        >
          {/* Company Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              {doc.company?.logo_url && (
                <img
                  src={doc.company.logo_url}
                  alt=""
                  className="h-14 mb-2 object-contain"
                />
              )}
              <h1 className="text-lg font-bold text-gray-900">
                {doc.company?.legal_name}
              </h1>
              {doc.company?.address_line1 && (
                <p className="text-sm text-gray-600">
                  {doc.company.address_line1}
                </p>
              )}
              {doc.company?.address_line2 && (
                <p className="text-sm text-gray-600">
                  {doc.company.address_line2}
                </p>
              )}
              {doc.company?.vat_number && (
                <p className="text-sm text-gray-600">
                  {t("pages.documents.preview.vatNumber")} {doc.company.vat_number}
                </p>
              )}
              {doc.company?.fiscal_code && (
                <p className="text-sm text-gray-600">
                  {t("pages.documents.preview.fiscalCode")} {doc.company.fiscal_code}
                </p>
              )}
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold text-gray-900 uppercase">
                {typeLabel}
              </h2>
              {doc.document_number && (
                <p className="text-lg font-semibold text-gray-700 mt-1">
                  {t("pages.documents.preview.numberLabel")} {doc.document_number}
                </p>
              )}
              <p className="text-sm text-gray-500 mt-1">
                {t("pages.documents.preview.dateLabel")}{" "}
                {new Date(doc.finalized_at || doc.created_at).toLocaleDateString(
                  "it-IT",
                  { day: "2-digit", month: "long", year: "numeric" },
                )}
              </p>
            </div>
          </div>

          {/* Customer */}
          <div className="mb-8 p-4 border border-gray-200 rounded">
            <p className="text-xs text-gray-400 mb-1">{t("pages.documents.preview.attentionOf")}</p>
            <p className="font-semibold">{customerName}</p>
            {doc.customer?.billing_address && (
              <p className="text-sm text-gray-600">
                {doc.customer.billing_address.street_address}
                {doc.customer.billing_address.street_address_2 &&
                  `, ${doc.customer.billing_address.street_address_2}`}
                <br />
                {doc.customer.billing_address.postal_code}{" "}
                {doc.customer.billing_address.city} (
                {doc.customer.billing_address.province})
              </p>
            )}
            {doc.customer?.vat_number && (
              <p className="text-sm text-gray-600">
                {t("pages.documents.preview.vatNumber")} {doc.customer.vat_number}
              </p>
            )}
            {doc.customer?.fiscal_code && (
              <p className="text-sm text-gray-600">
                {t("pages.documents.preview.fiscalCode")} {doc.customer.fiscal_code}
              </p>
            )}
            {doc.customer?.sdi_code && (
              <p className="text-sm text-gray-600">
                SDI: {doc.customer.sdi_code}
              </p>
            )}
            {doc.customer?.pec_email && (
              <p className="text-sm text-gray-600">
                PEC: {doc.customer.pec_email}
              </p>
            )}
          </div>

          {/* Line Items Table */}
          <table className="w-full text-sm mb-6 border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-2 font-semibold text-gray-700">
                  #
                </th>
                <th className="text-left py-2 font-semibold text-gray-700">
                  {t("pages.documents.preview.description")}
                </th>
                <th className="text-center py-2 font-semibold text-gray-700">
                  {t("pages.documents.preview.qty")}
                </th>
                <th className="text-right py-2 font-semibold text-gray-700">
                  {t("pages.documents.preview.unitPrice")}
                </th>
                <th className="text-center py-2 font-semibold text-gray-700">
                  {t("pages.documents.preview.vat")}
                </th>
                {doc.items?.some((i) => (i.discount_percent || 0) > 0) && (
                  <th className="text-center py-2 font-semibold text-gray-700">
                    {t("pages.documents.preview.discount")}
                  </th>
                )}
                <th className="text-right py-2 font-semibold text-gray-700">
                  {t("pages.documents.preview.amount")}
                </th>
              </tr>
            </thead>
            <tbody>
              {(doc.items || []).map((item, idx) => (
                <tr key={idx} className="border-b border-gray-200">
                  <td className="py-2 text-gray-500">{idx + 1}</td>
                  <td className="py-2">
                    {item.description}
                    {item.sku && (
                      <span className="text-xs text-gray-400 ml-1">
                        ({item.sku})
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-center">
                    {item.quantity}
                    {item.quantity_unit && (
                      <span className="text-xs text-gray-400 ml-0.5">
                        {item.quantity_unit}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    {formatCurrency(item.unit_price, doc.currency)}
                  </td>
                  <td className="py-2 text-center">{item.vat_rate}%</td>
                  {doc.items?.some((i) => (i.discount_percent || 0) > 0) && (
                    <td className="py-2 text-center">
                      {item.discount_percent ? `${item.discount_percent}%` : "—"}
                    </td>
                  )}
                  <td className="py-2 text-right font-medium">
                    {formatCurrency(item.line_total, doc.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          {doc.totals && (
            <div className="flex justify-end mb-8">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("pages.documents.preview.subtotal")}</span>
                  <span>
                    {formatCurrency(doc.totals.subtotal_net, doc.currency)}
                  </span>
                </div>
                {doc.totals.total_discount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>{t("pages.documents.preview.discount")}</span>
                    <span>
                      -{formatCurrency(doc.totals.total_discount, doc.currency)}
                    </span>
                  </div>
                )}
                {doc.totals.vat_breakdown?.map(
                  (v: { rate: number; taxable: number; vat: number }) => (
                    <div key={v.rate} className="flex justify-between">
                      <span className="text-gray-500">{t("pages.documents.preview.vat")} {v.rate}%</span>
                      <span>{formatCurrency(v.vat, doc.currency)}</span>
                    </div>
                  ),
                )}
                <div className="flex justify-between font-bold text-base border-t-2 border-gray-300 pt-2 mt-2">
                  <span>{t("pages.documents.preview.total")}</span>
                  <span>{formatCurrency(doc.totals.total, doc.currency)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Payment Terms */}
          {doc.payment_terms && (
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                <span className="font-semibold">{t("pages.documents.preview.payment")}</span>{" "}
                {doc.payment_terms}
              </p>
            </div>
          )}

          {/* Notes */}
          {doc.notes && (
            <div className="mb-4 p-3 bg-gray-50 rounded text-sm text-gray-600 italic">
              {doc.notes}
            </div>
          )}

          {/* Footer */}
          {doc.footer_text && (
            <div className="mt-auto pt-8 text-xs text-gray-400 border-t border-gray-200">
              {doc.footer_text}
            </div>
          )}

          {/* Company Footer */}
          <div className="mt-auto pt-8 text-center text-xs text-gray-400 border-t border-gray-200">
            {doc.company?.legal_name}
            {doc.company?.phone && ` — Tel: ${doc.company.phone}`}
            {doc.company?.email && ` — ${doc.company.email}`}
            {doc.company?.pec_email && ` — PEC: ${doc.company.pec_email}`}
          </div>
        </div>
      </div>
    </div>
  );
}
