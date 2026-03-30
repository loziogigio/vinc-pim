# PayPal Configuration / Configurazione PayPal

Guida completa per configurare PayPal Commerce Platform in VINC Commerce Suite.
Complete guide to configuring PayPal Commerce Platform in VINC Commerce Suite.

---

## 1. Prerequisiti / Prerequisites

### Account PayPal Business

- Un account PayPal Business attivo (sandbox o production)
- Accesso al [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)

> A PayPal Business account (sandbox or production) and access to the PayPal Developer Dashboard are required.

### Credenziali API / API Credentials

Dal Developer Dashboard, crea una **REST API app** e ottieni:
From the Developer Dashboard, create a **REST API app** and obtain:

| Campo / Field | Descrizione / Description |
|---------------|--------------------------|
| `client_id` | Identificativo dell'app / App identifier |
| `client_secret` | Chiave segreta dell'app / App secret key |
| `merchant_id` | ID del merchant PayPal (opzionale) / PayPal merchant ID (optional) |

---

## 2. Configurazione Tenant / Tenant Configuration

Salva le credenziali PayPal tramite API:
Save PayPal credentials via API:

```bash
curl -X PUT /api/b2b/payments/config/providers \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "paypal",
    "config": {
      "client_id": "AxxxxxxxxxxxxxxxxxxxxxxxxxxxxB",
      "client_secret": "ExxxxxxxxxxxxxxxxxxxxxxxxxxxxF",
      "merchant_id": "XXXXXXXXX",
      "webhook_id": "",
      "environment": "sandbox",
      "enabled": true
    }
  }'
```

| Campo / Field | Tipo / Type | Obbligatorio / Required | Descrizione / Description |
|---------------|-------------|------------------------|--------------------------|
| `client_id` | string | Si / Yes | Client ID dalla REST API app / Client ID from REST API app |
| `client_secret` | string | Si / Yes | Client Secret dalla REST API app / Client Secret from REST API app |
| `merchant_id` | string | No | Merchant ID per split payments (campo `payee`) / Merchant ID for split payments (`payee` field) |
| `webhook_id` | string | Si (per webhook) / Yes (for webhooks) | ID del webhook creato in PayPal Dashboard / Webhook ID from PayPal Dashboard |
| `environment` | string | Si / Yes | `"sandbox"` o `"production"` |
| `enabled` | boolean | Si / Yes | Abilita/disabilita il provider / Enable/disable the provider |

**Ambienti API / API Environments:**

| Ambiente / Environment | Base URL |
|----------------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

---

## 3. Webhook — Configurazione / Setup

I webhook di PayPal notificano la piattaforma sugli eventi di pagamento in modo asincrono. Sono **necessari** per gestire correttamente catture, rimborsi, dispute e abbonamenti.

PayPal webhooks notify the platform about payment events asynchronously. They are **required** to properly handle captures, refunds, disputes, and subscriptions.

### 3.1 URL del Webhook / Webhook URL

Configura il seguente URL nel PayPal Developer Dashboard:
Configure the following URL in the PayPal Developer Dashboard:

```
https://{your-domain}/api/public/payments/webhooks/paypal?tenant={tenantId}
```

**Esempio / Example:**
```
https://app.example.com/api/public/payments/webhooks/paypal?tenant=my-store
```

> **Importante:** Il parametro `tenant` e obbligatorio. PayPal inviera tutti gli eventi a questo URL e il sistema identifichera il tenant dal parametro query.
>
> **Important:** The `tenant` parameter is mandatory. PayPal will send all events to this URL and the system identifies the tenant from the query parameter.

### 3.2 Salvare il Webhook ID / Save the Webhook ID

Dopo aver creato il webhook nel Developer Dashboard, PayPal assegna un **Webhook ID**. Questo ID e necessario per la verifica della firma.

After creating the webhook in the Developer Dashboard, PayPal assigns a **Webhook ID**. This ID is required for signature verification.

Aggiorna la configurazione del tenant con il `webhook_id`:
Update the tenant configuration with the `webhook_id`:

```bash
curl -X PUT /api/b2b/payments/config/providers \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "paypal",
    "config": {
      "client_id": "AxxxxxxxxxxxxxxxxxxxxxxxxxxxxB",
      "client_secret": "ExxxxxxxxxxxxxxxxxxxxxxxxxxxxF",
      "webhook_id": "WH-XXXXXXXXXXXXXXXX-XXXXXXXXXXXXXXXX",
      "environment": "sandbox",
      "enabled": true
    }
  }'
```

### 3.3 Verifica della Firma / Signature Verification

Il sistema verifica ogni webhook tramite l'API ufficiale PayPal (`POST /v1/notifications/verify-webhook-signature`). Non viene usata una verifica locale HMAC come in Stripe.

The system verifies each webhook via PayPal's official API (`POST /v1/notifications/verify-webhook-signature`). No local HMAC verification is used (unlike Stripe).

Header PayPal estratti automaticamente dal sistema:
PayPal headers automatically extracted by the system:

| Header | Descrizione / Description |
|--------|--------------------------|
| `paypal-auth-algo` | Algoritmo di firma / Signature algorithm |
| `paypal-cert-url` | URL del certificato / Certificate URL |
| `paypal-transmission-id` | ID univoco della trasmissione / Unique transmission ID |
| `paypal-transmission-sig` | Firma della trasmissione / Transmission signature |
| `paypal-transmission-time` | Timestamp della trasmissione / Transmission timestamp |

---

## 4. Eventi Webhook Richiesti / Required Webhook Events

Seleziona questi eventi nel PayPal Developer Dashboard quando crei il webhook.
Select these events in the PayPal Developer Dashboard when creating the webhook.

### 4.1 Pagamenti OnClick (Orders API) / OnClick Payments

Eventi per il flusso di checkout standard.
Events for the standard checkout flow.

| Evento / Event | Quando / When | Azione del sistema / System action |
|----------------|---------------|-----------------------------------|
| `CHECKOUT.ORDER.APPROVED` | Il cliente approva il pagamento / Customer approves payment | Avvia la cattura / Trigger capture |
| `CHECKOUT.ORDER.COMPLETED` | Ordine completamente catturato / Order fully captured | Conferma pagamento completato (backup) / Confirm payment completed (backup) |
| `CHECKOUT.ORDER.VOIDED` | Ordine annullato o scaduto / Order voided or expired | Segna la transazione come fallita / Mark transaction as failed |

### 4.2 Catture / Captures

| Evento / Event | Quando / When | Azione del sistema / System action |
|----------------|---------------|-----------------------------------|
| `PAYMENT.CAPTURE.COMPLETED` | Cattura riuscita / Capture succeeded | Conferma fondi ricevuti, aggiorna stato ordine / Confirm funds received, update order status |
| `PAYMENT.CAPTURE.DENIED` | Cattura rifiutata / Capture denied | Segna pagamento come fallito / Mark payment as failed |
| `PAYMENT.CAPTURE.PENDING` | Cattura in attesa (es. eCheck) / Capture pending (e.g. eCheck) | Mantieni transazione in "processing" / Keep transaction in "processing" |
| `PAYMENT.CAPTURE.REFUNDED` | Rimborso completo elaborato / Full refund processed | Sincronizza stato rimborso / Sync refund status |
| `PAYMENT.CAPTURE.REVERSED` | Chargeback o storno / Chargeback or reversal | Avvisa il merchant, aggiorna transazione / Alert merchant, update transaction |

### 4.3 Abbonamenti Ricorrenti (Billing) / Recurring Subscriptions

Necessari se si utilizza il flusso di pagamenti ricorrenti (`createContract` / `chargeRecurring`).
Required if using the recurring payments flow (`createContract` / `chargeRecurring`).

| Evento / Event | Quando / When | Azione del sistema / System action |
|----------------|---------------|-----------------------------------|
| `BILLING.SUBSCRIPTION.ACTIVATED` | Abbonamento attivato / Subscription activated | Segna contratto come attivo / Mark contract as active |
| `BILLING.SUBSCRIPTION.CANCELLED` | Abbonamento cancellato / Subscription cancelled | Aggiorna stato contratto / Update contract status |
| `BILLING.SUBSCRIPTION.SUSPENDED` | Superata soglia fallimenti (3 tentativi) / Payment failures exceeded threshold (3 attempts) | Avvisa il merchant / Alert merchant |
| `BILLING.SUBSCRIPTION.EXPIRED` | Piano scaduto / Plan ended | Chiudi contratto / Close contract |
| `BILLING.SUBSCRIPTION.PAYMENT.FAILED` | Addebito ricorrente fallito / Recurring charge failed | Notifica merchant, logica di retry / Notify merchant, retry logic |
| `PAYMENT.SALE.COMPLETED` | Addebito ricorrente riuscito / Recurring charge succeeded | Registra transazione ricorrente / Record recurring payment transaction |

### 4.4 Dispute (Consigliati) / Disputes (Recommended)

| Evento / Event | Quando / When | Azione del sistema / System action |
|----------------|---------------|-----------------------------------|
| `CUSTOMER.DISPUTE.CREATED` | Il compratore apre una disputa/chargeback / Buyer opens dispute/chargeback | Avvisa il merchant immediatamente / Alert merchant immediately |
| `CUSTOMER.DISPUTE.RESOLVED` | Disputa risolta / Dispute resolved | Aggiorna stato transazione / Update transaction status |

---

## 5. Set Minimo / Minimum Set

Per iniziare rapidamente, e sufficiente abilitare solo questi 4 eventi:
To get started quickly, enable only these 4 events:

1. **`CHECKOUT.ORDER.APPROVED`** — Cattura il pagamento quando il cliente approva / Capture payment when customer approves
2. **`PAYMENT.CAPTURE.COMPLETED`** — Conferma la ricezione dei fondi / Confirm funds received
3. **`PAYMENT.CAPTURE.DENIED`** — Gestisci pagamenti rifiutati / Handle denied payments
4. **`PAYMENT.CAPTURE.REFUNDED`** — Sincronizza i rimborsi / Sync refunds

> Aggiungi gli eventi di Billing e Dispute quando attivi i pagamenti ricorrenti o vuoi monitorare le dispute.
>
> Add Billing and Dispute events when you enable recurring payments or want to monitor disputes.

---

## 6. Flusso di Pagamento / Payment Flow

```
1. Creazione Ordine / Order Creation
   POST /api/b2b/payments/create { provider: "paypal", amount, order_id, ... }
   → Crea ordine PayPal (Orders API v2) / Creates PayPal order
   → Restituisce redirect_url (link di approvazione) / Returns redirect_url (approval link)
   → Salva PaymentTransaction (status: "processing") / Saves PaymentTransaction

2. Approvazione Cliente / Customer Approval
   → Il cliente viene reindirizzato a PayPal / Customer redirected to PayPal
   → Approva il pagamento / Approves payment
   → PayPal reindirizza al return_url / PayPal redirects to return_url

3. Cattura / Capture
   POST /api/b2b/payments/capture { transaction_id }
   → Cattura i fondi via PayPal API / Captures funds via PayPal API
   → Aggiorna PaymentTransaction (status: "completed") / Updates PaymentTransaction
   → Salva provider_capture_id (visibile nel dashboard PayPal) / Saves provider_capture_id

4. Conferma Webhook / Webhook Confirmation
   POST /api/public/payments/webhooks/paypal?tenant={tenantId}
   → PayPal invia PAYMENT.CAPTURE.COMPLETED / PayPal sends event
   → Sistema verifica firma / System verifies signature
   → Evento accodato in BullMQ per elaborazione asincrona / Event enqueued in BullMQ
```

---

## 7. Rimborsi / Refunds

```bash
curl -X POST /api/b2b/payments/refund \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "txn_abc123",
    "amount": 25.00
  }'
```

- Rimborso totale: ometti `amount` / Full refund: omit `amount`
- Rimborso parziale: specifica `amount` / Partial refund: specify `amount`
- Usa il `provider_capture_id` internamente (non l'order ID) / Uses `provider_capture_id` internally (not the order ID)

---

## 8. Commissioni / Fees

PayPal EU pricing (tariffe standard):
PayPal EU pricing (standard rates):

| Componente / Component | Valore / Value |
|----------------------|----------------|
| Commissione percentuale / Percentage fee | 2.49% |
| Commissione fissa / Fixed fee (EUR) | 0.35 EUR |
| Commissione fissa / Fixed fee (other) | 0.49 |

**Esempio / Example:** Pagamento di 100.00 EUR
- Percentuale: 100.00 x 2.49% = 2.49 EUR
- Fissa: 0.35 EUR
- **Totale commissione / Total fee: 2.84 EUR**

---

## 9. Capacita e Limitazioni / Capabilities & Limitations

| Funzionalita / Feature | Supportato / Supported | Note |
|------------------------|----------------------|------|
| OnClick (checkout) | Si / Yes | Orders API v2 con redirect / with redirect |
| MOTO | No | PayPal non supporta il flusso MOTO / PayPal has no MOTO flow |
| Pagamenti ricorrenti / Recurring | Si / Yes | Billing Subscriptions API v1 |
| Split automatico / Auto split | No | Solo referral partner / Partner referrals only |
| 3D Secure | N/A | Gestito da PayPal internamente / Handled by PayPal internally |
| Apple Pay / Google Pay | Si / Yes | Tramite PayPal checkout / Via PayPal checkout |

---

## 10. Risoluzione Problemi / Troubleshooting

### Webhook non verificato / Webhook not verified

- Controlla che `webhook_id` sia salvato nella configurazione del tenant
- Verifica che `client_id` e `client_secret` siano corretti
- In sandbox, usa le credenziali sandbox (non production)

> Check that `webhook_id` is saved in the tenant config. Verify `client_id` and `client_secret` are correct. In sandbox, use sandbox credentials (not production).

### Token scaduto / Token expired

Il sistema gestisce automaticamente il refresh del token OAuth2. I token sono cachati per `client_id` e rinnovati 60 secondi prima della scadenza.

> The system automatically handles OAuth2 token refresh. Tokens are cached per `client_id` and renewed 60 seconds before expiry.

### Errori comuni / Common errors

| Errore / Error | Causa / Cause | Soluzione / Fix |
|----------------|---------------|-----------------|
| `PayPal not enabled for this merchant` | Provider disabilitato / Provider disabled | Imposta `enabled: true` nella config / Set `enabled: true` in config |
| `PayPal client_id and client_secret are required` | Credenziali mancanti / Missing credentials | Configura le credenziali API / Configure API credentials |
| `No webhook_id configured` | Webhook ID non salvato / Webhook ID not saved | Aggiungi `webhook_id` dalla Dashboard / Add `webhook_id` from Dashboard |
| `PayPal auth error 401` | Credenziali non valide / Invalid credentials | Verifica client_id/secret nell'ambiente corretto / Check client_id/secret in correct environment |

---

## File Sorgente / Source Files

| File | Scopo / Purpose |
|------|----------------|
| `src/lib/payments/providers/paypal/client.ts` | Client PayPal (Orders, Billing, Refunds, Webhooks) |
| `src/app/api/public/payments/webhooks/paypal/route.ts` | Endpoint webhook PayPal |
| `src/lib/payments/webhook.service.ts` | Servizio condiviso di verifica webhook / Shared webhook verification service |
| `src/lib/payments/payment.service.ts` | Orchestrazione pagamenti / Payment orchestration |
| `src/lib/db/models/tenant-payment-config.ts` | Modello configurazione tenant / Tenant config model |
| `src/lib/db/models/payment-transaction.ts` | Modello transazioni / Transaction model |
