/**
 * /api/admin/oauth-clients
 *
 * GET  - List all OAuth clients
 * POST - Create a new OAuth client
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth, unauthorizedResponse } from "@/lib/auth/admin-auth";
import { getAuthClientModel } from "@/lib/db/models/sso-auth-client";
import crypto from "crypto";
import bcrypt from "bcryptjs";

/**
 * GET /api/admin/oauth-clients
 * List all OAuth clients (without secrets)
 */
export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const AuthClient = await getAuthClientModel();
    const clients = await AuthClient.find({})
      .select("-client_secret_hash") // Never expose the hash
      .sort({ created_at: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      clients,
      count: clients.length,
    });
  } catch (error) {
    console.error("List OAuth clients error:", error);
    return NextResponse.json(
      { error: "Failed to list OAuth clients" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/oauth-clients
 * Create a new OAuth client
 *
 * Body:
 * - client_id: string (required) - Unique identifier (lowercase, alphanumeric, dashes)
 * - name: string (required) - Display name
 * - type: "web" | "mobile" | "api" (optional, defaults to "web")
 * - redirect_uris: string[] (required for mobile, optional for web) - Deep links for mobile apps
 * - description: string (optional) - Description
 * - is_first_party: boolean (optional, defaults to false)
 *
 * Note: Web apps use tenant-configured domains for redirect validation.
 * Only mobile apps need explicit redirect_uris for deep links.
 */
export async function POST(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const body = await req.json();
    const {
      client_id,
      name,
      type = "web",
      redirect_uris,
      description,
      is_first_party = false,
    } = body;

    // Validate required fields
    if (!client_id) {
      return NextResponse.json(
        { error: "client_id is required" },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    // redirect_uris required only for mobile apps (for deep links)
    // web apps use tenant-configured domains for validation
    if (type === "mobile" && (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0)) {
      return NextResponse.json(
        { error: "Mobile apps require at least one redirect URI (deep link)" },
        { status: 400 }
      );
    }

    // Validate client_id format
    if (!/^[a-z0-9-]+$/.test(client_id)) {
      return NextResponse.json(
        { error: "client_id must be lowercase alphanumeric with dashes only" },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ["web", "mobile", "api"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `type must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate redirect URIs are valid URLs (if provided)
    const uris = redirect_uris || [];
    for (const uri of uris) {
      try {
        new URL(uri);
      } catch {
        return NextResponse.json(
          { error: `Invalid redirect URI: ${uri}` },
          { status: 400 }
        );
      }
    }

    // Check if client already exists
    const AuthClient = await getAuthClientModel();
    const existing = await AuthClient.findOne({ client_id: client_id.toLowerCase() });
    if (existing) {
      return NextResponse.json(
        { error: `Client with ID '${client_id}' already exists` },
        { status: 409 }
      );
    }

    // Generate client secret
    const clientSecret = crypto.randomBytes(32).toString("base64url");
    const clientSecretHash = await bcrypt.hash(clientSecret, 10);

    // Create the client
    const client = await AuthClient.create({
      client_id: client_id.toLowerCase(),
      client_secret_hash: clientSecretHash,
      name,
      type,
      redirect_uris: uris,
      description: description || "",
      is_first_party,
      is_active: true,
    });

    // Return the client info WITH the secret (shown only once!)
    return NextResponse.json({
      success: true,
      client: {
        client_id: client.client_id,
        name: client.name,
        type: client.type,
        redirect_uris: client.redirect_uris,
        description: client.description,
        is_first_party: client.is_first_party,
        is_active: client.is_active,
        created_at: client.created_at,
      },
      client_secret: clientSecret,
      message: "Client created successfully. Save the client_secret now - it will never be shown again!",
    });
  } catch (error) {
    console.error("Create OAuth client error:", error);
    const message = error instanceof Error ? error.message : "Failed to create OAuth client";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
