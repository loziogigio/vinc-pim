import type { SmsConfig, SmsMessage, SmsProvider, SendResult } from "../../types.js";
import { BrevoSmsProvider } from "./brevo.js";
import { ConsoleSmsProvider } from "./console.js";
export declare function registerSmsProvider(p: SmsProvider): void;
export { BrevoSmsProvider, ConsoleSmsProvider };
export declare function createSmsSender(cfg: SmsConfig): {
    send(msg: SmsMessage): Promise<SendResult>;
};
//# sourceMappingURL=index.d.ts.map