/**
 * /api/admin/oauth-clients/[id]/regenerate-secret
 *
 * POST - Regenerate the client secret
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth, unauthorizedResponse } from "@/lib/auth/admin-auth";
import { getAuthClientModel } from "@/lib/db/models/sso-auth-client";
import crypto from "crypto";
import bcrypt from "bcryptjs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/oauth-clients/[id]/regenerate-secret
 * Generate a new client secret (invalidates the old one)
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await verifyAdminAuth(req);
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await params;

    const AuthClient = await getAuthClientModel();

    // Check if client exists
    const existing = await AuthClient.findOne({ client_id: id.toLowerCase() });
    if (!existing) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    // Generate new secret
    const newSecret = crypto.randomBytes(32).toString("base64url");
    const newSecretHash = await bcrypt.hash(newSecret, 10);

    // Update the client with new secret
    const client = await AuthClient.findOneAndUpdate(
      { client_id: id.toLowerCase() },
      { $set: { client_secret_hash: newSecretHash } },
      { new: true }
    ).select("-client_secret_hash");

    return NextResponse.json({
      success: true,
      client_id: client?.client_id,
      client_secret: newSecret,
      message: "New secret generated successfully. Save it now - it will never be shown again! The old secret is now invalid.",
    });
  } catch (error) {
    console.error("Regenerate secret error:", error);
    return NextResponse.json(
      { error: "Failed to regenerate secret" },
      { status: 500 }
    );
  }
}
