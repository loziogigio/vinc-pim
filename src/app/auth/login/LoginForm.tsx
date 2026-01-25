"use client";

/**
 * SSO Login Form Component
 *
 * Client component that handles the login form submission.
 */

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Eye, EyeOff, AlertCircle, Building2, Lock } from "lucide-react";

interface LoginFormProps {
  clientId?: string;
  tenantId?: string;
  tenantName?: string;
  redirectUri?: string;
  state?: string;
  prompt?: string;
  codeChallenge?: string;
  codeChallengeMethod?: "plain" | "S256";
}

interface LoginError {
  error: string;
  attempts_remaining?: number;
  lockout_until?: string;
}

export function LoginForm({
  clientId,
  tenantId: initialTenantId,
  tenantName,
  redirectUri,
  state,
  prompt,
  codeChallenge,
  codeChallengeMethod,
}: LoginFormProps) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantId, setTenantId] = useState(initialTenantId || "");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);

  // Tenant is locked when provided via URL
  const isTenantLocked = !!initialTenantId;

  // Determine if this is an OAuth flow
  const isOAuthFlow = !!clientId && !!redirectUri;

  // Build forgot password URL with preserved params
  const forgotPasswordUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (tenantId) params.set("tenant_id", tenantId);
    if (clientId) params.set("client_id", clientId);
    if (redirectUri) params.set("redirect_uri", redirectUri);
    if (state) params.set("state", state);
    return `/auth/forgot-password${params.toString() ? `?${params.toString()}` : ""}`;
  }, [tenantId, clientId, redirectUri, state]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setIsLoading(true);

      let shouldResetLoading = true;

      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
            tenant_id: tenantId,
            client_id: clientId,
            redirect_uri: redirectUri,
            state,
            response_type: isOAuthFlow ? "code" : "token",
            code_challenge: codeChallenge,
            code_challenge_method: codeChallengeMethod,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data);
          return;
        }

        // Handle OAuth flow - redirect with code
        if (isOAuthFlow && data.redirect_uri && data.code) {
          shouldResetLoading = false;
          setIsRedirecting(true);
          const url = new URL(data.redirect_uri);
          url.searchParams.set("code", data.code);
          if (data.state) {
            url.searchParams.set("state", data.state);
          }
          window.location.href = url.toString();
          return;
        }

        // Direct login - store tokens and redirect
        if (data.access_token) {
          shouldResetLoading = false;
          setIsRedirecting(true);
          // Store tokens in sessionStorage (or implement your own storage)
          sessionStorage.setItem("sso_access_token", data.access_token);
          sessionStorage.setItem("sso_refresh_token", data.refresh_token);
          sessionStorage.setItem("sso_tenant_id", tenantId);
          sessionStorage.setItem("sso_user", JSON.stringify(data.user));

          // Redirect to B2B dashboard
          router.push(`/${tenantId}/b2b`);
        }
      } catch (err) {
        console.error("Login error:", err);
        setError({ error: "Errore di connessione. Riprova più tardi." });
      } finally {
        // Don't reset loading if redirecting
        if (shouldResetLoading) {
          setIsLoading(false);
        }
      }
    },
    [
      email,
      password,
      tenantId,
      clientId,
      redirectUri,
      state,
      isOAuthFlow,
      codeChallenge,
      codeChallengeMethod,
      router,
    ]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">{error.error}</p>
            {error.attempts_remaining !== undefined && error.attempts_remaining > 0 && (
              <p className="text-sm text-red-600 mt-1">
                Tentativi rimanenti: {error.attempts_remaining}
              </p>
            )}
            {error.lockout_until && (
              <p className="text-sm text-red-600 mt-1">
                Account bloccato. Riprova tra qualche minuto.
              </p>
            )}
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

      {/* Password */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-700"
          >
            Password
          </label>
          <Link
            href={forgotPasswordUrl}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Password dimenticata?
          </Link>
        </div>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
            className="block w-full px-3 py-2.5 pr-10 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || isRedirecting}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {isRedirecting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Reindirizzamento in corso...</span>
          </>
        ) : isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Accesso in corso...</span>
          </>
        ) : (
          <span>Accedi</span>
        )}
      </button>

      {/* Redirecting Message */}
      {isRedirecting && (
        <div className="p-4 bg-green-50 border border-green-100 rounded-lg text-center">
          <p className="text-sm font-medium text-green-800">
            Accesso effettuato con successo!
          </p>
          <p className="text-sm text-green-600 mt-1">
            Stai per essere reindirizzato...
          </p>
        </div>
      )}

      {/* OAuth Info */}
      {isOAuthFlow && !isRedirecting && (
        <p className="text-xs text-center text-slate-500 mt-4">
          Dopo l'accesso, sarai reindirizzato a{" "}
          <span className="font-medium">{new URL(redirectUri).hostname}</span>
        </p>
      )}
    </form>
  );
}
