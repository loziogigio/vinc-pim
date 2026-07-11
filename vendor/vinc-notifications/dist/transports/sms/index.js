import { BrevoSmsProvider } from "./brevo.js";
import { ConsoleSmsProvider } from "./console.js";
const registry = new Map();
export function registerSmsProvider(p) { registry.set(p.id, p); }
registerSmsProvider(BrevoSmsProvider);
export { BrevoSmsProvider, ConsoleSmsProvider };
export function createSmsSender(cfg) {
    return {
        async send(msg) {
            if (!cfg.enabled)
                return { ok: false, skipped: true };
            const provider = registry.get(cfg.provider);
            if (!provider)
                return { ok: false, error: `Unknown SMS provider: ${cfg.provider}` };
            return provider.send(msg, cfg);
        },
    };
}
//# sourceMappingURL=index.js.map