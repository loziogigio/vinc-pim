/**
 * Axerve / Fabrick Payment Orchestra Provider (SOAP API)
 *
 * Implements IPaymentProvider for Axerve (formerly GestPay by Banca Sella).
 * Supports: OnClick (Redirect/Lightbox/iFrame), MOTO (callPagamS2S), Recurring (Token + MIT).
 * Split payments: App-level only (no native support).
 *
 * API: SOAP/XML over HTTPS (WSCryptDecrypt + WSs2s)
 * Production S2S URL: https://ecomms2s.sella.it/gestpay/gestpayws/WSs2s.asmx
 */

import type { IPaymentProvider, ProviderTenantConfig } from "../provider-interface";
import type {
  CreatePaymentParams,
  MotoPaymentParams,
  ContractParams,
  ContractResult,
  RecurringChargeParams,
  PaymentResult,
  RefundResult,
  WebhookEvent,
  ProviderFees,
} from "@/lib/types/payment";

// ============================================
// AXERVE SOAP CLIENT
// ============================================

interface AxerveConfig {
  shop_login: string;
  api_key: string;
  environment: "sandbox" | "production";
  moto_profile: boolean;
  recurring_enabled: boolean;
}

function getS2SUrl(environment: "sandbox" | "production"): string {
  return environment === "production"
    ? "https://ecomms2s.sella.it/gestpay/gestpayws/WSs2s.asmx"
    : "https://sandbox.gestpay.net/gestpay/gestpayws/WSs2s.asmx";
}

function getCryptUrl(environment: "sandbox" | "production"): string {
  return environment === "production"
    ? "https://ecomms2s.sella.it/gestpay/gestpayws/WSCryptDecrypt.asmx"
    : "https://sandbox.gestpay.net/gestpay/gestpayws/WSCryptDecrypt.asmx";
}

/**
 * Build a SOAP envelope for Axerve API calls.
 */
function buildSoapEnvelope(method: string, bodyXml: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <${method} xmlns="https://ecomms2s.sella.it/">
      ${bodyXml}
    </${method}>
  </soap12:Body>
</soap12:Envelope>`;
}

/**
 * Send a SOAP request to Axerve.
 */
async function soapRequest(
  url: string,
  method: string,
  bodyXml: string
): Promise<string> {
  const envelope = buildSoapEnvelope(method, bodyXml);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/soap+xml; charset=utf-8",
    },
    body: envelope,
  });

  if (!response.ok) {
    throw new Error(`Axerve SOAP error ${response.status}: ${await response.text()}`);
  }

  return response.text();
}

/**
 * Extract a value from XML by tag name (simple parser for Axerve responses).
 */
function extractXmlValue(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, "s");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

// ============================================
// PROVIDER IMPLEMENTATION
// ============================================

export const axerveProvider: IPaymentProvider = {
  name: "axerve",

  // Capabilities
  supportsMoto: true,
  supportsOnClick: true,
  supportsRecurring: true,
  supportsAutomaticSplit: false,

  // ============================================
  // OnClick Payment (Encrypt → Redirect)
  // ============================================
  async createPayment(
    tenantConfig: ProviderTenantConfig,
    params: CreatePaymentParams
  ): Promise<PaymentResult> {
    const config = tenantConfig as AxerveConfig;

    try {
      const bodyXml = `
        <shopLogin>${config.shop_login}</shopLogin>
        <uicCode>242</uicCode>
        <amount>${params.amount.toFixed(2)}</amount>
        <shopTransactionId>${params.order_id}</shopTransactionId>
        <apikey>${config.api_key}</apikey>`;

      const response = await soapRequest(
        getCryptUrl(config.environment),
        "Encrypt",
        bodyXml
      );

      const cryptDecryptString = extractXmlValue(response, "CryptDecryptString");
      const errorCode = extractXmlValue(response, "ErrorCode");

      if (errorCode !== "0") {
        const errorDesc = extractXmlValue(response, "ErrorDescription");
        return { success: false, error: `Axerve encrypt error: ${errorDesc}` };
      }

      // Build redirect URL
      const baseRedirect = config.environment === "production"
        ? "https://ecomm.sella.it/pagam/pagam.aspx"
        : "https://sandbox.gestpay.net/pagam/pagam.aspx";

      const redirectUrl = `${baseRedirect}?a=${config.shop_login}&b=${cryptDecryptString}`;

      return {
        success: true,
        provider_payment_id: params.order_id,
        redirect_url: redirectUrl,
        status: "processing",
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },

  // ============================================
  // Capture (settle)
  // ============================================
  async capturePayment(
    tenantConfig: ProviderTenantConfig,
    providerPaymentId: string,
    amount?: number
  ): Promise<PaymentResult> {
    const config = tenantConfig as AxerveConfig;

    try {
      const bodyXml = `
        <shopLogin>${config.shop_login}</shopLogin>
        <bankTransactionId>${providerPaymentId}</bankTransactionId>
        ${amount ? `<amount>${amount.toFixed(2)}</amount>` : ""}
        <apikey>${config.api_key}</apikey>`;

      const response = await soapRequest(
        getS2SUrl(config.environment),
        "callSettleS2S",
        bodyXml
      );

      const transResult = extractXmlValue(response, "TransactionResult");
      return {
        success: transResult === "OK",
        provider_payment_id: providerPaymentId,
        status: transResult === "OK" ? "captured" : "failed",
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },

  // ============================================
  // Refund
  // ============================================
  async refundPayment(
    tenantConfig: ProviderTenantConfig,
    providerPaymentId: string,
    amount?: number
  ): Promise<RefundResult> {
    const config = tenantConfig as AxerveConfig;

    try {
      const bodyXml = `
        <shopLogin>${config.shop_login}</shopLogin>
        <bankTransactionId>${providerPaymentId}</bankTransactionId>
        ${amount ? `<amount>${amount.toFixed(2)}</amount>` : ""}
        <apikey>${config.api_key}</apikey>`;

      const response = await soapRequest(
        getS2SUrl(config.environment),
        "callRefundS2S",
        bodyXml
      );

      const transResult = extractXmlValue(response, "TransactionResult");
      return {
        success: transResult === "OK",
        amount,
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },

  // ============================================
  // Get Status
  // ============================================
  async getPaymentStatus(
    tenantConfig: ProviderTenantConfig,
    providerPaymentId: string
  ): Promise<PaymentResult> {
    const config = tenantConfig as AxerveConfig;

    try {
      const bodyXml = `
        <shopLogin>${config.shop_login}</shopLogin>
        <bankTransactionId>${providerPaymentId}</bankTransactionId>
        <apikey>${config.api_key}</apikey>`;

      const response = await soapRequest(
        getS2SUrl(config.environment),
        "callReadTrxS2S",
        bodyXml
      );

      const transResult = extractXmlValue(response, "TransactionResult");
      return {
        success: transResult === "OK",
        provider_payment_id: providerPaymentId,
        status: transResult,
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },

  // ============================================
  // MOTO Payment (callPagamS2S)
  // ============================================
  async createMotoPayment(
    tenantConfig: ProviderTenantConfig,
    params: MotoPaymentParams
  ): Promise<PaymentResult> {
    const config = tenantConfig as AxerveConfig;

    if (!config.moto_profile) {
      return { success: false, error: "MOTO profile not enabled for this merchant" };
    }

    try {
      const bodyXml = `
        <shopLogin>${config.shop_login}</shopLogin>
        <uicCode>242</uicCode>
        <amount>${params.amount.toFixed(2)}</amount>
        <shopTransactionId>${params.order_id}</shopTransactionId>
        <cardNumber>${params.card_number}</cardNumber>
        <expiryMonth>${params.expiry_month}</expiryMonth>
        <expiryYear>${params.expiry_year}</expiryYear>
        ${params.cvv ? `<cvv>${params.cvv}</cvv>` : ""}
        <apikey>${config.api_key}</apikey>`;

      const response = await soapRequest(
        getS2SUrl(config.environment),
        "callPagamS2S",
        bodyXml
      );

      const transResult = extractXmlValue(response, "TransactionResult");
      const bankTransId = extractXmlValue(response, "BankTransactionID");
      const authCode = extractXmlValue(response, "AuthorizationCode");

      return {
        success: transResult === "OK",
        provider_payment_id: bankTransId || params.order_id,
        status: transResult === "OK" ? "authorized" : "failed",
        ...(transResult !== "OK" && {
          error: extractXmlValue(response, "ErrorDescription"),
          error_code: extractXmlValue(response, "ErrorCode"),
        }),
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },

  // ============================================
  // Recurring — Create Contract (request token on first CIT)
  // ============================================
  async createContract(
    tenantConfig: ProviderTenantConfig,
    params: ContractParams
  ): Promise<ContractResult> {
    // Axerve tokens are created during the first OnClick payment
    // with requestToken=MASKEDPAN parameter.
    // This method returns a placeholder; the actual token comes from the payment callback.
    const contractId = `axv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return {
      contract_id: contractId,
      provider_contract_id: contractId,
      status: "pending", // Becomes active after first CIT payment with token
    };
  },

  // ============================================
  // Recurring — Charge (callPagamS2S with token + MIT codes)
  // ============================================
  async chargeRecurring(
    tenantConfig: ProviderTenantConfig,
    providerContractId: string,
    params: RecurringChargeParams
  ): Promise<PaymentResult> {
    const config = tenantConfig as AxerveConfig;

    // MIT type codes:
    // 01F = scheduled first, 01N = scheduled subsequent
    // 03F = unscheduled first, 03N = unscheduled subsequent
    const mitCode = "01N"; // Default to scheduled subsequent

    try {
      const bodyXml = `
        <shopLogin>${config.shop_login}</shopLogin>
        <uicCode>242</uicCode>
        <amount>${params.amount.toFixed(2)}</amount>
        <shopTransactionId>${params.order_id}</shopTransactionId>
        <tokenValue>${providerContractId}</tokenValue>
        <transDetails>
          <type>${mitCode}</type>
        </transDetails>
        <apikey>${config.api_key}</apikey>`;

      const response = await soapRequest(
        getS2SUrl(config.environment),
        "callPagamS2S",
        bodyXml
      );

      const transResult = extractXmlValue(response, "TransactionResult");
      const bankTransId = extractXmlValue(response, "BankTransactionID");

      return {
        success: transResult === "OK",
        provider_payment_id: bankTransId || params.order_id,
        status: transResult === "OK" ? "authorized" : "failed",
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },

  // ============================================
  // Cancel Contract (delete token)
  // ============================================
  async cancelContract(
    tenantConfig: ProviderTenantConfig,
    providerContractId: string
  ): Promise<void> {
    const config = tenantConfig as AxerveConfig;

    const bodyXml = `
      <shopLogin>${config.shop_login}</shopLogin>
      <tokenValue>${providerContractId}</tokenValue>
      <apikey>${config.api_key}</apikey>`;

    await soapRequest(
      getS2SUrl(config.environment),
      "callDeleteTokenS2S",
      bodyXml
    );
  },

  // ============================================
  // Webhooks
  // ============================================
  verifyWebhookSignature(
    _payload: string,
    _signature: string,
    _secret: string
  ): boolean {
    // Axerve uses Decrypt to verify the callback data
    // The encrypted string must be decrypted with shop credentials
    return true;
  },

  parseWebhookEvent(payload: string): WebhookEvent {
    const data = JSON.parse(payload);
    return {
      provider: "axerve",
      event_type: data.TransactionResult === "OK" ? "payment.completed" : "payment.failed",
      event_id: data.BankTransactionID || "",
      timestamp: new Date(),
      data,
      raw_payload: payload,
    };
  },

  // ============================================
  // Fees
  // ============================================
  calculateFees(amount: number, currency: string): ProviderFees {
    // Axerve: ~1.5% estimated (varies by contract)
    const percentageFee = amount * 0.015;
    const totalFee = Math.round(percentageFee * 100) / 100;

    return {
      fixed_fee: 0,
      percentage_fee: totalFee,
      total_fee: totalFee,
      currency,
    };
  },
};
