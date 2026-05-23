"use client";

import { useEffect, useState } from "react";
import {
  Search,
  Loader2,
  Building2,
  User,
  Store,
  Users,
  MapPin,
  Trash2,
} from "lucide-react";
import type { ICustomerAccess } from "@/lib/types/portal-user";
import type { Customer } from "@/lib/types/customer";
import { useTranslation } from "@/lib/i18n/useTranslation";

type CustomerWithDetails = Customer & {
  display_name?: string;
};

type Props = {
  value: ICustomerAccess[];
  onChange: (next: ICustomerAccess[]) => void;
  /** Pre-known customer records (by customer_id) for entries already in `value`. */
  prefetched?: Record<string, CustomerWithDetails>;
  /** Notified each time the selector loads or sees new customer details. */
  onCustomersLoaded?: (customers: CustomerWithDetails[]) => void;
  disabled?: boolean;
};

function getCustomerDisplayName(c: CustomerWithDetails) {
  return (
    c.company_name ||
    `${c.first_name || ""} ${c.last_name || ""}`.trim() ||
    c.email
  );
}

function getTypeIcon(type: string) {
  switch (type) {
    case "business":
      return <Building2 className="h-4 w-4" />;
    case "private":
      return <User className="h-4 w-4" />;
    case "reseller":
      return <Store className="h-4 w-4" />;
    default:
      return <Users className="h-4 w-4" />;
  }
}

function getTypeBadgeStyle(type: string) {
  const styles: Record<string, string> = {
    business: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    private: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
    reseller: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  };
  return styles[type] || "bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-400";
}

export function CustomerAccessSelector({
  value,
  onChange,
  prefetched,
  onCustomersLoaded,
  disabled,
}: Props) {
  const { t } = useTranslation();
  const [knownById, setKnownById] = useState<Record<string, CustomerWithDetails>>(
    prefetched || {}
  );
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CustomerWithDetails[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pickerCustomerId, setPickerCustomerId] = useState<string | null>(null);
  const [pickerAddressIds, setPickerAddressIds] = useState<string[]>([]);

  // Merge prefetched customer details into our known map whenever prop changes.
  useEffect(() => {
    if (!prefetched) return;
    setKnownById((prev) => ({ ...prev, ...prefetched }));
  }, [prefetched]);

  // Debounced customer search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!search.trim()) {
        setResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/b2b/customers?search=${encodeURIComponent(search)}&limit=10`
        );
        if (res.ok) {
          const data = await res.json();
          const existingIds = new Set(value.map((ca) => ca.customer_id));
          const filtered = (data.customers || []).filter(
            (c: CustomerWithDetails) => !existingIds.has(c.customer_id)
          );
          setResults(filtered);
          if (filtered.length && onCustomersLoaded) {
            onCustomersLoaded(filtered);
          }
        }
      } catch (err) {
        console.error("Error searching customers:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, value.length]);

  function addAccess(customer: CustomerWithDetails, addressAccess: "all" | string[]) {
    setKnownById((prev) => ({ ...prev, [customer.customer_id]: customer }));
    onChange([
      ...value,
      { customer_id: customer.customer_id, address_access: addressAccess },
    ]);
    setSearch("");
    setResults([]);
    setPickerCustomerId(null);
    setPickerAddressIds([]);
  }

  function removeAccess(customerId: string) {
    onChange(value.filter((ca) => ca.customer_id !== customerId));
  }

  function updateAccess(customerId: string, addressAccess: "all" | string[]) {
    onChange(
      value.map((ca) =>
        ca.customer_id === customerId ? { ...ca, address_access: addressAccess } : ca
      )
    );
  }

  return (
    <div className="space-y-3">
      {/* Selected list */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((access) => {
            const customer = knownById[access.customer_id];
            const totalAddresses = customer?.addresses?.length || 0;
            const isAll = access.address_access === "all";
            const selectedCount = isAll
              ? totalAddresses
              : (access.address_access as string[]).length;
            return (
              <div
                key={access.customer_id}
                className="flex items-start justify-between gap-3 p-3 bg-muted/40 rounded-lg border border-border"
              >
                <div className="flex items-start gap-2 min-w-0">
                  {customer ? (
                    <div
                      className={`p-1.5 rounded ${getTypeBadgeStyle(customer.customer_type)}`}
                    >
                      {getTypeIcon(customer.customer_type)}
                    </div>
                  ) : (
                    <div className="p-1.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-400">
                      <Users className="h-4 w-4" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {customer ? getCustomerDisplayName(customer) : access.customer_id}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {customer?.public_code && (
                        <span className="font-mono">{customer.public_code}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {isAll
                          ? t("pages.store.portalUsers.allAddresses")
                          : `${selectedCount}/${totalAddresses} ${t(
                              "pages.store.portalUsers.addresses"
                            )}`}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!isAll && (
                    <button
                      type="button"
                      onClick={() => updateAccess(access.customer_id, "all")}
                      disabled={disabled}
                      className="px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded transition disabled:opacity-50"
                    >
                      {t("pages.store.portalUsers.grantAll")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAccess(access.customer_id)}
                    disabled={disabled}
                    className="p-1 text-muted-foreground hover:text-red-600 rounded disabled:opacity-50"
                    title={t("pages.store.portalUsers.removeAccess")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={disabled}
          placeholder={t("pages.store.portalUsers.searchCustomersPlaceholder")}
          className="w-full rounded border border-border bg-background pl-9 pr-9 py-2 text-sm focus:border-primary focus:outline-none disabled:opacity-50"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Search results */}
      <div className="space-y-2 max-h-[32rem] overflow-y-auto">
        {results.map((customer) => {
          const isPicking = pickerCustomerId === customer.customer_id;
          const totalAddresses = customer.addresses?.length || 0;
          return (
            <div
              key={customer.customer_id}
              className="border border-border rounded-lg bg-card"
            >
              <div className="flex items-center justify-between p-3 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`p-1.5 rounded ${getTypeBadgeStyle(customer.customer_type)}`}
                  >
                    {getTypeIcon(customer.customer_type)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {getCustomerDisplayName(customer)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {customer.public_code && (
                        <span className="font-mono">{customer.public_code}</span>
                      )}
                      <span>{customer.email}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => addAccess(customer, "all")}
                    disabled={disabled}
                    className="px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90 transition disabled:opacity-50"
                  >
                    {t("pages.store.portalUsers.addAllAddresses")}
                  </button>
                  {totalAddresses > 0 && (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        if (isPicking) {
                          setPickerCustomerId(null);
                          setPickerAddressIds([]);
                        } else {
                          setPickerCustomerId(customer.customer_id);
                          setPickerAddressIds([]);
                        }
                      }}
                      className="px-2 py-1 text-xs border border-border text-foreground rounded hover:bg-muted transition disabled:opacity-50"
                    >
                      {isPicking
                        ? t("common.cancel")
                        : t("pages.store.portalUsers.chooseAddresses")}
                    </button>
                  )}
                </div>
              </div>
              {isPicking && (
                <div className="border-t border-border p-3 space-y-2 bg-muted/30">
                  {totalAddresses === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t("pages.store.portalUsers.noAddressesOnCustomer")}
                    </p>
                  ) : (
                    <>
                      {customer.addresses!.map((addr) => {
                        const checked = pickerAddressIds.includes(addr.address_id);
                        return (
                          <label
                            key={addr.address_id}
                            className="flex items-start gap-2 text-xs cursor-pointer p-2 rounded hover:bg-card"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setPickerAddressIds((prev) =>
                                  e.target.checked
                                    ? [...prev, addr.address_id]
                                    : prev.filter((id) => id !== addr.address_id)
                                )
                              }
                              className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-ring"
                            />
                            <span className="min-w-0">
                              {addr.label && (
                                <span className="font-medium text-foreground">
                                  {addr.label}
                                  {" · "}
                                </span>
                              )}
                              <span className="text-foreground">{addr.recipient_name}</span>
                              <span className="block text-muted-foreground">
                                {addr.street_address}, {addr.postal_code} {addr.city} (
                                {addr.province})
                              </span>
                            </span>
                          </label>
                        );
                      })}
                      <div className="flex items-center justify-end pt-2">
                        <button
                          type="button"
                          disabled={disabled || pickerAddressIds.length === 0}
                          onClick={() => addAccess(customer, [...pickerAddressIds])}
                          className="px-3 py-1.5 text-xs bg-primary text-white rounded hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {t("pages.store.portalUsers.addSelectedAddresses").replace(
                            "{n}",
                            String(pickerAddressIds.length)
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {search && !isSearching && results.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            {t("pages.store.portalUsers.noCustomersMatchSearch").replace(
              "{q}",
              search
            )}
          </p>
        )}
        {!search && value.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            {t("pages.store.portalUsers.searchCustomersHint")}
          </p>
        )}
      </div>
    </div>
  );
}
