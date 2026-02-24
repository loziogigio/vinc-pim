/**
 * Microsoft Graph API Email Transport
 *
 * Sends emails via Microsoft Graph API using OAuth2 client_credentials flow.
 * Uses native fetch (no external dependencies).
 * Tokens are cached per-tenant to avoid unnecessary token requests.
 */

import type { GraphSettings } from "@/lib/types/home-settings";

// ============================================
// TYPES
// ============================================

export interface GraphEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  from?: string;
  fromName?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface GraphSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface CachedToken {
  access_token: string;
  expires_at: number; // Unix timestamp in ms
}

// ============================================
// TOKEN CACHE
// ============================================

// Cache tokens per Azure tenant (keyed by azure_tenant_id:client_id)
const tokenCache = new Map<string, CachedToken>();

// Refresh token 5 minutes before expiry
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

function getTokenCacheKey(settings: GraphSettings): string {
  return `${settings.azure_tenant_id}:${settings.client_id}`;
}

/**
 * Acquire an OAuth2 access token via client_credentials grant.
 * Returns cached token if still valid; fetches new one otherwise.
 */
export async function getGraphToken(settings: GraphSettings): Promise<string> {
  const cacheKey = getTokenCacheKey(settings);
  const cached = tokenCache.get(cacheKey);

  if (cached && Date.now() < cached.expires_at - TOKEN_REFRESH_BUFFER_MS) {
    return cached.access_token;
  }

  const tokenUrl = `https://login.microsoftonline.com/${settings.azure_tenant_id}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: settings.client_id!,
    client_secret: settings.client_secret!,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `[Graph] Token request failed (${response.status}): ${errorBody}`
    );
  }

  const data = await response.json();

  tokenCache.set(cacheKey, {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  });

  return data.access_token;
}

/**
 * Clear cached token for a tenant (useful after config changes or 401 errors)
 */
export function clearGraphTokenCache(settings: GraphSettings): void {
  tokenCache.delete(getTokenCacheKey(settings));
}

// ============================================
// HELPERS
// ============================================

export function toRecipientList(
  addresses: string | string[] | undefined
): Array<{ emailAddress: { address: string } }> | undefined {
  if (!addresses) return undefined;
  const list = Array.isArray(addresses) ? addresses : [addresses];
  if (list.length === 0) return undefined;
  return list.map((addr) => ({
    emailAddress: { address: addr.trim() },
  }));
}

export function toGraphAttachments(
  attachments?: GraphEmailOptions["attachments"]
): Array<Record<string, unknown>> | undefined {
  if (!attachments?.length) return undefined;
  return attachments.map((att) => ({
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: att.filename,
    contentType: att.contentType || "application/octet-stream",
    contentBytes:
      typeof att.content === "string"
        ? Buffer.from(att.content).toString("base64")
        : att.content.toString("base64"),
  }));
}

// ============================================
// SEND
// ============================================

/**
 * Send an email via Microsoft Graph API.
 */
export async function sendViaGraph(
  settings: GraphSettings,
  options: GraphEmailOptions
): Promise<GraphSendResult> {
  if (!isGraphConfigured(settings)) {
    return {
      success: false,
      error:
        "Incomplete Graph API configuration (missing client_id, azure_tenant_id, client_secret, or sender_email)",
    };
  }

  const token = await getGraphToken(settings);

  const senderEmail = options.from || settings.sender_email!;
  const senderName = options.fromName || settings.sender_name;

  const graphMessage: Record<string, unknown> = {
    subject: options.subject,
    body: {
      contentType: options.html ? "HTML" : "Text",
      content: options.html || options.text || "",
    },
    toRecipients: toRecipientList(options.to),
    from: {
      emailAddress: {
        address: senderEmail,
        ...(senderName ? { name: senderName } : {}),
      },
    },
  };

  // Optional fields
  const cc = toRecipientList(options.cc);
  if (cc) graphMessage.ccRecipients = cc;

  const bcc = toRecipientList(options.bcc);
  if (bcc) graphMessage.bccRecipients = bcc;

  if (options.replyTo) {
    graphMessage.replyTo = [{ emailAddress: { address: options.replyTo } }];
  }

  const attachments = toGraphAttachments(options.attachments);
  if (attachments) graphMessage.attachments = attachments;

  const sendMailUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderEmail)}/sendMail`;

  const response = await fetch(sendMailUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: graphMessage,
      saveToSentItems: settings.save_to_sent_items ?? false,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    // Clear token cache on 401 so next attempt gets a fresh token
    if (response.status === 401) {
      clearGraphTokenCache(settings);
    }
    return {
      success: false,
      error: `Graph API error (${response.status}): ${errorBody}`,
    };
  }

  // Graph sendMail returns 202 Accepted with no body on success
  const domain = senderEmail.split("@")[1] || "graph.microsoft.com";
  return {
    success: true,
    messageId: `<graph-${Date.now()}@${domain}>`,
  };
}

// ============================================
// VALIDATION
// ============================================

/**
 * Check whether Graph settings are sufficiently configured to send emails.
 */
export function isGraphConfigured(settings?: GraphSettings): boolean {
  if (!settings) return false;
  return !!(
    settings.client_id &&
    settings.azure_tenant_id &&
    settings.client_secret &&
    settings.sender_email
  );
}
