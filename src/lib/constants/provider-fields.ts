/**
 * Provider Field Definitions
 *
 * Config-driven form field definitions for each payment provider.
 * Used by the dynamic provider configuration page to render the correct form.
 */

import type { PaymentProvider } from "./payment";

// ============================================
// FIELD TYPE DEFINITIONS
// ============================================

export interface ProviderFieldDef {
  key: string;
  label: string;
  type: "text" | "secret" | "toggle" | "select" | "environment" | "textarea" | "webhook_url";
  required?: boolean;
  options?: string[];
  optionLabels?: Record<string, string>;
  placeholder?: string;
}

// ============================================
// PROVIDER FIELD DEFINITIONS
// ============================================

export const PROVIDER_FIELDS: Partial<Record<PaymentProvider, ProviderFieldDef[]>> = {
  paypal: [
    { key: "client_id", label: "Client ID", type: "text", required: true, placeholder: "es. AXe0-XXXXXXXXXXXXXXXX" },
    { key: "client_secret", label: "Client Secret", type: "secret", required: true },
    { key: "webhook_url", label: "Webhook URL", type: "webhook_url" },
    { key: "webhook_id", label: "Webhook ID", type: "text", placeholder: "Incolla il Webhook ID generato dal provider" },
    { key: "environment", label: "Ambiente", type: "environment" },
    { key: "enabled", label: "Abilitato", type: "toggle" },
  ],

  bank_transfer_provider: [
    { key: "beneficiary_name", label: "Intestatario", type: "text", required: true, placeholder: "es. Mario Rossi S.r.l." },
    { key: "iban", label: "IBAN", type: "text", required: true, placeholder: "es. IT60X0542811101000000123456" },
    { key: "bic_swift", label: "BIC / SWIFT", type: "text", placeholder: "es. BPPIITRRXXX" },
    { key: "bank_name", label: "Nome Banca", type: "text", placeholder: "es. Intesa Sanpaolo" },
    { key: "notes", label: "Note per il cliente", type: "textarea", placeholder: "Istruzioni aggiuntive per il pagamento..." },
    { key: "enabled", label: "Abilitato", type: "toggle" },
  ],

  stripe: [
    { key: "publishable_key", label: "Publishable Key", type: "text", required: true, placeholder: "es. pk_test_51..." },
    { key: "secret_key", label: "Secret Key", type: "secret", required: true },
    { key: "webhook_url", label: "Webhook URL", type: "webhook_url" },
    { key: "webhook_secret", label: "Webhook Secret", type: "secret", placeholder: "es. whsec_..." },
    { key: "account_id", label: "Account ID (Connect)", type: "text", placeholder: "es. acct_1234567890" },
    {
      key: "account_status",
      label: "Stato Account",
      type: "select",
      options: ["pending", "active", "restricted"],
      optionLabels: { pending: "In Attesa", active: "Attivo", restricted: "Limitato" },
    },
    { key: "environment", label: "Ambiente", type: "environment", options: ["test", "production"], optionLabels: { test: "Test", production: "Production" } },
    { key: "charges_enabled", label: "Pagamenti Abilitati", type: "toggle" },
    { key: "payouts_enabled", label: "Payouts Abilitati", type: "toggle" },
  ],

  axerve: [
    { key: "shop_login", label: "Shop Login", type: "text", required: true, placeholder: "es. GESPAY12345" },
    { key: "api_key", label: "API Key", type: "secret", required: true },
    { key: "environment", label: "Ambiente", type: "environment" },
    { key: "enabled", label: "Abilitato", type: "toggle" },
    { key: "moto_profile", label: "Profilo MOTO", type: "toggle" },
    { key: "recurring_enabled", label: "Ricorrente", type: "toggle" },
  ],

  nexi: [
    { key: "api_key", label: "API Key", type: "secret", required: true },
    { key: "terminal_id", label: "Terminal ID", type: "text", placeholder: "es. 12345678" },
    { key: "environment", label: "Ambiente", type: "environment" },
    { key: "enabled", label: "Abilitato", type: "toggle" },
    { key: "moto_enabled", label: "MOTO Abilitato", type: "toggle" },
    { key: "recurring_enabled", label: "Ricorrente", type: "toggle" },
  ],

  mangopay: [
    { key: "user_id", label: "User ID", type: "text", required: true },
    { key: "wallet_id", label: "Wallet ID", type: "text", required: true },
    { key: "bank_account_id", label: "Bank Account ID", type: "text" },
    {
      key: "kyc_level",
      label: "Livello KYC",
      type: "select",
      options: ["LIGHT", "REGULAR"],
      optionLabels: { LIGHT: "Light", REGULAR: "Regular" },
    },
    {
      key: "status",
      label: "Stato",
      type: "select",
      options: ["pending", "active", "blocked"],
      optionLabels: { pending: "In Attesa", active: "Attivo", blocked: "Bloccato" },
    },
  ],

  satispay: [
    { key: "key_id", label: "Key ID", type: "secret", required: true },
    { key: "enabled", label: "Abilitato", type: "toggle" },
  ],

  scalapay: [
    { key: "api_key", label: "API Key", type: "secret", required: true },
    { key: "environment", label: "Ambiente", type: "environment" },
    { key: "enabled", label: "Abilitato", type: "toggle" },
  ],
};

/**
 * Returns the required field keys for a given provider.
 */
export function getRequiredFields(provider: PaymentProvider): string[] {
  const fields = PROVIDER_FIELDS[provider];
  if (!fields) return [];
  return fields.filter((f) => f.required).map((f) => f.key);
}
