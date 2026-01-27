"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck,
  Loader2,
  Save,
  Clock,
  Lock,
  Bell,
  Key,
} from "lucide-react";

interface SecurityConfig {
  tenant_id: string;
  max_sessions_per_user: number;
  session_timeout_hours: number;
  max_login_attempts: number;
  lockout_minutes: number;
  enable_progressive_delay: boolean;
  require_strong_password: boolean;
  password_expiry_days?: number;
  notify_on_new_device: boolean;
  notify_on_suspicious_login: boolean;
  notify_on_password_change: boolean;
  alert_email?: string;
}

export default function SecurityPage() {
  const [config, setConfig] = useState<SecurityConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/b2b/admin/security");
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (error) {
      console.error("Error loading security config:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    if (!config) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/b2b/admin/security", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: "Configurazione salvata" });
        setConfig(data.config);
      } else {
        setMessage({ type: "error", text: data.error || "Errore nel salvataggio" });
      }
    } catch (error) {
      console.error("Error saving security config:", error);
      setMessage({ type: "error", text: "Errore nel salvataggio" });
    } finally {
      setIsSaving(false);
    }
  };

  const updateConfig = <K extends keyof SecurityConfig>(
    key: K,
    value: SecurityConfig[K]
  ) => {
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-6">
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">Impossibile caricare la configurazione</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sicurezza</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configura i limiti di sessione e le policy di sicurezza
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Salva
        </button>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        {/* Session Limits */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Limiti Sessione</h2>
              <p className="text-sm text-slate-500">Gestisci durata e numero di sessioni</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Max sessioni per utente
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={config.max_sessions_per_user}
                onChange={(e) =>
                  updateConfig("max_sessions_per_user", parseInt(e.target.value) || 5)
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">
                Numero massimo di dispositivi/browser attivi contemporaneamente
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Timeout sessione (ore)
              </label>
              <input
                type="number"
                min={1}
                max={720}
                value={config.session_timeout_hours}
                onChange={(e) =>
                  updateConfig("session_timeout_hours", parseInt(e.target.value) || 24)
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">
                Durata massima della sessione prima del logout automatico
              </p>
            </div>
          </div>
        </div>

        {/* Login Protection */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Lock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Protezione Login</h2>
              <p className="text-sm text-slate-500">Limiti tentativi e blocco account</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Max tentativi login
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={config.max_login_attempts}
                onChange={(e) =>
                  updateConfig("max_login_attempts", parseInt(e.target.value) || 5)
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">
                Tentativi falliti prima del blocco temporaneo
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Durata blocco (minuti)
              </label>
              <input
                type="number"
                min={1}
                max={1440}
                value={config.lockout_minutes}
                onChange={(e) =>
                  updateConfig("lockout_minutes", parseInt(e.target.value) || 15)
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">
                Tempo di blocco dopo tentativi falliti
              </p>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.enable_progressive_delay}
              onChange={(e) =>
                updateConfig("enable_progressive_delay", e.target.checked)
              }
              className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
            />
            <div>
              <span className="text-sm font-medium text-slate-700">
                Ritardo progressivo
              </span>
              <p className="text-xs text-slate-500">
                Aumenta il tempo di attesa tra tentativi falliti
              </p>
            </div>
          </label>
        </div>

        {/* Password Policy */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
              <Key className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Policy Password</h2>
              <p className="text-sm text-slate-500">Requisiti e scadenza password</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.require_strong_password}
                onChange={(e) =>
                  updateConfig("require_strong_password", e.target.checked)
                }
                className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
              />
              <div>
                <span className="text-sm font-medium text-slate-700">
                  Richiedi password forte
                </span>
                <p className="text-xs text-slate-500">
                  Minimo 8 caratteri, maiuscole, minuscole, numeri e simboli
                </p>
              </div>
            </label>

            <div className="max-w-xs">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Scadenza password (giorni)
              </label>
              <input
                type="number"
                min={0}
                max={365}
                value={config.password_expiry_days || ""}
                placeholder="Mai"
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value) : undefined;
                  updateConfig("password_expiry_days", val);
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">
                0 o vuoto = nessuna scadenza
              </p>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center">
              <Bell className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Notifiche</h2>
              <p className="text-sm text-slate-500">Avvisi di sicurezza</p>
            </div>
          </div>

          <div className="space-y-4 mb-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.notify_on_new_device}
                onChange={(e) =>
                  updateConfig("notify_on_new_device", e.target.checked)
                }
                className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
              />
              <div>
                <span className="text-sm font-medium text-slate-700">
                  Nuovo dispositivo
                </span>
                <p className="text-xs text-slate-500">
                  Notifica quando si accede da un dispositivo non riconosciuto
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.notify_on_suspicious_login}
                onChange={(e) =>
                  updateConfig("notify_on_suspicious_login", e.target.checked)
                }
                className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
              />
              <div>
                <span className="text-sm font-medium text-slate-700">
                  Login sospetto
                </span>
                <p className="text-xs text-slate-500">
                  Notifica per accessi da posizioni o IP insoliti
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.notify_on_password_change}
                onChange={(e) =>
                  updateConfig("notify_on_password_change", e.target.checked)
                }
                className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
              />
              <div>
                <span className="text-sm font-medium text-slate-700">
                  Cambio password
                </span>
                <p className="text-xs text-slate-500">
                  Conferma quando la password viene modificata
                </p>
              </div>
            </label>
          </div>

          <div className="max-w-md">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email per avvisi admin
            </label>
            <input
              type="email"
              value={config.alert_email || ""}
              placeholder="admin@example.com"
              onChange={(e) => updateConfig("alert_email", e.target.value || undefined)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-500 mt-1">
              Email per ricevere avvisi di sicurezza (opzionale)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
