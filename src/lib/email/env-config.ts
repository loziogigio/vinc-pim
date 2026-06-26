/**
 * Leaf module — no imports from @/lib/email/index.ts
 * Exists to break the potential circular:
 *   email/index.ts → resolve-config.ts → @/lib/email → email/index.ts
 */

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  fromName: string;
}

/**
 * Build an EmailConfig from process.env (synchronous, no DB calls).
 * Imported directly by resolve-config.ts to avoid the cycle.
 */
export function getEmailConfigFromEnv(): EmailConfig {
  return {
    host: process.env.MAIL_HOST || "smtp.hostinger.com",
    port: parseInt(process.env.MAIL_PORT || "587", 10),
    secure: process.env.MAIL_SECURE === "true",
    user: process.env.MAIL_USER || "",
    password: process.env.MAIL_PASSWORD || "",
    from: process.env.MAIL_FROM || "",
    fromName: process.env.MAIL_FROM_NAME || "VINC Commerce",
  };
}
