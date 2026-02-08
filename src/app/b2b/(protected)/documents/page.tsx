"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  FilePlus,
  Send,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_STATUS_LABELS,
} from "@/lib/constants/document";
import type { DocumentType, DocumentStatus } from "@/lib/constants/document";
import { DocumentStatusBadge } from "@/components/documents";

interface DashboardStats {
  total: number;
  draft: number;
  finalized: number;
  sent: number;
  paid: number;
  voided: number;
  by_type: Record<string, number>;
}

interface RecentDocument {
  document_id: string;
  document_type: DocumentType;
  document_number?: string;
  status: DocumentStatus;
  customer: { company_name?: string; first_name?: string; last_name?: string };
  totals: { total: number };
  currency: string;
  created_at: string;
}

export default function DocumentsDashboard() {
  const pathname = usePathname();
  const tenantPrefix = pathname?.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<RecentDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/b2b/documents?limit=10").then((r) => r.json()),
    ])
      .then(([listData]) => {
        const docs = listData.documents || [];
        setRecent(docs);

        // Calculate stats from list
        const s: DashboardStats = {
          total: listData.pagination?.total || docs.length,
          draft: 0,
          finalized: 0,
          sent: 0,
          paid: 0,
          voided: 0,
          by_type: {},
        };
        docs.forEach((d: RecentDocument) => {
          if (d.status in s) (s as any)[d.status]++;
          s.by_type[d.document_type] = (s.by_type[d.document_type] || 0) + 1;
        });
        setStats(s);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const statCards = [
    { label: "Bozze", value: stats?.draft || 0, icon: FilePlus, color: "text-gray-600 bg-gray-50" },
    { label: "Finalizzati", value: stats?.finalized || 0, icon: FileText, color: "text-blue-600 bg-blue-50" },
    { label: "Inviati", value: stats?.sent || 0, icon: Send, color: "text-amber-600 bg-amber-50" },
    { label: "Pagati", value: stats?.paid || 0, icon: CheckCircle, color: "text-green-600 bg-green-50" },
    { label: "Annullati", value: stats?.voided || 0, icon: XCircle, color: "text-red-600 bg-red-50" },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const formatCurrency = (amount: number, currency: string = "EUR") =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(amount);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#5e5873]">Documents Dashboard</h1>
        <Link
          href={`${tenantPrefix}/b2b/documents/create`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#009688] text-white rounded-lg hover:bg-[#00796b] transition-colors text-sm font-medium"
        >
          <FilePlus className="w-4 h-4" />
          Nuovo Documento
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-lg border border-[#ebe9f1] p-4"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#5e5873]">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Documents */}
      <div className="bg-white rounded-lg border border-[#ebe9f1]">
        <div className="p-4 border-b border-[#ebe9f1] flex items-center justify-between">
          <h2 className="font-semibold text-[#5e5873]">Documenti Recenti</h2>
          <Link
            href={`${tenantPrefix}/b2b/documents/list`}
            className="text-sm text-[#009688] hover:underline"
          >
            Vedi tutti
          </Link>
        </div>
        <div className="divide-y divide-[#ebe9f1]">
          {recent.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nessun documento trovato. Crea il tuo primo documento!
            </div>
          ) : (
            recent.map((doc) => {
              const customerName =
                doc.customer?.company_name ||
                [doc.customer?.first_name, doc.customer?.last_name]
                  .filter(Boolean)
                  .join(" ") ||
                "—";
              return (
                <Link
                  key={doc.document_id}
                  href={`${tenantPrefix}/b2b/documents/${doc.document_id}`}
                  className="flex items-center justify-between p-4 hover:bg-[#f8f8f8] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium text-[#5e5873]">
                        {doc.document_number || "BOZZA"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {DOCUMENT_TYPE_LABELS[doc.document_type]} - {customerName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-[#5e5873]">
                      {formatCurrency(doc.totals?.total || 0, doc.currency)}
                    </span>
                    <DocumentStatusBadge status={doc.status} />
                    <span className="text-xs text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString("it-IT")}
                    </span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
