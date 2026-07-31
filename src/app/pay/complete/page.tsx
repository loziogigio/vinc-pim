"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

type Status = "loading" | "success" | "error" | "pending" | "missing_params";

export default function PaymentCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
        </div>
      }
    >
      <PaymentCompleteContent />
    </Suspense>
  );
}

function PaymentCompleteContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const tenant = searchParams.get("tenant");
    const provider = searchParams.get("provider");
    // PayPal returns ?token=<order id>; GestPay returns ?a=<shopLogin>&b=<crypted>
    // and we pass the payment reference through as ?ref=.
    const token = searchParams.get("token");
    const axerveRef = searchParams.get("ref");
    const providerPaymentId = provider === "axerve" ? axerveRef : token;

    if (!providerPaymentId || !tenant) {
      setStatus("missing_params");
      return;
    }

    let cancelled = false;

    async function resolvePayment() {
      // Axerve: the S2S callback may still be in flight — poll briefly.
      const maxAttempts = provider === "axerve" ? 10 : 1;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (cancelled) return;

        try {
          const res = await fetch("/api/public/payments/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider_payment_id: providerPaymentId,
              tenant,
              provider,
            }),
          });

          const data = await res.json();
          if (cancelled) return;

          if (data.success) {
            setStatus("success");
            return;
          }

          if (!data.pending) {
            setStatus("error");
            setErrorMessage(data.error || "Il pagamento non è andato a buon fine.");
            return;
          }
        } catch {
          if (cancelled) return;
          setStatus("error");
          setErrorMessage("Errore di connessione. Riprova più tardi.");
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      if (!cancelled) {
        setStatus("pending");
      }
    }

    resolvePayment();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        {/* Logo/Brand */}
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-100 mb-3">
            <span className="text-xl font-bold text-emerald-600">V</span>
          </div>
          <p className="text-xs text-gray-400 uppercase tracking-widest">VINC Commerce</p>
        </div>

        {status === "loading" && (
          <div className="space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
            <h1 className="text-xl font-semibold text-gray-800">
              Elaborazione pagamento...
            </h1>
            <p className="text-sm text-gray-500">
              Stiamo verificando il tuo pagamento. Non chiudere questa pagina.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
            <h1 className="text-xl font-semibold text-gray-800">
              Pagamento completato!
            </h1>
            <p className="text-sm text-gray-500">
              Il tuo pagamento è stato ricevuto con successo.
              Puoi chiudere questa pagina.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <XCircle className="h-16 w-16 text-red-500 mx-auto" />
            <h1 className="text-xl font-semibold text-gray-800">
              Pagamento non riuscito
            </h1>
            <p className="text-sm text-gray-500">
              {errorMessage}
            </p>
            <p className="text-xs text-gray-400 mt-4">
              Se il problema persiste, contatta il venditore.
            </p>
          </div>
        )}

        {status === "pending" && (
          <div className="space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
            <h1 className="text-xl font-semibold text-gray-800">
              Pagamento in elaborazione
            </h1>
            <p className="text-sm text-gray-500">
              Stiamo attendendo la conferma dalla banca. Riceverai un&apos;email
              appena il pagamento sarà confermato.
            </p>
          </div>
        )}

        {status === "missing_params" && (
          <div className="space-y-4">
            <XCircle className="h-16 w-16 text-amber-500 mx-auto" />
            <h1 className="text-xl font-semibold text-gray-800">
              Link non valido
            </h1>
            <p className="text-sm text-gray-500">
              Questo link di pagamento non è valido o è scaduto.
              Contatta il venditore per un nuovo link.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
