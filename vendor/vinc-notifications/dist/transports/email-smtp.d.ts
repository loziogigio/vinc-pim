import type { EmailConfig, SendResult } from "../types.js";
export interface EmailMessage {
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    replyTo?: string;
    subject: string;
    html: string;
    text?: string;
}
export declare function sendEmailViaSmtp(cfg: EmailConfig, msg: EmailMessage): Promise<SendResult>;
//# sourceMappingURL=email-smtp.d.ts.map