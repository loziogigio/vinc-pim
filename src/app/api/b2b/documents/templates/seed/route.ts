/**
 * Seed Document Templates API
 *
 * POST /api/b2b/documents/templates/seed - Seed standard system templates (idempotent)
 *
 * Body: { force?: boolean }
 *   force=true  → deletes existing system templates and re-creates from latest code
 *   force=false → skips if system templates already exist (default)
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateDocumentRequest } from "../../_auth";
import { seedDocumentTemplates } from "@/lib/services/seed-document-templates";

export async function POST(req: NextRequest) {
  const auth = await authenticateDocumentRequest(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
  }

  let force = false;
  try {
    const body = await req.json();
    force = body.force === true;
  } catch {
    // No body or invalid JSON — use defaults
  }

  const count = await seedDocumentTemplates(auth.tenantDb!, auth.tenantId!, force);

  return NextResponse.json({
    success: true,
    message: force
      ? `System templates re-created (${count} templates)`
      : count > 0
        ? `System templates seeded (${count} templates)`
        : "System templates already exist (use force: true to re-create)",
  });
}
