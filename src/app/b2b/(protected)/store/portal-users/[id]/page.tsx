"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { ChannelSelect } from "@/components/shared/ChannelSelect";
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
  Radio,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

type CustomerWithDetails = Customer & {
  display_name?: string;
};

export default function PortalUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { t } = useTranslation();
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
  const [basicForm, setBasicForm] = useState({ username: "", email: "", channel: "default" });
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
          channel: data.portal_user.channel ?? "default",
        });
      } else if (res.status === 404) {
        setError(t("pages.store.portalUserDetail.portalUserNotFound"));
      } else {
        setError(t("pages.store.portalUserDetail.failedToLoad"));
      }
    } catch (err) {
      console.error("Error fetching portal user:", err);
      setError(t("pages.store.portalUserDetail.failedToLoad"));
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
          channel: basicForm.channel,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPortalUser(data.portal_user);
        setIsEditingBasic(false);
        setSaveSuccess(t("pages.store.portalUserDetail.userUpdated"));
        setTimeout(() => setSaveSuccess(null), 3000);
      } else {
        const data = await res.json();
        setSaveError(data.error || t("pages.store.portalUserDetail.failedToUpdate"));
      }
    } catch (err) {
      setSaveError(t("pages.store.portalUserDetail.failedToUpdate"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    if (passwordForm.password !== passwordForm.confirm) {
      setSaveError(t("pages.store.portalUserDetail.passwordsDoNotMatch"));
      return;
    }
    if (passwordForm.password.length < 8) {
      setSaveError(t("pages.store.portalUserDetail.passwordTooShort"));
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
        setSaveSuccess(t("pages.store.portalUserDetail.passwordUpdated"));
        setTimeout(() => setSaveSuccess(null), 3000);
      } else {
        const data = await res.json();
        setSaveError(data.error || t("pages.store.portalUserDetail.failedToUpdatePassword"));
      }
    } catch (err) {
      setSaveError(t("pages.store.portalUserDetail.failedToUpdatePassword"));
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
        setSaveSuccess(data.portal_user.is_active ? t("pages.store.portalUserDetail.userActivated") : t("pages.store.portalUserDetail.userDeactivated"));
        setTimeout(() => setSaveSuccess(null), 3000);
      } else {
        const data = await res.json();
        setSaveError(data.error || t("pages.store.portalUserDetail.failedToUpdateStatus"));
      }
    } catch (err) {
      setSaveError(t("pages.store.portalUserDetail.failedToUpdateStatus"));
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
        setSaveError(data.error || t("pages.store.portalUserDetail.failedToDelete"));
        setShowDeleteConfirm(false);
      }
    } catch (err) {
      setSaveError(t("pages.store.portalUserDetail.failedToDelete"));
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
        setSaveSuccess(t("pages.store.portalUserDetail.customerAccessAdded"));
        setTimeout(() => setSaveSuccess(null), 3000);
      } else {
        const data = await res.json();
        setSaveError(data.error || t("pages.store.portalUserDetail.failedToAddAccess"));
      }
    } catch (err) {
      setSaveError(t("pages.store.portalUserDetail.failedToAddAccess"));
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
        setSaveSuccess(t("pages.store.portalUserDetail.customerAccessRemoved"));
        setTimeout(() => setSaveSuccess(null), 3000);
      } else {
        const data = await res.json();
        setSaveError(data.error || t("pages.store.portalUserDetail.failedToRemoveAccess"));
      }
    } catch (err) {
      setSaveError(t("pages.store.portalUserDetail.failedToRemoveAccess"));
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
        setSaveSuccess(t("pages.store.portalUserDetail.addressAccessUpdated"));
        setTimeout(() => setSaveSuccess(null), 3000);
      } else {
        const data = await res.json();
        setSaveError(data.error || t("pages.store.portalUserDetail.failedToUpdateAccess"));
      }
    } catch (err) {
      setSaveError(t("pages.store.portalUserDetail.failedToUpdateAccess"));
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
            { label: t("pages.store.portalUsers.title"), href: "/b2b/store/portal-users" },
            { label: t("pages.store.portalUserDetail.error") },
          ]}
        />
        <div className="rounded-lg bg-card p-8 shadow-sm text-center">
          <UserCog className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
          <h2 className="text-lg font-semibold text-foreground mb-2">
            {error || t("pages.store.portalUserDetail.portalUserNotFound")}
          </h2>
          <Link
            href={`${tenantPrefix}/b2b/store/portal-users`}
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("pages.store.portalUserDetail.backToPortalUsers")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: t("pages.store.portalUsers.title"), href: "/b2b/store/portal-users" },
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
                    {t("common.active")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    <XCircle className="h-3 w-3" />
                    {t("common.inactive")}
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
                {t("pages.store.portalUserDetail.deactivate")}
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                {t("pages.store.portalUserDetail.activate")}
              </>
            )}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition"
          >
            <Trash2 className="h-4 w-4" />
            {t("common.delete")}
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {t("pages.store.portalUserDetail.deletePortalUser")}
            </h3>
            <p className="text-muted-foreground mb-4">
              {t("pages.store.portalUserDetail.deleteConfirm")} <strong>{portalUser.username}</strong>? {t("pages.store.portalUserDetail.deleteWarning")}
            </p>
            {portalUser.customer_access && portalUser.customer_access.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-amber-700">
                  {t("pages.store.portalUserDetail.deleteCustomerWarning").replace("{count}", String(portalUser.customer_access.length))}
                </p>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                    {t("pages.store.portalUserDetail.deleting")}
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    {t("common.delete")}
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
              {t("pages.store.portalUserDetail.userInformation")}
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
                <label className="block text-xs text-muted-foreground mb-1">{t("pages.store.portalUserDetail.usernameLabel")}</label>
                <input
                  type="text"
                  value={basicForm.username}
                  onChange={(e) => setBasicForm({ ...basicForm, username: e.target.value })}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t("pages.store.portalUserDetail.emailLabel")}</label>
                <input
                  type="email"
                  value={basicForm.email}
                  onChange={(e) => setBasicForm({ ...basicForm, email: e.target.value })}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  required
                />
              </div>
              <ChannelSelect
                value={basicForm.channel}
                onChange={(code) => setBasicForm({ ...basicForm, channel: code })}
                label={t("pages.store.portalUserDetail.channelLabel")}
              />
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white text-sm rounded hover:bg-primary/90 transition disabled:opacity-50"
                >
                  <Save className="h-3 w-3" />
                  {t("common.save")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingBasic(false);
                    setBasicForm({
                      username: portalUser.username,
                      email: portalUser.email,
                      channel: portalUser.channel ?? "default",
                    });
                  }}
                  className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <UserCog className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("pages.store.portalUserDetail.usernameLabel")}</p>
                  <p className="text-sm font-medium text-foreground">{portalUser.username}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("pages.store.portalUserDetail.emailLabel")}</p>
                  <a href={`mailto:${portalUser.email}`} className="text-sm text-primary hover:underline">
                    {portalUser.email}
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Radio className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("pages.store.portalUserDetail.channelLabel")}</p>
                  <p className="text-sm font-medium text-foreground">
                    {portalUser.channel ?? "default"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("pages.store.portalUserDetail.createdLabel")}</p>
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
                  <p className="text-xs text-muted-foreground">{t("pages.store.portalUserDetail.lastLoginLabel")}</p>
                  <p className="text-sm text-foreground">
                    {portalUser.last_login_at
                      ? new Date(portalUser.last_login_at).toLocaleDateString("it-IT", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : t("pages.store.portalUserDetail.never")}
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
              {t("pages.store.portalUserDetail.passwordSection")}
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
                <label className="block text-xs text-muted-foreground mb-1">{t("pages.store.portalUserDetail.newPassword")}</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={passwordForm.password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                    className="w-full rounded border border-border bg-background px-3 py-2 pr-10 text-sm focus:border-primary focus:outline-none"
                    placeholder={t("pages.store.portalUserDetail.newPasswordPlaceholder")}
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
                <label className="block text-xs text-muted-foreground mb-1">{t("pages.store.portalUserDetail.confirmPassword")}</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  placeholder={t("pages.store.portalUserDetail.confirmPasswordPlaceholder")}
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
                  {t("pages.store.portalUserDetail.updatePassword")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingPassword(false);
                    setPasswordForm({ password: "", confirm: "" });
                  }}
                  className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-4">
              <Key className="mx-auto h-8 w-8 text-muted-foreground mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">{t("pages.store.portalUserDetail.passwordEncrypted")}</p>
              <button
                onClick={() => setIsEditingPassword(true)}
                className="mt-2 text-sm text-primary hover:underline"
              >
                {t("pages.store.portalUserDetail.changePassword")}
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="rounded-lg bg-card p-5 shadow-sm">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t("pages.store.portalUserDetail.accessSummary")}
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{t("pages.store.portalUserDetail.customersLabel")}</span>
              </div>
              <span className="text-lg font-bold text-foreground">
                {portalUser.customer_access?.length || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{t("pages.store.portalUserDetail.addressAccess")}</span>
              </div>
              <span className="text-sm font-medium text-foreground">
                {portalUser.customer_access?.some((ca) => ca.address_access === "all")
                  ? t("pages.store.portalUserDetail.fullAccess")
                  : t("pages.store.portalUserDetail.restricted")}
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
            {t("pages.store.portalUserDetail.customerAccessSection")} ({portalUser.customer_access?.length || 0})
          </h2>
          <button
            onClick={() => setIsAddingCustomer(true)}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <Plus className="h-4 w-4" />
            {t("pages.store.portalUserDetail.addCustomer")}
          </button>
        </div>

        {/* Add Customer Search */}
        {isAddingCustomer && (
          <div className="p-4 bg-muted/30 border-b border-border">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder={t("pages.store.portalUserDetail.searchCustomersPlaceholder")}
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
                {t("common.cancel")}
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
                        {t("pages.store.portalUserDetail.addAllAddresses")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {customerSearch && !isSearching && searchResults.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground text-center py-4">
                {t("pages.store.portalUserDetail.noCustomersMatchSearch")} &quot;{customerSearch}&quot;
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
                              {t("pages.store.portalUserDetail.allAddresses")} ({customer.addresses?.length || 0})
                            </span>
                          ) : (
                            <span className="text-xs text-amber-600 font-medium">
                              {(access.address_access as string[]).length} {t("pages.store.portalUserDetail.ofAddresses").replace("{total}", String(customer.addresses?.length || 0))}
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
                          {t("pages.store.portalUserDetail.grantAll")}
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
            <p>{t("pages.store.portalUserDetail.noCustomerAccess")}</p>
            <button
              onClick={() => setIsAddingCustomer(true)}
              className="mt-2 text-sm text-primary hover:underline"
            >
              {t("pages.store.portalUserDetail.addFirstCustomer")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
