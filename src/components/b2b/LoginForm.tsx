"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, User, Building2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { UILanguageSwitcher } from "./UILanguageSwitcher";

interface B2BLoginFormProps {
  tenant?: string;
}

export function B2BLoginForm({ tenant: initialTenant }: B2BLoginFormProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [tenant, setTenant] = useState(initialTenant || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!tenant.trim()) {
      setError(t("login.enterTenantId"));
      return;
    }

    setIsLoading(true);

    try {
      // Always use tenant-scoped API
      const apiUrl = `/${tenant}/api/b2b/login`;

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("login.loginFailed"));
        setIsLoading(false);
        return;
      }

      // Redirect to tenant-scoped B2B home
      router.push(`/${tenant}/b2b`);
      router.refresh();
    } catch {
      setError(t("login.unexpectedError"));
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="flex justify-end">
        <UILanguageSwitcher />
      </div>
      <div className="space-y-2 text-center">
        <div className="mb-2 flex justify-center">
          <Image
            src="/vinc-bc.png"
            alt="VINC Logo"
            width={220}
            height={220}
            priority
          />
        </div>
        <h1 className="text-2xl font-bold tracking-tight whitespace-nowrap">{t("login.welcome")}</h1>
        <p className="text-muted-foreground">{t("login.signInToContinue")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {!initialTenant && (
          <div className="space-y-2">
            <Label htmlFor="tenant">{t("login.tenantId")}</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="tenant"
                type="text"
                placeholder={t("login.tenantPlaceholder")}
                value={tenant}
                onChange={(e) => setTenant(e.target.value.toLowerCase().trim())}
                className="pl-10"
                required
                disabled={isLoading}
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="username">{t("login.usernameOrEmail")}</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="username"
              type="text"
              placeholder={t("login.usernamePlaceholder")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="pl-10"
              required
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t("login.password")}</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              placeholder={t("login.passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10"
              required
              disabled={isLoading}
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? t("login.signingIn") : t("login.signIn")}
        </Button>
      </form>

      <div className="text-center text-sm text-muted-foreground">
        <p>{t("login.needAccess")}</p>
      </div>
    </div>
  );
}
