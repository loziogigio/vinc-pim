"use client";

import { useState, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";
import type { Document } from "@/lib/types/document";

interface CustomerResult {
  customer_id: string;
  company_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  legal_info?: { vat_number?: string };
}

interface Props {
  doc: Document;
  documentId: string;
  isDraft: boolean;
  onDocumentUpdate: (doc: Document) => void;
}

function getCustomerDisplayName(doc: Document): string {
  return (
    doc.customer?.company_name ||
    [doc.customer?.first_name, doc.customer?.last_name]
      .filter(Boolean)
      .join(" ") ||
    "—"
  );
}

export function DocumentPartiesInfo({
  doc,
  documentId,
  isDraft,
  onDocumentUpdate,
}: Props) {
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const searchCustomers = useCallback(async (q: string) => {
    if (q.length < 2) {
      setCustomerResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(
        `/api/b2b/documents/customers/search?q=${encodeURIComponent(q)}`,
      );
      const data = await res.json();
      setCustomerResults(data.customers || []);
      setShowCustomerDropdown(true);
    } catch {
      /* ignore */
    } finally {
      setIsSearching(false);
    }
  }, []);

  const selectCustomer = async (c: CustomerResult) => {
    setShowCustomerDropdown(false);
    setEditingCustomer(false);
    setCustomerSearch("");
    try {
      const res = await fetch(`/api/b2b/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: c.customer_id }),
      });
      const data = await res.json();
      if (data.success) {
        onDocumentUpdate(data.document);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const customerName = getCustomerDisplayName(doc);

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Issuer Card */}
      <div className="bg-white rounded-lg border border-[#ebe9f1] p-4">
        <h3 className="font-semibold text-[#5e5873] mb-2">Emittente</h3>
        <div className="text-sm space-y-0.5">
          <div className="font-medium">{doc.company?.legal_name}</div>
          {doc.company?.address_line1 && (
            <div className="text-muted-foreground">
              {doc.company.address_line1}
            </div>
          )}
          {doc.company?.vat_number && (
            <div className="text-muted-foreground">
              P.IVA: {doc.company.vat_number}
            </div>
          )}
          {doc.company?.pec_email && (
            <div className="text-muted-foreground">
              PEC: {doc.company.pec_email}
            </div>
          )}
        </div>
      </div>

      {/* Customer Card */}
      <div className="bg-white rounded-lg border border-[#ebe9f1] p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-[#5e5873]">Cliente</h3>
          {isDraft && !editingCustomer && (
            <button
              onClick={() => setEditingCustomer(true)}
              className="text-xs text-[#009688] hover:underline"
            >
              Cambia
            </button>
          )}
        </div>

        {editingCustomer ? (
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Cerca cliente..."
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  searchCustomers(e.target.value);
                }}
                onFocus={() =>
                  customerResults.length > 0 &&
                  setShowCustomerDropdown(true)
                }
                onBlur={() =>
                  setTimeout(() => setShowCustomerDropdown(false), 200)
                }
                autoFocus
                className="w-full pl-9 pr-3 py-2 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
            {showCustomerDropdown && customerResults.length > 0 && (
              <div className="absolute z-50 top-full mt-1 w-full bg-white border border-[#ebe9f1] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {customerResults.map((c) => (
                  <button
                    key={c.customer_id}
                    onMouseDown={() => selectCustomer(c)}
                    className="w-full text-left px-3 py-2 hover:bg-[#f8f8f8] text-sm"
                  >
                    <div className="font-medium text-[#5e5873]">
                      {c.company_name ||
                        [c.first_name, c.last_name]
                          .filter(Boolean)
                          .join(" ")}
                    </div>
                    {c.legal_info?.vat_number && (
                      <div className="text-xs text-muted-foreground">
                        P.IVA: {c.legal_info.vat_number}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => {
                setEditingCustomer(false);
                setCustomerSearch("");
              }}
              className="mt-2 text-xs text-muted-foreground hover:underline"
            >
              Annulla
            </button>
          </div>
        ) : (
          <div className="text-sm space-y-0.5">
            <div className="font-medium">{customerName}</div>
            {doc.customer?.vat_number && (
              <div className="text-muted-foreground">
                P.IVA: {doc.customer.vat_number}
              </div>
            )}
            {doc.customer?.email && (
              <div className="text-muted-foreground">
                {doc.customer.email}
              </div>
            )}
            {doc.customer?.pec_email && (
              <div className="text-muted-foreground">
                PEC: {doc.customer.pec_email}
              </div>
            )}
            {doc.customer?.billing_address && (
              <div className="text-muted-foreground">
                {doc.customer.billing_address.street_address},{" "}
                {doc.customer.billing_address.postal_code}{" "}
                {doc.customer.billing_address.city} (
                {doc.customer.billing_address.province})
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
