"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Monitor,
  Users,
  AlertTriangle,
  Ban,
  History,
  ShieldCheck,
  Loader2,
} from "lucide-react";

interface Stats {
  active_sessions: number;
  unique_users: number;
  failed_logins_24h: number;
  blocked_ips: number;
}

const DEFAULT_STATS: Stats = {
  active_sessions: 0,
  unique_users: 0,
  failed_logins_24h: 0,
  blocked_ips: 0,
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/b2b/admin/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error loading admin stats:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Gestione sessioni e sicurezza
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Sessioni Attive"
              value={stats.active_sessions}
              icon={Monitor}
              color="bg-blue-500"
            />
            <StatCard
              label="Utenti Unici"
              value={stats.unique_users}
              icon={Users}
              color="bg-emerald-500"
            />
            <StatCard
              label="Login Falliti (24h)"
              value={stats.failed_logins_24h}
              icon={AlertTriangle}
              color="bg-amber-500"
            />
            <StatCard
              label="IP Bloccati"
              value={stats.blocked_ips}
              icon={Ban}
              color="bg-rose-500"
            />
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <QuickActionCard
              href="/b2b/admin/sessions"
              title="Sessioni"
              description="Gestisci sessioni attive"
              icon={Monitor}
            />
            <QuickActionCard
              href="/b2b/admin/login-attempts"
              title="Login Attempts"
              description="Cronologia accessi"
              icon={History}
            />
            <QuickActionCard
              href="/b2b/admin/security"
              title="Sicurezza"
              description="Configura limiti e policy"
              icon={ShieldCheck}
            />
            <QuickActionCard
              href="/b2b/admin/blocked-ips"
              title="IP Bloccati"
              description="Gestisci blacklist"
              icon={Ban}
            />
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <Link
      href={href}
      className="block bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-slate-400" />
        <div>
          <p className="font-medium text-slate-900">{title}</p>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>
    </Link>
  );
}
