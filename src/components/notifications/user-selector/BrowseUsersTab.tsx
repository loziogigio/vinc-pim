"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Building2, User, Loader2, Users, Check, AlertTriangle } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { useTranslation } from "@/lib/i18n/useTranslation";

export type UserType = "b2b" | "portal";

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  type: UserType;
  role?: string;
}

export interface SelectedUser {
  id: string;
  email: string;
  name: string;
  type: UserType;
}

interface BrowseUsersTabProps {
  selectedUsers: SelectedUser[];
  onToggleUser: (user: ApiUser) => void;
  onSelectAll: (users: ApiUser[]) => void;
}

export function BrowseUsersTab({ selectedUsers, onToggleUser, onSelectAll }: BrowseUsersTabProps) {
  const { t } = useTranslation();
  const [userType, setUserType] = useState<UserType>("b2b");
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [showConfirmAll, setShowConfirmAll] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);
  const selectedIds = new Set(selectedUsers.map((u) => u.id));

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const endpoint = userType === "b2b" ? "/api/b2b/users/list" : "/api/b2b/portal-users";
      const params = new URLSearchParams({
        limit: "50",
        ...(debouncedSearch && { search: debouncedSearch }),
      });

      const res = await fetch(`${endpoint}?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();

        if (userType === "b2b") {
          setUsers(data.users || []);
        } else {
          const portalUsers = (data.portal_users || []).map(
            (u: { portal_user_id: string; username: string; email: string }) => ({
              id: u.portal_user_id,
              name: u.username,
              email: u.email,
              type: "portal" as UserType,
            })
          );
          setUsers(portalUsers);
        }
        setTotal(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error("Error loading users:", error);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [userType, debouncedSearch]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSelectAll = () => {
    onSelectAll(users);
    setShowConfirmAll(false);
  };

  return (
    <div className="p-4">
      {/* User Type Tabs */}
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => { setUserType("b2b"); setSearchQuery(""); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            userType === "b2b" ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          <Building2 className="w-4 h-4" />
          {t("pages.notifications.campaigns.browseUsers.b2bUsers")}
        </button>
        <button
          type="button"
          onClick={() => { setUserType("portal"); setSearchQuery(""); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            userType === "portal" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          <User className="w-4 h-4" />
          {t("pages.notifications.campaigns.browseUsers.portalCustomers")}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder={t("pages.notifications.campaigns.browseUsers.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* User List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
          <span className="text-sm text-muted-foreground">{t("pages.notifications.campaigns.browseUsers.loadingUsers")}</span>
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {searchQuery ? t("pages.notifications.campaigns.browseUsers.noUserFound") : t("pages.notifications.campaigns.browseUsers.noUserAvailable")}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-border flex-wrap gap-2">
            <span className="text-xs text-muted-foreground">
              {userType === "b2b"
                ? t("pages.notifications.campaigns.browseUsers.totalB2bUsers", { count: total })
                : t("pages.notifications.campaigns.browseUsers.totalPortalCustomers", { count: total })}
            </span>
            <button
              type="button"
              onClick={() => setShowConfirmAll(true)}
              className="text-xs text-primary hover:underline"
            >
              {t("pages.notifications.campaigns.browseUsers.selectAllVisible")}
            </button>
          </div>

          {users.map((user) => {
            const isSelected = selectedIds.has(user.id);
            return (
              <button
                key={user.id}
                type="button"
                onClick={() => onToggleUser(user)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition ${
                  isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center h-5">
                  <input type="checkbox" checked={isSelected} onChange={() => {}} className="w-4 h-4 rounded border-border text-primary" />
                </div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${user.type === "b2b" ? "bg-blue-100 dark:bg-blue-900/40" : "bg-emerald-100 dark:bg-emerald-900/40"}`}>
                  {user.type === "b2b" ? <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-300" /> : <User className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                {isSelected && <Check className="w-5 h-5 text-primary flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Confirm Select All Modal */}
      {showConfirmAll && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-card rounded-xl shadow-xl border border-border max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-300" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground">{t("pages.notifications.campaigns.browseUsers.confirmSelectionTitle")}</h4>
                <p className="text-sm text-muted-foreground">
                  {t("pages.notifications.campaigns.browseUsers.confirmSelectionDesc", {
                    count: users.length,
                    type: userType === "b2b" ? t("pages.notifications.campaigns.browseUsers.usersLabel") : t("pages.notifications.campaigns.browseUsers.customersLabel"),
                  })}
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t("pages.notifications.campaigns.browseUsers.confirmSelectionBody")}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowConfirmAll(false)} className="px-4 py-2 border border-border rounded-lg hover:bg-muted/50 text-foreground">
                {t("common.cancel")}
              </button>
              <button onClick={handleSelectAll} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">
                {t("common.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
