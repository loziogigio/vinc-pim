export const ConsoleSmsProvider = {
    id: "vonage", // dev-only stand-in id; only used when explicitly registered
    async send(msg, _cfg) {
        // eslint-disable-next-line no-console
        console.log(`[ConsoleSmsProvider] → ${msg.to}: ${msg.body}`);
        return { ok: true, providerMessageId: "console" };
    },
};
//# sourceMappingURL=console.js.map