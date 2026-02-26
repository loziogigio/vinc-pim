"use client";

import { useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Search,
  Plus,
  Trash2,
  Copy,
  Loader2,
  Save,
  FileText,
  Users,
  List,
  MessageSquare,
  CreditCard,
  X,
  UserPlus,
} from "lucide-react";
import { CreateCustomerModal } from "@/components/documents/CreateCustomerModal";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  PAYMENT_TERMS,
  PAYMENT_TERMS_LABELS,
} from "@/lib/constants/document";
import type { DocumentType } from "@/lib/constants/document";
import type { DocumentLineItem } from "@/lib/types/document";
import {
  calculateDocumentLineTotals,
  calculateDocumentTotals,
  getNextDocumentLineNumber,
} from "@/lib/types/document";
import {
  normalizeDecimalInput,
  parseDecimalValue,
  toDecimalInputValue,
} from "@/lib/utils/decimal-input";

interface CustomerResult {
  customer_id: string;
  company_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  legal_info?: { vat_number?: string };
}

export default function CreateDocumentPage() {
  const router = useRouter();
  const pathname = usePathname();
  const tenantPrefix =
    pathname?.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [documentType, setDocumentType] = useState<DocumentType>("quotation");
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);

  const [items, setItems] = useState<DocumentLineItem[]>([]);
  // Display strings for decimal inputs (keyed by "lineNumber-field")
  const [inputStrings, setInputStrings] = useState<Record<string, string>>({});
  const [paymentTerms, setPaymentTerms] = useState("");
  const [customDays, setCustomDays] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const [isSaving, setIsSaving] = useState(false);

  // Customer search
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
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const selectCustomer = (c: CustomerResult) => {
    setCustomerId(c.customer_id);
    setCustomerName(
      c.company_name ||
        [c.first_name, c.last_name].filter(Boolean).join(" ") ||
        c.email ||
        "",
    );
    setCustomerSearch("");
    setShowCustomerDropdown(false);
  };

  // Line items
  const addItem = () => {
    const lineNumber = getNextDocumentLineNumber(items);
    const newItem: DocumentLineItem = {
      line_number: lineNumber,
      description: "",
      quantity: 1,
      unit_price: 0,
      vat_rate: 22,
      line_net: 0,
      line_vat: 0,
      line_total: 0,
    };
    setItems([...items, newItem]);
    setInputStrings((prev) => ({
      ...prev,
      [`${lineNumber}-quantity`]: "1",
      [`${lineNumber}-unit_price`]: "0",
      [`${lineNumber}-discount_percent`]: "",
    }));
  };

  const updateItem = (
    index: number,
    field: string,
    value: string | number,
  ) => {
    const updated = [...items];
    (updated[index] as any)[field] = value;

    const item = updated[index];
    const totals = calculateDocumentLineTotals(
      item.quantity,
      item.unit_price,
      item.vat_rate,
      item.discount_percent,
    );
    updated[index] = { ...item, ...totals };
    setItems(updated);
  };

  const handleDecimalChange = (index: number, field: string, rawValue: string) => {
    const normalized = normalizeDecimalInput(rawValue);
    if (normalized === null) return;
    const lineNumber = items[index].line_number;
    setInputStrings((prev) => ({ ...prev, [`${lineNumber}-${field}`]: normalized }));
    const numValue = parseDecimalValue(normalized);
    updateItem(index, field, numValue ?? 0);
  };

  const getInputValue = (lineNumber: number, field: string, numericValue: number) => {
    const key = `${lineNumber}-${field}`;
    return key in inputStrings ? inputStrings[key] : toDecimalInputValue(numericValue);
  };

  const duplicateItem = (index: number) => {
    const source = items[index];
    const lineNumber = getNextDocumentLineNumber(items);
    const newItem: DocumentLineItem = {
      ...source,
      line_number: lineNumber,
    };
    const updated = [...items];
    updated.splice(index + 1, 0, newItem);
    setItems(updated);
    setInputStrings((prev) => ({
      ...prev,
      [`${lineNumber}-quantity`]: toDecimalInputValue(source.quantity),
      [`${lineNumber}-unit_price`]: toDecimalInputValue(source.unit_price),
      [`${lineNumber}-discount_percent`]: source.discount_percent ? toDecimalInputValue(source.discount_percent) : "",
    }));
  };

  const removeItem = (index: number) => {
    const lineNumber = items[index].line_number;
    setItems(items.filter((_, i) => i !== index));
    setInputStrings((prev) => {
      const next = { ...prev };
      delete next[`${lineNumber}-quantity`];
      delete next[`${lineNumber}-unit_price`];
      delete next[`${lineNumber}-discount_percent`];
      return next;
    });
  };

  const docTotals = calculateDocumentTotals(items);

  // Save
  const handleSave = async () => {
    if (!customerId) {
      alert("Seleziona un cliente");
      return;
    }
    setIsSaving(true);

    try {
      const res = await fetch("/api/b2b/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_type: documentType,
          customer_id: customerId,
          items,
          payment_terms: paymentTerms || undefined,
          due_date:
            paymentTerms === "custom_date" && dueDate
              ? dueDate
              : paymentTerms === "custom_days" && customDays
                ? new Date(Date.now() + parseInt(customDays) * 86400000).toISOString()
                : undefined,
          notes: notes || undefined,
          internal_notes: internalNotes || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        router.push(
          `${tenantPrefix}/b2b/documents/${data.document.document_id}`,
        );
      } else {
        alert(data.error || "Errore nella creazione");
      }
    } catch {
      alert("Errore di rete");
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(n);

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#5e5873]">
            Nuovo Documento
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crea una nuova bozza di documento.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="px-5 py-2.5 border border-[#ebe9f1] rounded-lg text-sm hover:bg-[#f8f8f8] transition-colors font-medium text-[#5e5873]"
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !customerId}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#009688] text-white rounded-lg hover:bg-[#00796b] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salva Bozza
          </button>
        </div>
      </div>

      {/* Document Info Card */}
      <div className="bg-white rounded-lg border border-[#ebe9f1]">
        <div className="p-5 border-b border-[#ebe9f1]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#009688]/10">
              <FileText className="w-4 h-4 text-[#009688]" />
            </div>
            <h2 className="font-semibold text-[#5e5873]">
              Informazioni Documento
            </h2>
          </div>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-[#5e5873] mb-1.5">
                Tipo Documento
              </label>
              <select
                value={documentType}
                onChange={(e) =>
                  setDocumentType(e.target.value as DocumentType)
                }
                className="w-full px-3 py-2.5 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {DOCUMENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#5e5873] mb-1.5">
                Termini di Pagamento
              </label>
              <select
                value={paymentTerms}
                onChange={(e) => {
                  setPaymentTerms(e.target.value);
                  if (e.target.value !== "custom_days") setCustomDays("");
                  if (e.target.value !== "custom_date") setDueDate("");
                }}
                className="w-full px-3 py-2.5 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
              >
                <option value="">— Nessuno —</option>
                {PAYMENT_TERMS.map((t) => (
                  <option key={t} value={t}>
                    {PAYMENT_TERMS_LABELS[t]}
                  </option>
                ))}
              </select>
              {paymentTerms === "custom_days" && (
                <div className="mt-2">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                    placeholder="Numero di giorni..."
                    className="w-full px-3 py-2.5 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                  />
                </div>
              )}
              {paymentTerms === "custom_date" && (
                <div className="mt-2">
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full px-3 py-2.5 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                  />
                </div>
              )}
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-[#5e5873] mb-1.5">
                Cliente *
              </label>
              {customerId ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2.5 border border-[#ebe9f1] rounded-lg text-sm bg-[#f8f8f8] flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{customerName}</span>
                  </div>
                  <button
                    onClick={() => {
                      setCustomerId("");
                      setCustomerName("");
                    }}
                    className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Cerca per nome azienda o P.IVA..."
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        searchCustomers(e.target.value);
                      }}
                      onFocus={() => {
                        if (customerSearch.length >= 2) setShowCustomerDropdown(true);
                      }}
                      onBlur={() =>
                        setTimeout(() => setShowCustomerDropdown(false), 200)
                      }
                      className="w-full pl-9 pr-3 py-2.5 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                    />
                    {isSearching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {showCustomerDropdown && customerResults.length > 0 && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-white border border-[#ebe9f1] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {customerResults.map((c) => (
                        <button
                          key={c.customer_id}
                          onMouseDown={() => selectCustomer(c)}
                          className="w-full text-left px-3 py-2.5 hover:bg-[#f8f8f8] text-sm transition-colors"
                        >
                          <div className="font-medium text-[#5e5873]">
                            {c.company_name ||
                              [c.first_name, c.last_name]
                                .filter(Boolean)
                                .join(" ")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {c.legal_info?.vat_number &&
                              `P.IVA: ${c.legal_info.vat_number}`}
                            {c.email && ` — ${c.email}`}
                          </div>
                        </button>
                      ))}
                      <button
                        onMouseDown={() => {
                          setShowCustomerDropdown(false);
                          setShowCreateCustomer(true);
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-[#009688]/5 text-sm transition-colors border-t border-[#ebe9f1] flex items-center gap-2 text-[#009688]"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span className="font-medium">Crea nuovo cliente</span>
                      </button>
                    </div>
                  )}
                  {showCustomerDropdown && customerResults.length === 0 && customerSearch.length >= 2 && !isSearching && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-white border border-[#ebe9f1] rounded-lg shadow-lg">
                      <p className="px-3 py-2.5 text-sm text-muted-foreground">
                        Nessun cliente trovato
                      </p>
                      <button
                        onMouseDown={() => {
                          setShowCustomerDropdown(false);
                          setShowCreateCustomer(true);
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-[#009688]/5 text-sm transition-colors border-t border-[#ebe9f1] flex items-center gap-2 text-[#009688]"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span className="font-medium">Crea nuovo cliente</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Line Items Card */}
      <div className="bg-white rounded-lg border border-[#ebe9f1]">
        <div className="p-5 border-b border-[#ebe9f1] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#009688]/10">
              <List className="w-4 h-4 text-[#009688]" />
            </div>
            <div>
              <h2 className="font-semibold text-[#5e5873]">Righe Documento</h2>
              {items.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {items.length} {items.length === 1 ? "riga" : "righe"}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={addItem}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-[#009688] text-white rounded-lg hover:bg-[#00796b] transition-colors font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Aggiungi Riga
          </button>
        </div>

        {items.length === 0 ? (
          <div className="p-12 text-center">
            <List className="w-10 h-10 text-[#ebe9f1] mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Nessuna riga. Clicca &quot;Aggiungi Riga&quot; per iniziare.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#ebe9f1] bg-[#f8f8f8]">
                  <th className="text-left px-4 py-3 font-medium text-[#5e5873]">
                    Descrizione
                  </th>
                  <th className="text-center px-3 py-3 font-medium text-[#5e5873] w-24">
                    Qtà
                  </th>
                  <th className="text-right px-3 py-3 font-medium text-[#5e5873] w-32">
                    Prezzo Unit.
                  </th>
                  <th className="text-center px-3 py-3 font-medium text-[#5e5873] w-24">
                    IVA %
                  </th>
                  <th className="text-center px-3 py-3 font-medium text-[#5e5873] w-24">
                    Sconto %
                  </th>
                  <th className="text-right px-3 py-3 font-medium text-[#5e5873] w-32">
                    Netto
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-[#5e5873] w-32">
                    Totale
                  </th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr
                    key={item.line_number}
                    className="border-b border-[#ebe9f1] hover:bg-[#f8f8f8]/50 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) =>
                          updateItem(idx, "description", e.target.value)
                        }
                        placeholder="Descrizione articolo..."
                        className="w-full px-2.5 py-1.5 border border-[#ebe9f1] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={getInputValue(item.line_number, "quantity", item.quantity)}
                        onChange={(e) => handleDecimalChange(idx, "quantity", e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-[#ebe9f1] rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={getInputValue(item.line_number, "unit_price", item.unit_price)}
                        onChange={(e) => handleDecimalChange(idx, "unit_price", e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-[#ebe9f1] rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={item.vat_rate}
                        onChange={(e) =>
                          updateItem(idx, "vat_rate", parseInt(e.target.value))
                        }
                        className="w-full px-1.5 py-1.5 border border-[#ebe9f1] rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                      >
                        <option value={22}>22%</option>
                        <option value={10}>10%</option>
                        <option value={4}>4%</option>
                        <option value={0}>0%</option>
                      </select>
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={getInputValue(item.line_number, "discount_percent", item.discount_percent || 0)}
                        onChange={(e) => handleDecimalChange(idx, "discount_percent", e.target.value)}
                        placeholder="0"
                        className="w-full px-2.5 py-1.5 border border-[#ebe9f1] rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">
                      {formatCurrency(item.line_net)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-[#5e5873]">
                      {formatCurrency(item.line_total)}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => duplicateItem(idx)}
                          title="Duplica riga"
                          className="p-1.5 text-slate-400 hover:text-[#009688] hover:bg-[#009688]/5 rounded transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => removeItem(idx)}
                          title="Elimina riga"
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        {items.length > 0 && (
          <div className="flex justify-end p-5 border-t border-[#ebe9f1] bg-[#f8f8f8]/50">
            <div className="w-80 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Imponibile</span>
                <span className="font-medium">
                  {formatCurrency(docTotals.subtotal_net)}
                </span>
              </div>
              {docTotals.total_discount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Sconto totale</span>
                  <span>-{formatCurrency(docTotals.total_discount)}</span>
                </div>
              )}
              {docTotals.vat_breakdown.map((v) => (
                <div key={v.rate} className="flex justify-between">
                  <span className="text-muted-foreground">
                    IVA {v.rate}%{" "}
                    <span className="text-xs">
                      (su {formatCurrency(v.taxable)})
                    </span>
                  </span>
                  <span>{formatCurrency(v.vat)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-base border-t border-[#ebe9f1] pt-3 mt-3 text-[#5e5873]">
                <span>Totale</span>
                <span>{formatCurrency(docTotals.total)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notes Card */}
      <div className="bg-white rounded-lg border border-[#ebe9f1]">
        <div className="p-5 border-b border-[#ebe9f1]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#009688]/10">
              <MessageSquare className="w-4 h-4 text-[#009688]" />
            </div>
            <h2 className="font-semibold text-[#5e5873]">Note</h2>
          </div>
        </div>
        <div className="p-5 grid grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-[#5e5873] mb-1.5">
              Note (visibili al cliente)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Condizioni, istruzioni o note per il cliente..."
              className="w-full px-3 py-2.5 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#5e5873] mb-1.5">
              Note Interne
            </label>
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={3}
              placeholder="Note interne, non visibili al cliente..."
              className="w-full px-3 py-2.5 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20 resize-none"
            />
          </div>
        </div>
      </div>

      {/* Create Customer Modal */}
      {showCreateCustomer && (
        <CreateCustomerModal
          onCreated={(customer) => {
            setCustomerId(customer.customer_id);
            setCustomerName(
              customer.company_name ||
                [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
                customer.email,
            );
            setCustomerSearch("");
            setShowCreateCustomer(false);
          }}
          onClose={() => setShowCreateCustomer(false)}
        />
      )}
    </div>
  );
}
