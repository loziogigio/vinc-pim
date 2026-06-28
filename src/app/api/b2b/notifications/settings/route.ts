import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import { loadDefinition } from "@/lib/data-models/load-definition";
import { maskRecordSecrets } from "@/lib/data-models/redact-secrets";
import { composeStatus } from "@/lib/notifications/settings-status";
import { isEmailEnabledAsync } from "@/lib/email";
import { isFCMEnabled } from "@/lib/fcm";

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const { tenantDb } = auth;

  // Load sales channels (same model the /api/b2b/channels route reads)
  const { SalesChannel } = await connectWithModels(tenantDb);
  const channelDocs = await SalesChannel.find({ is_active: true }).sort({ is_default: -1, code: 1 }).lean();
  const channels = channelDocs.map((c: any) => ({ code: c.code, name: c.name, is_default: !!c.is_default }));
  const requested = req.nextUrl.searchParams.get("channel");
  const channel = requested || channels.find((c) => c.is_default)?.code || "default";

  let recordData: Record<string, unknown> = {};
  let record: { relation_id: string; channel: string; data: Record<string, unknown> } | null = null;

  const loaded = await loadDefinition(tenantDb, "notification_settings", { requireEnabled: false }).catch(() => null);
  if (loaded?.ok) {
    const { definition, RecordModel } = loaded.loaded;
    const doc: any = await RecordModel.findOne({ channel }).lean();
    if (doc) {
      const masked = maskRecordSecrets(doc, definition.fields);
      recordData = (masked.data as Record<string, unknown>) ?? {};
      record = { relation_id: doc.relation_id, channel: doc.channel, data: recordData };
    }
  }

  const [emailFallback, fcmFallback] = await Promise.all([
    isEmailEnabledAsync(tenantDb, channel).catch(() => false),
    isFCMEnabled(tenantDb).catch(() => false),
  ]);
  const status = composeStatus(recordData, { emailFallback, fcmFallback });

  return NextResponse.json({ channel, channels, record, status });
}
