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
