"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserCog, CheckCircle, XCircle, Eye } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface PortalUserItem {
  portal_user_id: string;
  username: string;
  email: string;
  is_active: boolean;
  last_login_at: string | null;
}

interface ConnectedPortalUsersCardProps {
  customerId: string;
}

export function ConnectedPortalUsersCard({ customerId }: ConnectedPortalUsersCardProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [portalUsers, setPortalUsers] = useState<PortalUserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const tenantMatch = pathname?.match(/^\/([^/]+)\/b2b/);
  const tenantPrefix = tenantMatch ? `/${tenantMatch[1]}` : "";

  useEffect(() => {
    async function fetchPortalUsers() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/b2b/portal-users?customer_id=${customerId}&limit=50`);
        if (res.ok) {
          const data = await res.json();
          setPortalUsers(data.portal_users || []);
        }
      } catch (err) {
        console.error("Error fetching portal users:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPortalUsers();
  }, [customerId]);

  if (isLoading) {
    return (
      <div className="rounded-lg bg-card shadow-sm p-5">
        <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <UserCog className="h-4 w-4" />
          {t("pages.store.customerDetail.connectedPortalUsers")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-card shadow-sm">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <UserCog className="h-4 w-4 text-blue-600" />
          {t("pages.store.customerDetail.connectedPortalUsers")}
          {portalUsers.length > 0 && (
            <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
              {portalUsers.length}
            </span>
          )}
        </h2>
      </div>

      {portalUsers.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground text-center">
          {t("pages.store.customerDetail.noPortalUsers")}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {portalUsers.map((user) => (
            <div key={user.portal_user_id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <UserCog className="h-4 w-4 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{user.username}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                {user.is_active ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-700">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {t("common.active")}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <XCircle className="h-3.5 w-3.5" />
                    {t("common.inactive")}
                  </span>
                )}

                <span className="text-xs text-muted-foreground">
                  {user.last_login_at
                    ? new Date(user.last_login_at).toLocaleDateString("it-IT", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : t("pages.store.customerDetail.portalUserNeverLoggedIn")}
                </span>

                <Link
                  href={`${tenantPrefix}/b2b/store/portal-users/${user.portal_user_id}`}
                  className="p-1 rounded text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition"
                  title={t("common.view")}
                >
                  <Eye className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
