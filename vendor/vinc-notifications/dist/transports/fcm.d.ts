import type { MobilePushConfig, SendResult } from "../types.js";
export interface FcmMessage {
    token: string;
    title: string;
    body: string;
    /** Platform hint — enables iOS apns block when "ios" */
    platform?: "ios" | "android" | "web";
    /** iOS badge count */
    badge?: number;
    /** Data payload (string values only, per FCM spec) */
    data?: Record<string, string>;
    priority?: "high" | "normal";
    /** Notification image URL (shown as large image in notification) */
    image?: string;
    /** Deep-link / action URL — added to data and Android clickAction */
    action_url?: string;
    /** Android notification channel ID (default: "default") */
    channelId?: string;
    /** Time-to-live in seconds */
    ttl?: number;
    /** Android notification small-icon drawable name; falls back to cfg.defaultIcon */
    icon?: string;
}
export declare function sendFcm(cfg: MobilePushConfig, msg: FcmMessage): Promise<SendResult>;
//# sourceMappingURL=fcm.d.ts.map