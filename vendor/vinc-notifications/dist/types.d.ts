export type EmailTransport = "smtp" | "graph";
export interface SmtpConfig {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    password?: string;
}
export interface GraphConfig {
    azureTenantId?: string;
    clientId?: string;
    clientSecret?: string;
    senderEmail?: string;
    senderName?: string;
    saveToSentItems?: boolean;
}
export interface EmailConfig {
    enabled: boolean;
    transport: EmailTransport;
    from?: string;
    fromName?: string;
    smtp?: SmtpConfig;
    graph?: GraphConfig;
}
export type SmsProviderId = "brevo" | "twilio" | "vonage";
export interface SmsConfig {
    enabled: boolean;
    provider: SmsProviderId;
    senderId?: string;
    apiKey?: string;
    apiSecret?: string;
}
export interface WebPushConfig {
    enabled: boolean;
    vapidPublicKey?: string;
    vapidPrivateKey?: string;
    vapidSubject?: string;
    defaultIcon?: string;
    defaultBadge?: string;
}
export interface MobilePushConfig {
    enabled: boolean;
    projectId?: string;
    clientEmail?: string;
    privateKey?: string;
    defaultIcon?: string;
    defaultColor?: string;
}
export interface NotificationChannelConfig {
    /** sales-channel code this config belongs to */
    channel: string;
    email?: EmailConfig;
    sms?: SmsConfig;
    webPush?: WebPushConfig;
    mobilePush?: MobilePushConfig;
}
export interface SendResult {
    ok: boolean;
    providerMessageId?: string;
    error?: string;
    skipped?: boolean;
}
export interface SmsMessage {
    to: string;
    body: string;
}
export interface SmsProvider {
    id: SmsProviderId;
    send(msg: SmsMessage, cfg: SmsConfig): Promise<SendResult>;
}
//# sourceMappingURL=types.d.ts.map