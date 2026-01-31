"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Building2, User, Loader2, Users, Check, AlertTriangle } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";

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
            userType === "b2b" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Building2 className="w-4 h-4" />
          Utenti B2B
        </button>
        <button
          type="button"
          onClick={() => { setUserType("portal"); setSearchQuery(""); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            userType === "portal" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <User className="w-4 h-4" />
          Clienti Portal
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Cerca per nome o email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:border-primary focus:outline-none"
        />
      </div>

      {/* User List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
          <span className="text-sm text-slate-500">Caricamento...</span>
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">
            {searchQuery ? "Nessun utente trovato" : "Nessun utente disponibile"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs text-slate-500">
              {total} {userType === "b2b" ? "utenti B2B" : "clienti"} totali
            </span>
            <button
              type="button"
              onClick={() => setShowConfirmAll(true)}
              className="text-xs text-primary hover:underline"
            >
              Seleziona tutti visibili
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
                  isSelected ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center h-5">
                  <input type="checkbox" checked={isSelected} onChange={() => {}} className="w-4 h-4 rounded border-slate-300 text-primary" />
                </div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${user.type === "b2b" ? "bg-blue-100" : "bg-emerald-100"}`}>
                  {user.type === "b2b" ? <Building2 className="w-4 h-4 text-blue-600" /> : <User className="w-4 h-4 text-emerald-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{user.name}</p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
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
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-900">Conferma selezione</h4>
                <p className="text-sm text-slate-500">
                  Stai per selezionare {users.length} {userType === "b2b" ? "utenti" : "clienti"}
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Questa azione aggiungerà tutti gli utenti visibili alla lista dei destinatari. Continuare?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowConfirmAll(false)} className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">
                Annulla
              </button>
              <button onClick={handleSelectAll} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
