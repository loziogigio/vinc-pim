import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { resolveNotificationConfig } from "@/lib/notifications/resolve-config";
import {
  sendEmailViaSmtp,
  sendEmailViaGraph,
  createSmsSender,
  sendFcm,
} from "vinc-notifications/server";

/**
 * POST /api/b2b/notifications/test-send
 *
 * Fires a real test notification via the per-channel resolved config.
 * Body: { channel: string; deliveryChannel: "email"|"sms"|"webpush"|"fcm"; to: string }
 * Returns a SendResult or a skipped/error shape.
 */
export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const { tenantDb } = auth;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { channel, deliveryChannel, to } = body;

  if (!channel || !deliveryChannel || !to) {
    return NextResponse.json(
      { error: "channel, deliveryChannel and to are required" },
      { status: 400 }
    );
  }

  try {
    const cfg = await resolveNotificationConfig(tenantDb, channel as string);

    if (deliveryChannel === "email") {
      const email = cfg.email;
      if (!email?.enabled) {
        return NextResponse.json({ ok: false, skipped: true, error: "email disabled for this channel" });
      }
      const msg = {
        to: to as string,
        subject: "VINC test notification",
        html: "<p>This is a test notification from VendereInCloud Commerce Suite.</p>",
      };
      const result =
        email.transport === "graph"
          ? await sendEmailViaGraph(email, msg)
          : await sendEmailViaSmtp(email, msg);
      return NextResponse.json(result);
    }

    if (deliveryChannel === "sms") {
      if (!cfg.sms?.enabled) {
        return NextResponse.json({ ok: false, skipped: true, error: "sms disabled for this channel" });
      }
      const result = await createSmsSender(cfg.sms).send({
        to: to as string,
        body: "VINC test SMS",
      });
      return NextResponse.json(result);
    }

    if (deliveryChannel === "webpush") {
      return NextResponse.json(
        {
          ok: false,
          error: "web push test requires a live subscription; use the device test flow",
        },
        { status: 422 }
      );
    }

    if (deliveryChannel === "fcm") {
      if (!cfg.mobilePush?.enabled) {
        return NextResponse.json({ ok: false, skipped: true, error: "fcm disabled for this channel" });
      }
      const result = await sendFcm(cfg.mobilePush, {
        token: to as string,
        title: "VINC test",
        body: "Test OK",
      });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "unknown deliveryChannel" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
