"use client";

import { useState } from "react";
import {
  Search,
  UserPlus,
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
  assignedCustomerIds: Set<string>;
  onAssign: (customerId: string) => Promise<void>;
  onClose: () => void;
}

export function AddCustomerToTagPanel({ assignedCustomerIds, onAssign, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CustomerEntry[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTotal, setSearchTotal] = useState<number | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setIsSearching(true);
    setError(null);
    setSearchTotal(null);
    try {
      const params = new URLSearchParams({ search, limit: "20" });
      const res = await fetch(`/api/b2b/customers?${params}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        setError(errData?.error || `Error ${res.status}`);
        setResults([]);
        return;
      }
      const data = await res.json();
      const allResults: CustomerEntry[] = data.customers || [];
      setSearchTotal(allResults.length);
      setResults(allResults.filter((c) => !assignedCustomerIds.has(c.customer_id)));
    } catch (err) {
      console.error("Error searching customers:", err);
      setError("Network error");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAssign = async (customerId: string) => {
    setAssigningId(customerId);
    try {
      await onAssign(customerId);
      setResults((prev) => prev.filter((c) => c.customer_id !== customerId));
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <div className="rounded-lg bg-card shadow-sm border border-emerald-200">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-medium text-foreground flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-emerald-600" />
          Add Customer to Tag
        </h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4 space-y-3">
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

        {results.length > 0 && (
          <div className="divide-y divide-border border border-border rounded-lg">
            {results.map((c) => {
              const TypeIcon = CUSTOMER_TYPE_ICONS[c.customer_type || ""] || User;
              return (
                <div key={c.customer_id} className="px-3 py-2 flex items-center justify-between hover:bg-muted/30">
                  <div className="flex items-center gap-2 min-w-0">
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
                  </div>
                  <button
                    onClick={() => handleAssign(c.customer_id)}
                    disabled={assigningId === c.customer_id}
                    className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded text-xs font-medium hover:bg-emerald-100 transition disabled:opacity-50"
                  >
                    {assigningId === c.customer_id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      "Assign"
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {error && <p className="text-sm text-red-600 text-center py-2">{error}</p>}

        {results.length === 0 && !error && searchTotal !== null && !isSearching && (
          <p className="text-sm text-muted-foreground text-center py-2">
            {searchTotal === 0
              ? "No customers found matching your search"
              : "All matching customers are already assigned to this tag"}
          </p>
        )}
      </div>
    </div>
  );
}
