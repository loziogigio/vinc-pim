"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import {
  Users,
  Building2,
  User,
  Store,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { CreateCustomerModal } from "@/components/documents/CreateCustomerModal";
import type { Customer } from "@/lib/types/customer";

interface CustomerStats {
  total: number;
  business: number;
  private: number;
  reseller: number;
  guests: number;
  recent: Customer[];
}

export default function CustomersOverviewPage() {
  const pathname = usePathname();
  const router = useRouter();

  // Extract tenant from URL (e.g., /dfl-eventi-it/b2b/store/customers -> dfl-eventi-it)
  const tenantMatch = pathname?.match(/^\/([^/]+)\/b2b/);
  const tenantPrefix = tenantMatch ? `/${tenantMatch[1]}` : "";
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [stats, setStats] = useState<CustomerStats>({
    total: 0,
    business: 0,
    private: 0,
    reseller: 0,
    guests: 0,
    recent: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    setIsLoading(true);
    try {
      // Fetch total and recent
      const res = await fetch("/api/b2b/customers?limit=5");
      if (res.ok) {
        const data = await res.json();
        const customers: Customer[] = data.customers || [];

        // Count by type
        const business = customers.filter((c) => c.customer_type === "business").length;
        const privateCount = customers.filter((c) => c.customer_type === "private").length;
        const reseller = customers.filter((c) => c.customer_type === "reseller").length;
        const guests = customers.filter((c) => c.is_guest).length;

        setStats({
          total: data.pagination?.total || customers.length,
          business,
          private: privateCount,
          reseller,
          guests,
          recent: customers.slice(0, 5),
        });
      }
    } catch (error) {
      console.error("Error fetching customer stats:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const statCards = [
    {
      label: "Total Customers",
      value: stats.total,
      icon: Users,
      color: "text-blue-600 bg-blue-100",
      href: `${tenantPrefix}/b2b/store/customers/list`,
    },
    {
      label: "Business",
      value: stats.business,
      icon: Building2,
      color: "text-emerald-600 bg-emerald-100",
      href: `${tenantPrefix}/b2b/store/customers/business`,
    },
    {
      label: "Private",
      value: stats.private,
      icon: User,
      color: "text-purple-600 bg-purple-100",
      href: `${tenantPrefix}/b2b/store/customers/private`,
    },
    {
      label: "Resellers",
      value: stats.reseller,
      icon: Store,
      color: "text-amber-600 bg-amber-100",
      href: `${tenantPrefix}/b2b/store/customers/reseller`,
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Customers" }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customers Overview</h1>
          <p className="text-sm text-muted-foreground">
            Manage your customer profiles and addresses
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#009688] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#00796b]"
        >
          <UserPlus className="h-4 w-4" />
          New Customer
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="rounded-lg bg-card p-5 shadow-sm hover:shadow-md transition group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {isLoading ? "..." : stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-xs text-muted-foreground group-hover:text-primary transition">
                <TrendingUp className="h-3 w-3 mr-1" />
                View details
              </div>
            </Link>
          );
        })}
      </div>

      {/* Recent Customers */}
      <div className="rounded-lg bg-card shadow-sm">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Recent Customers</h2>
            <Link
              href={`${tenantPrefix}/b2b/store/customers/list`}
              className="text-sm text-primary hover:underline"
            >
              View all
            </Link>
          </div>
        </div>
        <div className="divide-y divide-border">
          {isLoading ? (
            <div className="p-8">
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          ) : stats.recent.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Users className="mx-auto h-10 w-10 mb-2 opacity-50" />
              <p>No customers yet</p>
            </div>
          ) : (
            stats.recent.map((customer) => (
              <Link
                key={customer.customer_id}
                href={`${tenantPrefix}/b2b/store/customers/${customer.customer_id}`}
                className="flex items-center justify-between p-4 hover:bg-muted/30 transition"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${
                    customer.customer_type === "business"
                      ? "bg-emerald-100 text-emerald-600"
                      : customer.customer_type === "private"
                      ? "bg-purple-100 text-purple-600"
                      : "bg-amber-100 text-amber-600"
                  }`}>
                    {customer.customer_type === "business" ? (
                      <Building2 className="h-4 w-4" />
                    ) : customer.customer_type === "private" ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Store className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {customer.company_name || `${customer.first_name} ${customer.last_name}`}
                    </p>
                    <p className="text-sm text-muted-foreground">{customer.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                    {customer.customer_type}
                  </span>
                  {customer.is_guest && (
                    <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-600">
                      Guest
                    </span>
                  )}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Create Customer Modal */}
      {showCreateModal && (
        <CreateCustomerModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(customer) => {
            setShowCreateModal(false);
            router.push(`${tenantPrefix}/b2b/store/customers/${customer.customer_id}`);
          }}
        />
      )}
    </div>
  );
}
