"use client";

import { useState } from "react";
import {
  Search,
  MapPin,
  MapPinPlus,
  ArrowLeft,
  ChevronRight,
  Loader2,
  Building2,
  User,
  Store,
  X,
} from "lucide-react";

interface CustomerEntry {
  customer_id: string;
  email?: string;
  company_name?: string;
  first_name?: string;
  last_name?: string;
  customer_type?: string;
  public_code?: string;
  external_code?: string;
}

interface CustomerAddress {
  address_id: string;
  label?: string;
  recipient_name: string;
  city: string;
  tag_overrides?: Array<{ full_tag: string }>;
}

const CUSTOMER_TYPE_ICONS: Record<string, React.ElementType> = {
  business: Building2,
  private: User,
  reseller: Store,
};

function getDisplayName(c: CustomerEntry): string {
  if (c.company_name) return c.company_name;
  const parts = [c.first_name, c.last_name].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return c.email || c.customer_id;
}

function getCode(c: CustomerEntry): string {
  return c.public_code || c.external_code || c.customer_id;
}

interface Props {
  fullTag: string;
  onAssign: (customerId: string, addressId: string, customerName: string, addressLabel: string) => Promise<void>;
  onClose: () => void;
}

export function AddAddressOverridePanel({ fullTag, onAssign, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CustomerEntry[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedCustomer, setSelectedCustomer] = useState<CustomerEntry | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [assigningAddressId, setAssigningAddressId] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setIsSearching(true);
    setError(null);
    setSelectedCustomer(null);
    setAddresses([]);
    try {
      const params = new URLSearchParams({ search, limit: "10" });
      const res = await fetch(`/api/b2b/customers?${params}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        setError(errData?.error || `Error ${res.status}`);
        setResults([]);
        return;
      }
      const data = await res.json();
      setResults(data.customers || []);
    } catch (err) {
      console.error("Error searching customers:", err);
      setError("Network error");
      setResults([]);
    } finally {
      setIsSearching(false);
      setHasSearched(true);
    }
  };

  const handleSelectCustomer = async (customer: CustomerEntry) => {
    setSelectedCustomer(customer);
    setIsLoadingAddresses(true);
    try {
      const res = await fetch(`/api/b2b/customers/${customer.customer_id}`);
      if (res.ok) {
        const data = await res.json();
        setAddresses(data.customer?.addresses || []);
      } else {
        setAddresses([]);
      }
    } catch (err) {
      console.error("Error loading addresses:", err);
      setAddresses([]);
    } finally {
      setIsLoadingAddresses(false);
    }
  };

  const handleAssign = async (addressId: string) => {
    if (!selectedCustomer) return;
    setAssigningAddressId(addressId);
    try {
      const addr = addresses.find((a) => a.address_id === addressId);
      const addressLabel = addr?.label || `${addr?.recipient_name || ""}, ${addr?.city || ""}`;
      await onAssign(
        selectedCustomer.customer_id,
        addressId,
        getDisplayName(selectedCustomer),
        addressLabel
      );
      // Mark address as having the override
      setAddresses((prev) =>
        prev.map((a) =>
          a.address_id === addressId
            ? { ...a, tag_overrides: [...(a.tag_overrides || []), { full_tag: fullTag }] }
            : a
        )
      );
    } finally {
      setAssigningAddressId(null);
    }
  };

  return (
    <div className="rounded-lg bg-card shadow-sm border border-emerald-200">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-medium text-foreground flex items-center gap-2">
          <MapPinPlus className="h-4 w-4 text-emerald-600" />
          Add Address Override
        </h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4 space-y-3">
        {/* Step 1: Search customer */}
        {!selectedCustomer && (
          <>
            <p className="text-xs text-muted-foreground">
              Step 1: Search for a customer, then select one of their addresses.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name, email, or code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                  className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={isSearching || !search.trim()}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
              </button>
            </div>

            {error && <p className="text-sm text-red-600 text-center py-2">{error}</p>}

            {results.length > 0 && (
              <div className="divide-y divide-border border border-border rounded-lg">
                {results.map((c) => {
                  const TypeIcon = CUSTOMER_TYPE_ICONS[c.customer_type || ""] || User;
                  return (
                    <button
                      key={c.customer_id}
                      onClick={() => handleSelectCustomer(c)}
                      className="w-full px-3 py-2 flex items-center gap-2 hover:bg-muted/30 text-left"
                    >
                      <TypeIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-foreground truncate block">
                          {getDisplayName(c)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {getCode(c)}
                          {c.email && ` · ${c.email}`}
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 ml-auto flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}

            {results.length === 0 && hasSearched && !isSearching && !error && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No customers found
              </p>
            )}
          </>
        )}

        {/* Step 2: Select address */}
        {selectedCustomer && (
          <>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setSelectedCustomer(null); setAddresses([]); }}
                className="p-1 rounded hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <p className="text-sm text-foreground">
                <span className="font-medium">{getDisplayName(selectedCustomer)}</span>
                <span className="text-muted-foreground ml-2 text-xs">{getCode(selectedCustomer)}</span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Step 2: Select an address to assign this tag as override.
            </p>

            {isLoadingAddresses ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : addresses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                This customer has no addresses
              </p>
            ) : (
              <div className="divide-y divide-border border border-border rounded-lg">
                {addresses.map((addr) => {
                  const hasOverride = addr.tag_overrides?.some((t) => t.full_tag === fullTag);
                  return (
                    <div key={addr.address_id} className="px-3 py-2 flex items-center justify-between hover:bg-muted/30">
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-foreground truncate block">
                            {addr.label || addr.recipient_name}
                          </span>
                          <span className="text-xs text-muted-foreground">{addr.city}</span>
                        </div>
                      </div>
                      {hasOverride ? (
                        <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs">
                          Already assigned
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAssign(addr.address_id)}
                          disabled={assigningAddressId === addr.address_id}
                          className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded text-xs font-medium hover:bg-emerald-100 transition disabled:opacity-50"
                        >
                          {assigningAddressId === addr.address_id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            "Assign"
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
