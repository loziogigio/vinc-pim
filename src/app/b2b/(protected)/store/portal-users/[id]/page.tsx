"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import type { IPortalUser, ICustomerAccess } from "@/lib/types/portal-user";
import type { Customer } from "@/lib/types/customer";
import {
  ArrowLeft,
  UserCog,
  Mail,
  Calendar,
  Edit,
  Trash2,
  Plus,
  Users,
  MapPin,
  CheckCircle,
  XCircle,
  Save,
  X,
  Key,
  Clock,
  Building2,
  User,
  Store,
  Eye,
  EyeOff,
} from "lucide-react";

type CustomerWithDetails = Customer & {
  display_name?: string;
};

export default function PortalUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const pathname = usePathname();

  // Extract tenant from URL
  const tenantMatch = pathname?.match(/^\/([^/]+)\/b2b/);
  const tenantPrefix = tenantMatch ? `/${tenantMatch[1]}` : "";

  const [portalUser, setPortalUser] = useState<IPortalUser | null>(null);
  const [customers, setCustomers] = useState<CustomerWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit states
  const [isEditingBasic, setIsEditingBasic] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form states
  const [basicForm, setBasicForm] = useState({ username: "", email: "" });
  const [passwordForm, setPasswordForm] = useState({ password: "", confirm: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [searchResults, setSearchResults] = useState<CustomerWithDetails[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchPortalUser();
    fetchAssociatedCustomers();
  }, [id]);

  async function fetchPortalUser() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/b2b/portal-users/${id}`);
      if (res.ok) {
        const data = await res.json();
        setPortalUser(data.portal_user);
        setBasicForm({
          username: data.portal_user.username,
          email: data.portal_user.email,
        });
      } else if (res.status === 404) {
        setError("Portal user not found");
      } else {
        setError("Failed to load portal user");
      }
    } catch (err) {
      console.error("Error fetching portal user:", err);
      setError("Failed to load portal user");
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchAssociatedCustomers() {
    if (!portalUser?.customer_access?.length) {
      setCustomers([]);
      return;
    }

    try {
      // Fetch details for each customer in the access list
      const customerIds = portalUser.customer_access.map((ca) => ca.customer_id);
      const customerPromises = customerIds.map((custId) =>
        fetch(`/api/b2b/customers/${custId}`).then((res) =>
          res.ok ? res.json().then((d) => d.customer) : null
        )
      );
      const results = await Promise.all(customerPromises);
      setCustomers(results.filter(Boolean));
    } catch (err) {
      console.error("Error fetching customers:", err);
    }
  }

  useEffect(() => {
    if (portalUser) {
      fetchAssociatedCustomers();
    }
  }, [portalUser?.customer_access]);

  async function searchCustomers() {
    if (!customerSearch.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/b2b/customers?search=${encodeURIComponent(customerSearch)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        // Filter out already added customers
        const existingIds = new Set(portalUser?.customer_access?.map((ca) => ca.customer_id) || []);
        setSearchResults(data.customers.filter((c: CustomerWithDetails) => !existingIds.has(c.customer_id)));
      }
    } catch (err) {
      console.error("Error searching customers:", err);
    } finally {
      setIsSearching(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAddingCustomer) {
        searchCustomers();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch, isAddingCustomer]);

  async function handleSaveBasic(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const res = await fetch(`/api/b2b/portal-users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: basicForm.username,
          email: basicForm.email,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPortalUser(data.portal_user);
        setIsEditingBasic(false);
        setSaveSuccess("User details updated successfully");
        setTimeout(() => setSaveSuccess(null), 3000);
      } else {
        const data = await res.json();
        setSaveError(data.error || "Failed to update user");
      }
    } catch (err) {
      setSaveError("Failed to update user");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    if (passwordForm.password !== passwordForm.confirm) {
      setSaveError("Passwords do not match");
      return;
    }
    if (passwordForm.password.length < 8) {
      setSaveError("Password must be at least 8 characters");
      return;
    }

    setIsSubmitting(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const res = await fetch(`/api/b2b/portal-users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: passwordForm.password,
        }),
      });

      if (res.ok) {
        setIsEditingPassword(false);
        setPasswordForm({ password: "", confirm: "" });
        setSaveSuccess("Password updated successfully");
        setTimeout(() => setSaveSuccess(null), 3000);
      } else {
        const data = await res.json();
        setSaveError(data.error || "Failed to update password");
      }
    } catch (err) {
      setSaveError("Failed to update password");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleActive() {
    setIsSubmitting(true);
    setSaveError(null);

    try {
      const res = await fetch(`/api/b2b/portal-users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_active: !portalUser?.is_active,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPortalUser(data.portal_user);
        setSaveSuccess(`User ${data.portal_user.is_active ? "activated" : "deactivated"} successfully`);
        setTimeout(() => setSaveSuccess(null), 3000);
      } else {
        const data = await res.json();
        setSaveError(data.error || "Failed to update status");
      }
    } catch (err) {
      setSaveError("Failed to update status");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    setSaveError(null);

    try {
      const res = await fetch(`/api/b2b/portal-users/${id}?hard=true`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.push(`${tenantPrefix}/b2b/store/portal-users`);
      } else {
        const data = await res.json();
        setSaveError(data.error || "Failed to delete user");
        setShowDeleteConfirm(false);
      }
    } catch (err) {
      setSaveError("Failed to delete user");
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleAddCustomer(customer: CustomerWithDetails, addressAccess: "all" | string[]) {
    setIsSubmitting(true);
    setSaveError(null);

    const newAccess: ICustomerAccess[] = [
      ...(portalUser?.customer_access || []),
      { customer_id: customer.customer_id, address_access: addressAccess },
    ];

    try {
      const res = await fetch(`/api/b2b/portal-users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_access: newAccess,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPortalUser(data.portal_user);
        setIsAddingCustomer(false);
        setCustomerSearch("");
        setSearchResults([]);
        setSaveSuccess("Customer access added");
        setTimeout(() => setSaveSuccess(null), 3000);
      } else {
        const data = await res.json();
        setSaveError(data.error || "Failed to add customer access");
      }
    } catch (err) {
      setSaveError("Failed to add customer access");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemoveCustomer(customerId: string) {
    setIsSubmitting(true);
    setSaveError(null);

    const newAccess = (portalUser?.customer_access || []).filter(
      (ca) => ca.customer_id !== customerId
    );

    try {
      const res = await fetch(`/api/b2b/portal-users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_access: newAccess,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPortalUser(data.portal_user);
        setSaveSuccess("Customer access removed");
        setTimeout(() => setSaveSuccess(null), 3000);
      } else {
        const data = await res.json();
        setSaveError(data.error || "Failed to remove customer access");
      }
    } catch (err) {
      setSaveError("Failed to remove customer access");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateAddressAccess(customerId: string, addressAccess: "all" | string[]) {
    setIsSubmitting(true);
    setSaveError(null);

    const newAccess = (portalUser?.customer_access || []).map((ca) =>
      ca.customer_id === customerId ? { ...ca, address_access: addressAccess } : ca
    );

    try {
      const res = await fetch(`/api/b2b/portal-users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_access: newAccess,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPortalUser(data.portal_user);
        setSaveSuccess("Address access updated");
        setTimeout(() => setSaveSuccess(null), 3000);
      } else {
        const data = await res.json();
        setSaveError(data.error || "Failed to update address access");
      }
    } catch (err) {
      setSaveError("Failed to update address access");
    } finally {
      setIsSubmitting(false);
    }
  }

  const getTypeIcon = (type: string) => {
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
  };

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      business: "bg-emerald-100 text-emerald-700",
      private: "bg-purple-100 text-purple-700",
      reseller: "bg-amber-100 text-amber-700",
    };
    return styles[type] || "bg-gray-100 text-gray-700";
  };

  const getCustomerDisplayName = (customer: CustomerWithDetails) => {
    return customer.company_name ||
      `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
      customer.email;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-gray-200 rounded mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !portalUser) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Portal Users", href: `${tenantPrefix}/b2b/store/portal-users` },
            { label: "Error" },
          ]}
        />
        <div className="rounded-lg bg-card p-8 shadow-sm text-center">
          <UserCog className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
          <h2 className="text-lg font-semibold text-foreground mb-2">
            {error || "Portal user not found"}
          </h2>
          <Link
            href={`${tenantPrefix}/b2b/store/portal-users`}
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to portal users
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Portal Users", href: `${tenantPrefix}/b2b/store/portal-users` },
          { label: portalUser.username },
        ]}
      />

      {/* Success/Error Messages */}
      {saveSuccess && (
        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          {saveSuccess}
        </div>
      )}
      {saveError && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
          <XCircle className="h-4 w-4" />
          {saveError}
          <button onClick={() => setSaveError(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`${tenantPrefix}/b2b/store/portal-users`}
            className="p-2 rounded-lg hover:bg-muted transition"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-blue-100 text-blue-600">
              <UserCog className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">{portalUser.username}</h1>
                {portalUser.is_active ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                    <CheckCircle className="h-3 w-3" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    <XCircle className="h-3 w-3" />
                    Inactive
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground font-mono">{portalUser.portal_user_id}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleActive}
            disabled={isSubmitting}
            className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition ${
              portalUser.is_active
                ? "text-amber-600 border-amber-200 hover:bg-amber-50"
                : "text-emerald-600 border-emerald-200 hover:bg-emerald-50"
            }`}
          >
            {portalUser.is_active ? (
              <>
                <XCircle className="h-4 w-4" />
                Deactivate
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Activate
              </>
            )}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Delete Portal User
            </h3>
            <p className="text-muted-foreground mb-4">
              Are you sure you want to permanently delete <strong>{portalUser.username}</strong>? This action cannot be undone.
            </p>
            {portalUser.customer_access && portalUser.customer_access.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-amber-700">
                  This user has access to {portalUser.customer_access.length} customer(s). The customers will not be affected.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Basic Info */}
        <div className="rounded-lg bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <User className="h-4 w-4" />
              User Information
            </h2>
            {!isEditingBasic && (
              <button
                onClick={() => setIsEditingBasic(true)}
                className="p-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-muted transition"
              >
                <Edit className="h-4 w-4" />
              </button>
            )}
          </div>

          {isEditingBasic ? (
            <form onSubmit={handleSaveBasic} className="space-y-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Username</label>
                <input
                  type="text"
                  value={basicForm.username}
                  onChange={(e) => setBasicForm({ ...basicForm, username: e.target.value })}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Email</label>
                <input
                  type="email"
                  value={basicForm.email}
                  onChange={(e) => setBasicForm({ ...basicForm, email: e.target.value })}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  required
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white text-sm rounded hover:bg-primary/90 transition disabled:opacity-50"
                >
                  <Save className="h-3 w-3" />
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingBasic(false);
                    setBasicForm({
                      username: portalUser.username,
                      email: portalUser.email,
                    });
                  }}
                  className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <UserCog className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Username</p>
                  <p className="text-sm font-medium text-foreground">{portalUser.username}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <a href={`mailto:${portalUser.email}`} className="text-sm text-primary hover:underline">
                    {portalUser.email}
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm text-foreground">
                    {new Date(portalUser.created_at).toLocaleDateString("it-IT", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Last Login</p>
                  <p className="text-sm text-foreground">
                    {portalUser.last_login_at
                      ? new Date(portalUser.last_login_at).toLocaleDateString("it-IT", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Never"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Password */}
        <div className="rounded-lg bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Key className="h-4 w-4" />
              Password
            </h2>
            {!isEditingPassword && (
              <button
                onClick={() => setIsEditingPassword(true)}
                className="p-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-muted transition"
              >
                <Edit className="h-4 w-4" />
              </button>
            )}
          </div>

          {isEditingPassword ? (
            <form onSubmit={handleSavePassword} className="space-y-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={passwordForm.password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                    className="w-full rounded border border-border bg-background px-3 py-2 pr-10 text-sm focus:border-primary focus:outline-none"
                    placeholder="Min. 8 characters"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Confirm Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  placeholder="Repeat password"
                  required
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white text-sm rounded hover:bg-primary/90 transition disabled:opacity-50"
                >
                  <Save className="h-3 w-3" />
                  Update Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingPassword(false);
                    setPasswordForm({ password: "", confirm: "" });
                  }}
                  className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-4">
              <Key className="mx-auto h-8 w-8 text-muted-foreground mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">Password is encrypted</p>
              <button
                onClick={() => setIsEditingPassword(true)}
                className="mt-2 text-sm text-primary hover:underline"
              >
                Change password
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="rounded-lg bg-card p-5 shadow-sm">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Access Summary
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">Customers</span>
              </div>
              <span className="text-lg font-bold text-foreground">
                {portalUser.customer_access?.length || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">Address Access</span>
              </div>
              <span className="text-sm font-medium text-foreground">
                {portalUser.customer_access?.some((ca) => ca.address_access === "all")
                  ? "Full access"
                  : "Restricted"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Access Section */}
      <div className="rounded-lg bg-card shadow-sm">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Users className="h-4 w-4" />
            Customer Access ({portalUser.customer_access?.length || 0})
          </h2>
          <button
            onClick={() => setIsAddingCustomer(true)}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <Plus className="h-4 w-4" />
            Add Customer
          </button>
        </div>

        {/* Add Customer Search */}
        {isAddingCustomer && (
          <div className="p-4 bg-muted/30 border-b border-border">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search customers by name, email, or code..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  autoFocus
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setIsAddingCustomer(false);
                  setCustomerSearch("");
                  setSearchResults([]);
                }}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-3 space-y-2">
                {searchResults.map((customer) => (
                  <div
                    key={customer.customer_id}
                    className="flex items-center justify-between p-3 bg-card rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${getTypeBadge(customer.customer_type)}`}>
                        {getTypeIcon(customer.customer_type)}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{getCustomerDisplayName(customer)}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {customer.public_code && (
                            <span className="font-mono">{customer.public_code}</span>
                          )}
                          <span>{customer.email}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAddCustomer(customer, "all")}
                        disabled={isSubmitting}
                        className="px-3 py-1.5 text-xs bg-primary text-white rounded hover:bg-primary/90 transition disabled:opacity-50"
                      >
                        Add (All Addresses)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {customerSearch && !isSearching && searchResults.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground text-center py-4">
                No customers found matching &quot;{customerSearch}&quot;
              </p>
            )}
          </div>
        )}

        {/* Customer List */}
        {portalUser.customer_access && portalUser.customer_access.length > 0 ? (
          <div className="divide-y divide-border">
            {customers.map((customer) => {
              const access = portalUser.customer_access?.find(
                (ca) => ca.customer_id === customer.customer_id
              );
              if (!access) return null;

              return (
                <div key={customer.customer_id} className="p-4 hover:bg-muted/30 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${getTypeBadge(customer.customer_type)}`}>
                        {getTypeIcon(customer.customer_type)}
                      </div>
                      <div>
                        <Link
                          href={`${tenantPrefix}/b2b/store/customers/${customer.customer_id}`}
                          className="font-medium text-foreground hover:text-primary"
                        >
                          {getCustomerDisplayName(customer)}
                        </Link>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {customer.public_code && (
                            <span className="font-mono text-primary font-semibold">
                              {customer.public_code}
                            </span>
                          )}
                          <span>{customer.email}</span>
                        </div>

                        {/* Address Access Info */}
                        <div className="mt-2 flex items-center gap-2">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {access.address_access === "all" ? (
                            <span className="text-xs text-emerald-600 font-medium">
                              All addresses ({customer.addresses?.length || 0})
                            </span>
                          ) : (
                            <span className="text-xs text-amber-600 font-medium">
                              {(access.address_access as string[]).length} of{" "}
                              {customer.addresses?.length || 0} addresses
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {access.address_access !== "all" && (
                        <button
                          onClick={() => handleUpdateAddressAccess(customer.customer_id, "all")}
                          disabled={isSubmitting}
                          className="px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded transition"
                        >
                          Grant all
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveCustomer(customer.customer_id)}
                        disabled={isSubmitting}
                        className="p-2 text-muted-foreground hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            <Users className="mx-auto h-10 w-10 mb-2 opacity-50" />
            <p>No customer access configured</p>
            <button
              onClick={() => setIsAddingCustomer(true)}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Add first customer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
