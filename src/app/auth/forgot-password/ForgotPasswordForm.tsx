"use client";

/**
 * Forgot Password Form Component
 *
 * Client component that handles the forgot password form submission.
 */

import { useState, useCallback } from "react";
import { Loader2, AlertCircle, CheckCircle, Building2, Lock, Mail } from "lucide-react";

interface ForgotPasswordFormProps {
  tenantId?: string;
  tenantName?: string;
  initialEmail?: string;
  loginUrl: string;
}

export function ForgotPasswordForm({
  tenantId: initialTenantId,
  tenantName,
  initialEmail,
  loginUrl,
}: ForgotPasswordFormProps) {
  const [email, setEmail] = useState(initialEmail || "");
  const [tenantId, setTenantId] = useState(initialTenantId || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Tenant is locked when provided via URL
  const isTenantLocked = !!initialTenantId;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setIsLoading(true);

      try {
        const response = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            tenant_id: tenantId,
            // Don't provide password - API will generate temp password and send email
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.message || "Si è verificato un errore");
          return;
        }

        // Success - show confirmation
        setSuccess(true);
      } catch (err) {
        console.error("Reset password error:", err);
        setError("Errore di connessione. Riprova più tardi.");
      } finally {
        setIsLoading(false);
      }
    },
    [email, tenantId]
  );

  // Success state
  if (success) {
    return (
      <div className="space-y-6">
        <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-lg text-center">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-emerald-800 mb-2">
            Email inviata!
          </h3>
          <p className="text-sm text-emerald-700">
            Abbiamo inviato una password temporanea a{" "}
            <span className="font-medium">{email}</span>.
          </p>
          <p className="text-sm text-emerald-600 mt-2">
            Controlla la tua casella di posta (anche lo spam) e usa la nuova
            password per accedere.
          </p>
        </div>

        <a
          href={loginUrl}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all"
        >
          <Mail className="w-5 h-5" />
          Vai al login
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Tenant Display - Locked when provided */}
      {isTenantLocked ? (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {tenantName || initialTenantId}
              </p>
              {tenantName && (
                <p className="text-xs text-slate-500">{initialTenantId}</p>
              )}
            </div>
            <Lock className="w-4 h-4 text-slate-400" />
          </div>
        </div>
      ) : (
        <div>
          <label
            htmlFor="tenant_id"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            ID Tenant
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Building2 className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              id="tenant_id"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value.toLowerCase().trim())}
              placeholder="es. hidros-it"
              required
              className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>
        </div>
      )}

      {/* Email */}
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-slate-700 mb-1.5"
        >
          Email
        </label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nome@esempio.it"
          autoComplete="email"
          required
          className="block w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Invio in corso...</span>
          </>
        ) : (
          <>
            <Mail className="w-5 h-5" />
            <span>Invia password temporanea</span>
          </>
        )}
      </button>
    </form>
  );
}
