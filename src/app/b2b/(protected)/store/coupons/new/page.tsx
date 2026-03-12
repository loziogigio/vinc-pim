"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save, ArrowLeft, X, Search, Users } from "lucide-react";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import {
  normalizeDecimalInput,
  parseDecimalValue,
  toDecimalInputValue,
} from "@/lib/utils/decimal-input";

interface CustomerTag {
  email: string;
  company_name?: string;
}

export default function NewCouponPage() {
  const router = useRouter();
  const pathname = usePathname();
  const tenantMatch = pathname?.match(/^\/([^/]+)\/b2b/);
  const tenantPrefix = tenantMatch ? `/${tenantMatch[1]}` : "";

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [label, setLabel] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">(
    "percentage"
  );
  const [discountValueInput, setDiscountValueInput] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [maxUsesPerCustomer, setMaxUsesPerCustomer] = useState("");
  const [includeShipping, setIncludeShipping] = useState(false);
  const [isCumulative, setIsCumulative] = useState(true);
  const [minOrderAmountInput, setMinOrderAmountInput] = useState("");
  const [maxOrderAmountInput, setMaxOrderAmountInput] = useState("");
  const [maxDiscountAmountInput, setMaxDiscountAmountInput] = useState("");
  const [notes, setNotes] = useState("");

  // Channel
  const [channel, setChannel] = useState("");
  const [channels, setChannels] = useState<{ code: string; name: string }[]>(
    []
  );

  // Customer restriction
  const [customers, setCustomers] = useState<CustomerTag[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerTag[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch available channels (storefronts)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/b2b/b2c/storefronts?limit=50");
        const data = await res.json();
        const items = data.items || [];
        const chs = items.map((s: any) => ({
          code: s.channel,
          name: s.name || s.channel,
        }));
        setChannels(chs);
        if (chs.length === 1) setChannel(chs[0].code);
      } catch {
        // ignore
      }
    })();
  }, []);

  const handleDecimalChange = (
    rawValue: string,
    setter: (v: string) => void
  ) => {
    const normalized = normalizeDecimalInput(rawValue);
    if (normalized === null) return;
    setter(normalized);
  };

  const searchCustomers = async (query: string) => {
    if (query.length < 2) {
      setCustomerResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(
        `/api/b2b/customers?search=${encodeURIComponent(query)}&limit=5`
      );
      const data = await res.json();
      const results: CustomerTag[] = (data.customers || [])
        .filter(
          (c: any) =>
            c.email && !customers.some((t) => t.email === c.email)
        )
        .map((c: any) => ({
          email: c.email,
          company_name: c.company_name || "",
        }));
      setCustomerResults(results);
    } catch {
      setCustomerResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const addCustomer = (c: CustomerTag) => {
    if (!customers.some((t) => t.email === c.email)) {
      setCustomers((prev) => [...prev, c]);
    }
    setCustomerSearch("");
    setCustomerResults([]);
  };

  const addCustomerByEmail = (email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (trimmed && trimmed.includes("@") && !customers.some((c) => c.email === trimmed)) {
      setCustomers((prev) => [...prev, { email: trimmed }]);
      setCustomerSearch("");
      setCustomerResults([]);
    }
  };

  const removeCustomer = (email: string) => {
    setCustomers((prev) => prev.filter((c) => c.email !== email));
  };

  const handleSave = async () => {
    setError("");
    setIsSaving(true);

    try {
      const discountValue = parseDecimalValue(discountValueInput);
      if (!discountValue || discountValue <= 0) {
        setError("Inserisci un valore sconto valido");
        setIsSaving(false);
        return;
      }

      if (!code.trim()) {
        setError("Il codice coupon e' obbligatorio");
        setIsSaving(false);
        return;
      }

      if (!channel) {
        setError("Seleziona un canale");
        setIsSaving(false);
        return;
      }

      const body: Record<string, unknown> = {
        code: code.trim().toUpperCase(),
        channel,
        discount_type: discountType,
        discount_value: discountValue,
        include_shipping: includeShipping,
        is_cumulative: isCumulative,
      };

      if (description) body.description = description;
      if (label.trim()) body.label = label.trim();
      if (startDate) body.start_date = new Date(startDate).toISOString();
      if (endDate) body.end_date = new Date(endDate).toISOString();
      if (maxUses) body.max_uses = parseInt(maxUses);
      if (maxUsesPerCustomer)
        body.max_uses_per_customer = parseInt(maxUsesPerCustomer);
      if (notes.trim()) body.notes = notes.trim();
      if (customers.length > 0)
        body.customer_emails = customers.map((c) => c.email);

      const minOrderAmount = parseDecimalValue(minOrderAmountInput);
      if (minOrderAmount) body.min_order_amount = minOrderAmount;

      const maxOrderAmount = parseDecimalValue(maxOrderAmountInput);
      if (maxOrderAmount) body.max_order_amount = maxOrderAmount;

      const maxDiscountAmount = parseDecimalValue(maxDiscountAmountInput);
      if (maxDiscountAmount) body.max_discount_amount = maxDiscountAmount;

      const res = await fetch("/api/b2b/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Errore nella creazione");
        return;
      }

      router.push(
        `${tenantPrefix}/b2b/store/coupons/${data.coupon.coupon_id}`
      );
    } catch (err) {
      setError("Errore di rete");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Store", href: "/b2b/store/orders" },
          { label: "Coupons", href: "/b2b/store/coupons" },
          { label: "Nuovo" },
        ]}
      />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#5e5873]">Nuovo Coupon</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Indietro
          </Button>
          <Button
            className="bg-[#009688] hover:bg-[#00796b] text-white"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Salvataggio..." : "Crea Coupon"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Core info */}
        <div className="space-y-6">
          <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
            <h2 className="text-lg font-semibold text-[#5e5873] mb-4">
              Informazioni base
            </h2>
            <div className="space-y-4">
              <div>
                <Label>Codice coupon *</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="ES: SUMMER2026"
                  className="font-mono"
                  maxLength={30}
                />
              </div>
              <div>
                <Label>Canale *</Label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full rounded-md border border-[#ebe9f1] px-3 py-2 text-sm bg-white"
                >
                  <option value="">Seleziona canale...</option>
                  {channels.map((ch) => (
                    <option key={ch.code} value={ch.code}>
                      {ch.name} ({ch.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Etichetta (visibile al cliente)</Label>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Es: Sconto Estate 2026"
                />
              </div>
              <div>
                <Label>Descrizione (interna)</Label>
                <RichTextEditor
                  content={description}
                  onChange={setDescription}
                  placeholder="Descrizione coupon..."
                  minHeight="150px"
                />
              </div>
            </div>
          </div>

          <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
            <h2 className="text-lg font-semibold text-[#5e5873] mb-4">
              Sconto
            </h2>
            <div className="space-y-4">
              <div>
                <Label>Tipo sconto *</Label>
                <select
                  value={discountType}
                  onChange={(e) =>
                    setDiscountType(e.target.value as "percentage" | "fixed")
                  }
                  className="w-full rounded-md border border-[#ebe9f1] px-3 py-2 text-sm bg-white"
                >
                  <option value="percentage">Percentuale (%)</option>
                  <option value="fixed">Valore fisso (EUR)</option>
                </select>
              </div>
              <div>
                <Label>
                  Valore sconto *{" "}
                  {discountType === "percentage" ? "(%)" : "(EUR)"}
                </Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={discountValueInput}
                  onChange={(e) =>
                    handleDecimalChange(e.target.value, setDiscountValueInput)
                  }
                  placeholder={discountType === "percentage" ? "10" : "25.00"}
                />
              </div>
              <div>
                <Label>Sconto massimo applicabile (EUR)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={maxDiscountAmountInput}
                  onChange={(e) =>
                    handleDecimalChange(
                      e.target.value,
                      setMaxDiscountAmountInput
                    )
                  }
                  placeholder="Lascia vuoto per nessun limite"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="includeShipping"
                  checked={includeShipping}
                  onChange={(e) => setIncludeShipping(e.target.checked)}
                  className="rounded border-[#ebe9f1]"
                />
                <Label htmlFor="includeShipping" className="cursor-pointer">
                  Applica anche al costo di spedizione
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isCumulative"
                  checked={isCumulative}
                  onChange={(e) => setIsCumulative(e.target.checked)}
                  className="rounded border-[#ebe9f1]"
                />
                <Label htmlFor="isCumulative" className="cursor-pointer">
                  Cumulabile con altri sconti
                </Label>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Limits & validity */}
        <div className="space-y-6">
          <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
            <h2 className="text-lg font-semibold text-[#5e5873] mb-4">
              Validita
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data inizio</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Data fine</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Utilizzi massimi (totale)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    placeholder="Illimitato"
                  />
                </div>
                <div>
                  <Label>Utilizzi massimi per cliente</Label>
                  <Input
                    type="number"
                    min={1}
                    value={maxUsesPerCustomer}
                    onChange={(e) => setMaxUsesPerCustomer(e.target.value)}
                    placeholder="Illimitato"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
            <h2 className="text-lg font-semibold text-[#5e5873] mb-4">
              Soglie ordine
            </h2>
            <div className="space-y-4">
              <div>
                <Label>Importo minimo ordine (EUR)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={minOrderAmountInput}
                  onChange={(e) =>
                    handleDecimalChange(
                      e.target.value,
                      setMinOrderAmountInput
                    )
                  }
                  placeholder="Nessun minimo"
                />
              </div>
              <div>
                <Label>Importo massimo ordine (EUR)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={maxOrderAmountInput}
                  onChange={(e) =>
                    handleDecimalChange(
                      e.target.value,
                      setMaxOrderAmountInput
                    )
                  }
                  placeholder="Nessun massimo"
                />
              </div>
            </div>
          </div>

          <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
            <h2 className="text-lg font-semibold text-[#5e5873] mb-4 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Clienti autorizzati
            </h2>
            <p className="text-xs text-[#b9b9c3] mb-3">
              Lascia vuoto per tutti i clienti. Cerca per email o ragione
              sociale.
            </p>
            <div className="relative">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-[#b9b9c3]" />
                <Input
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    searchCustomers(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomerByEmail(customerSearch);
                    }
                  }}
                  placeholder="Cerca o digita email + Invio..."
                  className="flex-1"
                />
              </div>
              {customerResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-[#ebe9f1] bg-white shadow-lg max-h-48 overflow-auto">
                  {customerResults.map((c) => (
                    <button
                      key={c.email}
                      type="button"
                      onClick={() => addCustomer(c)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-[#f8f8f8] border-b border-[#ebe9f1] last:border-0"
                    >
                      <span className="font-medium">{c.email}</span>
                      {c.company_name && (
                        <span className="text-[#b9b9c3] ml-2">
                          ({c.company_name})
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {isSearching && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-[#ebe9f1] bg-white shadow-lg p-3 text-sm text-[#b9b9c3]">
                  Ricerca...
                </div>
              )}
            </div>
            {customers.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {customers.map((c) => (
                  <span
                    key={c.email}
                    className="inline-flex items-center gap-1 rounded-full bg-[#e0f2f1] px-3 py-1 text-xs text-[#00796b]"
                  >
                    {c.email}
                    {c.company_name && (
                      <span className="text-[#b9b9c3]">
                        ({c.company_name})
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeCustomer(c.email)}
                      className="ml-1 hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
            <h2 className="text-lg font-semibold text-[#5e5873] mb-4">
              Note interne
            </h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Note interne non visibili al cliente..."
              className="w-full rounded-md border border-[#ebe9f1] px-3 py-2 text-sm resize-none"
              rows={3}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
