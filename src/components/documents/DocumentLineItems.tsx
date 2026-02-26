"use client";

import { Plus, Trash2 } from "lucide-react";
import type { DocumentLineItem, DocumentTotals } from "@/lib/types/document";

interface Props {
  items: DocumentLineItem[];
  totals: DocumentTotals | undefined;
  isDraft: boolean;
  currency: string;
  formatCurrency: (n: number, currency: string) => string;
  onAddItem: () => void;
  onUpdateItem: (index: number, field: string, value: string | number) => void;
  onRemoveItem: (index: number) => void;
}

export function DocumentLineItems({
  items,
  totals,
  isDraft,
  currency,
  formatCurrency,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}: Props) {
  return (
    <div className="bg-white rounded-lg border border-[#ebe9f1]">
      <div className="p-4 border-b border-[#ebe9f1] flex items-center justify-between">
        <h2 className="font-semibold text-[#5e5873]">Righe Documento</h2>
        {isDraft && (
          <button
            onClick={onAddItem}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#009688] text-white rounded-lg hover:bg-[#00796b] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Aggiungi Riga
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground text-sm">
          Nessuna riga.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#ebe9f1] bg-[#f8f8f8]">
              <th className="text-left px-3 py-2 font-medium text-[#5e5873]">
                Descrizione
              </th>
              <th className="text-center px-3 py-2 font-medium text-[#5e5873] w-20">
                Qtà
              </th>
              <th className="text-right px-3 py-2 font-medium text-[#5e5873] w-28">
                Prezzo Unit.
              </th>
              <th className="text-center px-3 py-2 font-medium text-[#5e5873] w-24">
                IVA %
              </th>
              <th className="text-center px-3 py-2 font-medium text-[#5e5873] w-20">
                Sconto %
              </th>
              <th className="text-right px-3 py-2 font-medium text-[#5e5873] w-28">
                Totale
              </th>
              {isDraft && <th className="w-10"></th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr
                key={item.line_number}
                className="border-b border-[#ebe9f1]"
              >
                <td className="px-3 py-2">
                  {isDraft ? (
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) =>
                        onUpdateItem(idx, "description", e.target.value)
                      }
                      placeholder="Descrizione..."
                      className="w-full px-2 py-1 border border-[#ebe9f1] rounded text-sm"
                    />
                  ) : (
                    <span>{item.description}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {isDraft ? (
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.quantity}
                      onChange={(e) => {
                        const v = e.target.value.replace(",", ".");
                        const n = parseFloat(v);
                        if (!isNaN(n)) onUpdateItem(idx, "quantity", n);
                      }}
                      className="w-full px-2 py-1 border border-[#ebe9f1] rounded text-sm text-center"
                    />
                  ) : (
                    <span>{item.quantity}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {isDraft ? (
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.unit_price}
                      onChange={(e) => {
                        const v = e.target.value.replace(",", ".");
                        const n = parseFloat(v);
                        if (!isNaN(n)) onUpdateItem(idx, "unit_price", n);
                      }}
                      className="w-full px-2 py-1 border border-[#ebe9f1] rounded text-sm text-right"
                    />
                  ) : (
                    <span>{formatCurrency(item.unit_price, currency)}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {isDraft ? (
                    <select
                      value={item.vat_rate}
                      onChange={(e) =>
                        onUpdateItem(idx, "vat_rate", parseInt(e.target.value))
                      }
                      className="w-full px-1 py-1 border border-[#ebe9f1] rounded text-sm text-center"
                    >
                      <option value={22}>22%</option>
                      <option value={10}>10%</option>
                      <option value={4}>4%</option>
                      <option value={0}>0%</option>
                    </select>
                  ) : (
                    <span>{item.vat_rate}%</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {isDraft ? (
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.discount_percent || ""}
                      onChange={(e) => {
                        const v = e.target.value.replace(",", ".");
                        const n = parseFloat(v);
                        onUpdateItem(
                          idx,
                          "discount_percent",
                          isNaN(n) ? 0 : n,
                        );
                      }}
                      placeholder="0"
                      className="w-full px-2 py-1 border border-[#ebe9f1] rounded text-sm text-center"
                    />
                  ) : (
                    <span>{item.discount_percent || 0}%</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-medium">
                  {formatCurrency(item.line_total, currency)}
                </td>
                {isDraft && (
                  <td className="px-1 py-2">
                    <button
                      onClick={() => onRemoveItem(idx)}
                      className="p-1 text-red-400 hover:text-red-600 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Totals */}
      {items.length > 0 && totals && (
        <div className="flex justify-end p-4 border-t border-[#ebe9f1]">
          <div className="w-72 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Imponibile</span>
              <span>
                {formatCurrency(totals.subtotal_net, currency)}
              </span>
            </div>
            {totals.vat_breakdown?.map(
              (v: { rate: number; vat: number }) => (
                <div key={v.rate} className="flex justify-between">
                  <span className="text-muted-foreground">
                    IVA {v.rate}%
                  </span>
                  <span>{formatCurrency(v.vat, currency)}</span>
                </div>
              ),
            )}
            <div className="flex justify-between font-bold text-base border-t border-[#ebe9f1] pt-2 mt-2">
              <span>Totale</span>
              <span>
                {formatCurrency(totals.total, currency)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
