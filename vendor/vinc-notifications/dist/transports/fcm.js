import admin from "firebase-admin";
/**
 * Firebase error codes that indicate a token will never work again.
 * These match CS cleanup.service.ts PERMANENTLY_INVALID_ERROR_CODES.
 */
const PERMANENTLY_INVALID_CODES = [
    "messaging/registration-token-not-registered",
    "messaging/invalid-registration-token",
    "messaging/unregistered",
    "messaging/invalid-argument",
];
// Keyed by "projectId:clientEmail" so multiple tenants/channels don't collide.
const apps = new Map();
function getApp(cfg) {
    const key = `${cfg.projectId}:${cfg.clientEmail}`;
    let app = apps.get(key);
    if (!app) {
        app = admin.initializeApp({
            credential: admin.credential.cert({
                projectId: cfg.projectId,
                clientEmail: cfg.clientEmail,
                privateKey: cfg.privateKey?.replace(/\\n/g, "\n"),
            }),
        }, key);
        apps.set(key, app);
    }
    return app;
}
export async function sendFcm(cfg, msg) {
    try {
        if (!cfg.enabled)
            return { ok: false, skipped: true };
        if (!cfg.projectId || !cfg.clientEmail || !cfg.privateKey) {
            return { ok: false, error: "FCM credentials missing" };
        }
        // Merge action_url into data map (FCM data must be string values)
        const dataMap = {
            ...(msg.data ?? {}),
            ...(msg.action_url ? { action_url: msg.action_url, click_action: msg.action_url } : {}),
        };
        const message = {
            token: msg.token,
            notification: {
                title: msg.title,
                body: msg.body,
                imageUrl: msg.image,
            },
            data: Object.keys(dataMap).length > 0 ? dataMap : undefined,
            android: {
                priority: msg.priority === "high" ? "high" : "normal",
                ttl: msg.ttl !== undefined ? msg.ttl * 1000 : undefined,
                notification: {
                    icon: cfg.defaultIcon,
                    color: cfg.defaultColor,
                    channelId: msg.channelId || "default",
                    clickAction: msg.action_url || "FLUTTER_NOTIFICATION_CLICK",
                },
            },
        };
        // iOS apns block — matches CS fcm/index.ts:164-178
        if (msg.platform === "ios") {
            message.apns = {
                headers: {
                    "apns-priority": msg.priority === "high" ? "10" : "5",
                },
                payload: {
                    aps: {
                        badge: msg.badge,
                        sound: "default",
                        contentAvailable: true,
                        mutableContent: true,
                    },
                },
            };
        }
        const id = await admin.messaging(getApp(cfg)).send(message);
        return { ok: true, providerMessageId: id };
    }
    catch (err) {
        const code = err.code;
        const isPermanent = code
            ? PERMANENTLY_INVALID_CODES.some((c) => code.includes(c))
            : false;
        return {
            ok: false,
            permanentlyInvalid: isPermanent,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
//# sourceMappingURL=fcm.js.map