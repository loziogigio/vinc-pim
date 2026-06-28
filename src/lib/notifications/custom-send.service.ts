export type CustomChannel = "email" | "sms" | "webpush" | "fcm";
const CHANNELS: CustomChannel[] = ["email", "sms", "webpush", "fcm"];

export interface CustomMessage {
  subject?: string; html?: string; text?: string;
  title?: string; body?: string; url?: string;
}

export interface CustomSendInput {
  channel: string;
  channels: CustomChannel[];
  to?: string;
  sms_to?: string;
  user_ids?: string[];
  immediate: boolean;
  message: CustomMessage;
}

const CAPS: Record<keyof CustomMessage, number> = {
  subject: 200, html: 100000, text: 1000, title: 200, body: 2000, url: 2000,
};

export function validateCustomRequest(
  body: unknown,
): { ok: true; value: CustomSendInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const channels = b.channels;
  if (!Array.isArray(channels) || channels.length === 0) {
    return { ok: false, error: "channels must be a non-empty array" };
  }
  for (const c of channels) {
    if (!CHANNELS.includes(c as CustomChannel)) return { ok: false, error: `unknown channel: ${String(c)}` };
  }
  const message = (b.message ?? {}) as CustomMessage;
  for (const k of Object.keys(CAPS) as (keyof CustomMessage)[]) {
    const v = message[k];
    if (typeof v === "string" && v.length > CAPS[k]) return { ok: false, error: `${k} exceeds ${CAPS[k]} chars` };
  }
  const set = new Set(channels as CustomChannel[]);
  const to = typeof b.to === "string" ? b.to : undefined;
  const smsTo = typeof b.sms_to === "string" ? b.sms_to : undefined;
  const userIds = Array.isArray(b.user_ids) ? (b.user_ids as string[]) : undefined;

  if (set.has("email") && (!to || !message.subject || !(message.html || message.text))) {
    return { ok: false, error: "email requires to, subject and html or text" };
  }
  if (set.has("sms") && (!smsTo || !message.text)) {
    return { ok: false, error: "sms requires sms_to and text" };
  }
  if ((set.has("webpush") || set.has("fcm")) && (!userIds?.length || !message.title || !message.body)) {
    return { ok: false, error: "webpush/fcm require user_ids, title and body" };
  }

  return {
    ok: true,
    value: {
      channel: typeof b.channel === "string" && b.channel ? b.channel : "default",
      channels: channels as CustomChannel[],
      to, sms_to: smsTo, user_ids: userIds,
      immediate: b.immediate === undefined ? true : Boolean(b.immediate),
      message,
    },
  };
}

import { sendEmail } from "@/lib/email";
import { sendSms } from "@/lib/sms";
import { sendPush } from "@/lib/push";
import { sendFCM } from "@/lib/fcm";

export interface CustomChannelResult {
  ok: boolean;
  logId?: string;
  messageId?: string;
  sent?: number;
  error?: string;
}

export interface CustomSendResult {
  ok: boolean;
  results: Partial<Record<CustomChannel, CustomChannelResult>>;
}

export async function sendCustomNotification(
  input: CustomSendInput & { tenantDb: string },
): Promise<CustomSendResult> {
  const { tenantDb, channel, channels, to, sms_to, user_ids, immediate, message } = input;
  const results: Partial<Record<CustomChannel, CustomChannelResult>> = {};

  for (const ch of channels) {
    try {
      if (ch === "email") {
        const r = await sendEmail({
          to: to!, subject: message.subject!, html: message.html, text: message.text,
          immediate, tenantDb, channel,
        });
        results.email = { ok: r.success, logId: r.emailId, messageId: r.messageId, error: r.error };
      } else if (ch === "sms") {
        const r = await sendSms({ to: sms_to!, body: message.text!, tenantDb, channel, immediate });
        results.sms = { ok: r.ok, logId: r.logId, error: r.error };
      } else if (ch === "webpush") {
        const r = await sendPush({
          tenantDb, title: message.title!, body: message.body!, action_url: message.url, userIds: user_ids,
        });
        results.webpush = { ok: r.success, sent: r.sent, error: r.errors?.[0]?.error };
      } else if (ch === "fcm") {
        const r = await sendFCM({
          tenantDb, title: message.title!, body: message.body!, action_url: message.url,
          userIds: user_ids, queue: !immediate,
        });
        results.fcm = { ok: r.success, sent: r.sent, error: r.errors?.[0]?.error };
      }
    } catch (err) {
      results[ch] = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  const ok = Object.values(results).every((r) => r?.ok);
  return { ok, results };
}
