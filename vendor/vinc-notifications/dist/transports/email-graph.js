// Cache tokens per Azure tenant (keyed by azureTenantId:clientId)
const tokenCache = new Map();
// Refresh token 5 minutes before expiry (matches proven CS TOKEN_REFRESH_BUFFER_MS)
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
function cacheKey(g) {
    return `${g.azureTenantId}:${g.clientId}`;
}
async function getGraphToken(g) {
    const key = cacheKey(g);
    const cached = tokenCache.get(key);
    if (cached && Date.now() < cached.expires_at - TOKEN_REFRESH_BUFFER_MS) {
        return cached.access_token;
    }
    const tokenUrl = `https://login.microsoftonline.com/${g.azureTenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
        client_id: g.clientId ?? "",
        client_secret: g.clientSecret ?? "",
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
        throw new Error(`[Graph] Token request failed (${response.status}): ${errorBody}`);
    }
    const data = (await response.json());
    tokenCache.set(key, {
        access_token: data.access_token,
        expires_at: Date.now() + data.expires_in * 1000,
    });
    return data.access_token;
}
// ============================================
// HELPERS
// ============================================
function toRecipientList(addresses) {
    if (!addresses)
        return undefined;
    const list = Array.isArray(addresses) ? addresses : [addresses];
    if (list.length === 0)
        return undefined;
    return list.map((addr) => ({ emailAddress: { address: addr.trim() } }));
}
// ============================================
// SEND
// ============================================
export async function sendEmailViaGraph(cfg, msg) {
    try {
        const g = cfg.graph;
        if (!g?.azureTenantId || !g.clientId || !g.clientSecret || !g.senderEmail) {
            return { ok: false, error: "Incomplete Graph API configuration (missing clientId, azureTenantId, clientSecret, or senderEmail)" };
        }
        const token = await getGraphToken(g);
        const senderEmail = g.senderEmail;
        const senderName = g.senderName;
        const graphMessage = {
            subject: msg.subject,
            body: {
                // Use HTML contentType when html is provided, Text otherwise (matches CS)
                contentType: msg.html ? "HTML" : "Text",
                content: msg.html || msg.text || "",
            },
            toRecipients: toRecipientList(msg.to),
            from: {
                emailAddress: {
                    address: senderEmail,
                    ...(senderName ? { name: senderName } : {}),
                },
            },
        };
        // Only add optional fields when present (matches CS pattern — no empty arrays)
        const cc = toRecipientList(msg.cc);
        if (cc)
            graphMessage.ccRecipients = cc;
        const bcc = toRecipientList(msg.bcc);
        if (bcc)
            graphMessage.bccRecipients = bcc;
        if (msg.replyTo) {
            graphMessage.replyTo = [{ emailAddress: { address: msg.replyTo } }];
        }
        const sendMailUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderEmail)}/sendMail`;
        const response = await fetch(sendMailUrl, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message: graphMessage,
                saveToSentItems: g.saveToSentItems ?? false,
            }),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            // Clear token cache on 401 so next attempt gets a fresh token (matches CS)
            if (response.status === 401) {
                tokenCache.delete(cacheKey(g));
            }
            return { ok: false, error: `Graph API error (${response.status}): ${errorBody}` };
        }
        // Graph sendMail returns 202 Accepted with no body on success
        // Generate synthetic messageId from sender domain (matches CS)
        const domain = senderEmail.split("@")[1] || "graph.microsoft.com";
        return { ok: true, providerMessageId: `<graph-${Date.now()}@${domain}>` };
    }
    catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}
//# sourceMappingURL=email-graph.js.map