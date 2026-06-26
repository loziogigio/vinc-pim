import type { WebPushConfig, SendResult } from "../types.js";
export interface WebPushSubscription {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}
export interface WebPushPayload {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    /** Deep-link / action URL — included in the serialised notification body */
    action_url?: string;
    /** Log ID for click-tracking deduplication on the service worker side */
    push_id?: string;
    /** Unix timestamp (ms) stamped at send time */
    timestamp?: number;
    data?: Record<string, unknown>;
}
export declare function sendWebPush(cfg: WebPushConfig, subscription: WebPushSubscription, payload: WebPushPayload): Promise<SendResult>;
//# sourceMappingURL=web-push.d.ts.map