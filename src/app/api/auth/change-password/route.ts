/**
 * SSO Change Password API
 *
 * POST /api/auth/change-password
 *
 * Changes the password for an authenticated user.
 * Validates current password by logging in via VINC API, then sets the new password.
 * Does NOT require vinc_access_token from client - handles authentication internally.
 * Sends a confirmation email after successful change.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateAccessToken } from "@/lib/sso/tokens";
import { validateSession } from "@/lib/sso/session";
import { getVincApiForTenant, VincApiError } from "@/lib/vinc-api";
import { sendResetPasswordEmail } from "@/lib/email/b2b-emails";

interface ChangePasswordRequest {
  // Password fields
  currentPassword: string;
  password: string;
  newPassword?: string; // Alternative field name
}

export async function POST(req: NextRequest) {
  // Get auth token from header
  const authHeader = req.headers.get("authorization");
  let accessToken: string | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    accessToken = authHeader.slice(7);
  }

  let body: ChangePasswordRequest;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request body" },
      { status: 400 }
    );
  }

  const { currentPassword, password, newPassword } = body;
  const newPass = password || newPassword;

  // Validate required fields
  if (!currentPassword) {
    return NextResponse.json(
      { success: false, message: "Current password is required" },
      { status: 400 }
    );
  }

  if (!newPass) {
    return NextResponse.json(
      { success: false, message: "New password is required" },
      { status: 400 }
    );
  }

  if (!accessToken) {
    return NextResponse.json(
      { success: false, message: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    // Validate the SSO token
    const payload = await validateAccessToken(accessToken);

    if (!payload) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Validate session is still active
    const session = await validateSession(payload.session_id);

    if (!session) {
      return NextResponse.json(
        { success: false, message: "Session expired or revoked" },
        { status: 401 }
      );
    }

    // Get VINC API client for tenant
    const vincApi = getVincApiForTenant(payload.tenant_id);

    // Step 1: Verify current password by logging in
    try {
      await vincApi.auth.login({
        email: payload.email,
        password: currentPassword,
      });
    } catch (error) {
      if (error instanceof VincApiError && error.status === 401) {
        return NextResponse.json(
          { success: false, message: "La password attuale non è corretta" },
          { status: 401 }
        );
      }
      throw error;
    }

    // Step 2: Set new password using admin function
    try {
      await vincApi.auth.setPasswordByEmail(payload.email, newPass);
    } catch (error) {
      if (error instanceof VincApiError) {
        if (error.status === 422) {
          const message = error.detail?.includes("at least") || error.detail?.includes("min_length")
            ? "La nuova password deve essere di almeno 4 caratteri"
            : "Dati non validi. Controlla i campi inseriti";
          return NextResponse.json(
            { success: false, message },
            { status: 400 }
          );
        }
        throw error;
      }
      throw error;
    }

    // Send confirmation email
    const tenantDb = `vinc-${payload.tenant_id}`;
    try {
      await sendResetPasswordEmail(
        {
          email: payload.email,
          ragioneSociale: session.company_name,
          contactName: payload.email?.split("@")[0],
        },
        payload.email,
        undefined,
        { tenantDb }
      );
    } catch (emailError) {
      console.error("[change-password] Email send failed:", emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: "Password cambiata con successo",
    });
  } catch (error) {
    console.error("[change-password] Error:", error);

    if (error instanceof VincApiError) {
      return NextResponse.json(
        { success: false, message: error.detail || "Cambio password fallito" },
        { status: error.status === 401 ? 401 : 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Si è verificato un errore" },
      { status: 500 }
    );
  }
}
