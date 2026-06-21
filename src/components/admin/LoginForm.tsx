"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const THEME_STORAGE_KEY = "vinc-theme";

export const LoginForm = () => {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync the toggle with the theme the inline boot script already applied.
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    const next = root.classList.contains("dark") ? "light" : "dark";
    root.classList.toggle("dark", next === "dark");
    root.setAttribute("data-theme", next);
    root.style.colorScheme = next;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // ignore storage failures (private mode etc.)
    }
    setIsDark(next === "dark");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? "Accesso non riuscito. Controlla le credenziali.");
        setIsSubmitting(false);
        return;
      }

      router.replace("/admin/page-builder");
    } catch (loginError) {
      console.error("Login error", loginError);
      setError("Impossibile accedere. Riprova.");
      setIsSubmitting(false);
    }
  };

  return (
    <section className="relative flex flex-col px-6 sm:px-10 py-7">
      {/* top controls */}
      <div className="flex items-center justify-end gap-1.5">
        <span className="mono inline-flex items-center gap-1 text-[0.72rem] font-semibold c-ink-45 px-1.5">
          <span className="c-ink">IT</span>
          <span className="c-ink-25">/</span>
          <span className="hover-accent cursor-pointer">EN</span>
        </span>
        <button
          type="button"
          onClick={toggleTheme}
          className="iconbtn"
          aria-label="Cambia tema"
          title="Tema chiaro / scuro"
        >
          {isDark ? (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          )}
        </button>
      </div>

      {/* mobile logo */}
      <div className="lg:hidden flex items-center gap-2.5 mt-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/vinc-logo.png" alt="" width={28} height={28} className="h-7 w-7" />
        <span className="display text-[1.05rem] font-bold c-ink">
          Commerce<span className="c-accent">Suite</span>
        </span>
      </div>

      {/* centered form */}
      <div className="flex-1 flex items-center justify-center">
        <form className="w-full max-w-[400px]" onSubmit={handleSubmit}>
          <p className="eyebrow">Accedi al tuo tenant</p>
          <h2 className="mt-3 display text-3xl sm:text-[2.3rem] font-bold c-ink leading-tight">Bentornato.</h2>
          <p className="mt-2 text-[1rem] c-ink-60">Inserisci le credenziali del tuo spazio CommerceSuite.</p>

          <div className="mt-7 space-y-4">
            <div>
              <label htmlFor="username" className="block text-[0.84rem] font-semibold c-ink mb-1.5">
                Username o Email
              </label>
              <div className="field">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="c-ink-40">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="nome.cognome"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="text-[0.84rem] font-semibold c-ink">
                  Password
                </label>
                <a href="#" className="text-[0.8rem] font-semibold c-accent hover:underline">
                  Password dimenticata?
                </a>
              </div>
              <div className="field">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="c-ink-40">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="c-ink-40 hover-accent transition"
                  aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      <path d="m2 2 20 20" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {error ? (
            <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn-accedi mt-6" disabled={isSubmitting}>
            {isSubmitting ? "Accesso in corso…" : "Accedi"}
            {!isSubmitting && (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            )}
          </button>

          <p className="mt-6 text-center text-[0.9rem] c-ink-60">
            Serve un accesso?{" "}
            <a href="mailto:support@vendereincloud.it" className="font-semibold c-ink hover-accent">
              Contatta il tuo account manager
            </a>
          </p>
          <p className="mt-3 pt-5 border-t bd-line text-center text-[0.84rem] c-ink-50">
            Cerchi le API?{" "}
            <a href="/developers" className="font-semibold c-accent hover:underline">
              Documentazione sviluppatori ↗
            </a>
          </p>
        </form>
      </div>

      <p className="lg:hidden mono text-center text-[0.7rem] c-ink-40 mt-4">© 2026 vendereincloud</p>
    </section>
  );
};
