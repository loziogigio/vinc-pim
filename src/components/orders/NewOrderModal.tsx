"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  X,
  Search,
  Building2,
  User,
  Loader2,
  Plus,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";

interface Customer {
  customer_id: string;
  company_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  public_code?: string;
  external_code?: string;
  customer_type?: string;
}

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated?: (orderId: string) => void;
}

export function NewOrderModal({ isOpen, onClose, onOrderCreated }: NewOrderModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const tenantPrefix = pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [searchQuery, setSearchQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Debounced search
  const searchCustomers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setCustomers([]);
      return;
    }

    setIsSearching(true);
    try {
      const params = new URLSearchParams();
      params.set("search", query);
      params.set("limit", "10");

      const res = await fetch(`/api/b2b/customers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
      }
    } catch (error) {
      console.error("Error searching customers:", error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchCustomers(searchQuery);
      } else {
        setCustomers([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchCustomers]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setCustomers([]);
      setSelectedCustomer(null);
      setIsCreating(false);
    }
  }, [isOpen]);

  const handleCreateOrder = async () => {
    if (!selectedCustomer) {
      toast.error("Please select a customer");
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/b2b/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: selectedCustomer.customer_id,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const orderId = data.order?.order_id;
        toast.success("Order created successfully");
        onClose();

        if (onOrderCreated) {
          onOrderCreated(orderId);
        } else if (orderId) {
          router.push(`${tenantPrefix}/b2b/store/orders/${orderId}`);
        }
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to create order");
      }
    } catch (error) {
      console.error("Error creating order:", error);
      toast.error("Failed to create order");
    } finally {
      setIsCreating(false);
    }
  };

  const getCustomerDisplayName = (customer: Customer) => {
    if (customer.company_name) return customer.company_name;
    const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(" ");
    return fullName || customer.email || customer.customer_id;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-card rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">New Order</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Customer Search */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Select Customer
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, email, or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                autoFocus
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Search Results */}
          {customers.length > 0 && !selectedCustomer && (
            <div className="border border-border rounded-lg max-h-64 overflow-y-auto">
              {customers.map((customer) => (
                <button
                  key={customer.customer_id}
                  onClick={() => {
                    setSelectedCustomer(customer);
                    setSearchQuery("");
                    setCustomers([]);
                  }}
                  className="w-full p-3 text-left hover:bg-muted/50 flex items-center gap-3 border-b border-border last:border-b-0 transition"
                >
                  <div className={`p-2 rounded-lg ${
                    customer.customer_type === "business"
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-purple-100 text-purple-600"
                  }`}>
                    {customer.customer_type === "business" ? (
                      <Building2 className="h-4 w-4" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">
                      {getCustomerDisplayName(customer)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {customer.public_code && (
                        <span className="font-mono text-primary">{customer.public_code}</span>
                      )}
                      {customer.email && (
                        <span className="truncate">{customer.email}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No Results */}
          {searchQuery.length >= 2 && customers.length === 0 && !isSearching && !selectedCustomer && (
            <div className="text-center py-6 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No customers found</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          )}

          {/* Selected Customer */}
          {selectedCustomer && (
            <div className="border border-primary/30 bg-primary/5 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    selectedCustomer.customer_type === "business"
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-purple-100 text-purple-600"
                  }`}>
                    {selectedCustomer.customer_type === "business" ? (
                      <Building2 className="h-5 w-5" />
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">
                      {getCustomerDisplayName(selectedCustomer)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {selectedCustomer.public_code && (
                        <span className="font-mono text-primary font-medium">
                          {selectedCustomer.public_code}
                        </span>
                      )}
                      {selectedCustomer.email && (
                        <span>{selectedCustomer.email}</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1 hover:bg-muted rounded-full text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Help Text */}
          {!selectedCustomer && searchQuery.length < 2 && (
            <div className="text-center py-4 text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Type at least 2 characters to search</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateOrder}
            disabled={!selectedCustomer || isCreating}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isCreating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create Order
          </button>
        </div>
      </div>
    </div>
  );
}
