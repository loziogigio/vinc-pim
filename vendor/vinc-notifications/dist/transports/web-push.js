import webpush from "web-push";
export async function sendWebPush(cfg, subscription, payload) {
    try {
        if (!cfg.enabled)
            return { ok: false, skipped: true };
        if (!cfg.vapidPublicKey || !cfg.vapidPrivateKey)
            return { ok: false, error: "VAPID keys missing" };
        webpush.setVapidDetails(cfg.vapidSubject ?? "mailto:admin@example.com", cfg.vapidPublicKey, cfg.vapidPrivateKey);
        const body = JSON.stringify({
            title: payload.title,
            body: payload.body,
            icon: payload.icon ?? cfg.defaultIcon,
            badge: payload.badge ?? cfg.defaultBadge,
            action_url: payload.action_url,
            push_id: payload.push_id,
            timestamp: payload.timestamp,
            data: payload.data,
        });
        const res = await webpush.sendNotification(subscription, body);
        return {
            ok: res.statusCode >= 200 && res.statusCode < 300,
            providerMessageId: String(res.statusCode),
        };
    }
    catch (err) {
        const status = err.statusCode;
        return {
            ok: false,
            statusCode: status,
            permanentlyInvalid: status === 410 || status === 404,
            error: `${err instanceof Error ? err.message : String(err)}${status ? ` (${status})` : ""}`,
        };
    }
}
//# sourceMappingURL=web-push.js.map