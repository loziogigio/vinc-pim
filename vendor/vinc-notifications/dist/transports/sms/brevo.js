export const BrevoSmsProvider = {
    id: "brevo",
    async send(msg, cfg) {
        try {
            const resp = await fetch("https://api.brevo.com/v3/transactionalSMS/send", {
                method: "POST",
                headers: { "api-key": cfg.apiKey ?? "", "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ sender: cfg.senderId, recipient: msg.to, content: msg.body }),
            });
            if (!resp.ok)
                return { ok: false, error: `Brevo SMS failed: ${resp.status} ${await resp.text()}` };
            const json = (await resp.json());
            return { ok: true, providerMessageId: json.messageId != null ? String(json.messageId) : undefined };
        }
        catch (err) {
            return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
    },
};
//# sourceMappingURL=brevo.js.map