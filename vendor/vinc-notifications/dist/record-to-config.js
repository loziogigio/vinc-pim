function str(v) {
    if (v === undefined || v === null || v === "")
        return undefined;
    return String(v);
}
function bool(v) {
    if (typeof v === "boolean")
        return v;
    if (typeof v === "string")
        return v === "true" || v === "on" || v === "1";
    return Boolean(v);
}
function num(v) {
    if (v === undefined || v === null || v === "")
        return undefined;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : undefined;
}
export function recordToConfig(channel, data) {
    const d = data ?? {};
    return {
        channel,
        email: {
            enabled: bool(d.email_enabled),
            transport: str(d.email_transport) ?? "smtp",
            from: str(d.email_from),
            fromName: str(d.email_from_name),
            smtp: {
                host: str(d.smtp_host),
                port: num(d.smtp_port),
                secure: bool(d.smtp_secure),
                user: str(d.smtp_user),
                password: str(d.smtp_password),
            },
            graph: {
                azureTenantId: str(d.graph_azure_tenant_id),
                clientId: str(d.graph_client_id),
                clientSecret: str(d.graph_client_secret),
                senderEmail: str(d.graph_sender_email),
                senderName: str(d.graph_sender_name),
            },
        },
        sms: {
            enabled: bool(d.sms_enabled),
            provider: str(d.sms_provider) ?? "brevo",
            senderId: str(d.sms_sender_id),
            apiKey: str(d.sms_api_key),
            apiSecret: str(d.sms_api_secret),
        },
        webPush: {
            enabled: bool(d.webpush_enabled),
            vapidPublicKey: str(d.webpush_vapid_public_key),
            vapidPrivateKey: str(d.webpush_vapid_private_key),
            vapidSubject: str(d.webpush_vapid_subject),
            defaultIcon: str(d.webpush_default_icon),
            defaultBadge: str(d.webpush_default_badge),
        },
        mobilePush: {
            enabled: bool(d.fcm_enabled),
            projectId: str(d.fcm_project_id),
            clientEmail: str(d.fcm_client_email),
            privateKey: str(d.fcm_private_key),
            defaultIcon: str(d.fcm_default_icon),
            defaultColor: str(d.fcm_default_color),
        },
    };
}
//# sourceMappingURL=record-to-config.js.map