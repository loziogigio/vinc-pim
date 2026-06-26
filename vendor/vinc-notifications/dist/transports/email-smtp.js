import nodemailer from "nodemailer";
export async function sendEmailViaSmtp(cfg, msg) {
    try {
        const smtp = cfg.smtp ?? {};
        const transportOptions = {
            host: smtp.host,
            port: smtp.port ?? 587,
            secure: smtp.secure ?? false,
        };
        // Only add auth if credentials are provided (matches CS: skip auth for localhost without creds)
        if (smtp.user && smtp.password) {
            transportOptions.auth = {
                user: smtp.user,
                pass: smtp.password,
            };
        }
        const transporter = nodemailer.createTransport(transportOptions);
        const from = cfg.fromName ? `"${cfg.fromName}" <${cfg.from}>` : cfg.from;
        // Use .then(onFulfilled, onRejected) to attach both handlers atomically,
        // avoiding any window where vitest 2.x can intercept a "briefly unhandled" rejection.
        return await transporter
            .sendMail({
            from,
            to: msg.to,
            cc: msg.cc,
            bcc: msg.bcc,
            replyTo: msg.replyTo,
            subject: msg.subject,
            html: msg.html,
            text: msg.text,
            attachments: msg.attachments,
        })
            .then((info) => ({ ok: true, providerMessageId: info.messageId }), (err) => ({ ok: false, error: err instanceof Error ? err.message : String(err) }));
    }
    catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}
//# sourceMappingURL=email-smtp.js.map