/**
 * Change Password API
 *
 * POST /api/auth/change-password
 *
 * Changes the password for an authenticated portal user.
 * Authenticates via portal-user JWT (Bearer token).
 * Validates current password via bcrypt, then sets the new password hash.
 * Sends a confirmation email after successful change.
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { verifyPortalUserToken } from "@/lib/auth/portal-user-token";
import { connectWithModels } from "@/lib/db/connection";
import { sendPasswordResetConfirmation } from "@/lib/notifications/send.service";

interface ChangePasswordRequest {
  currentPassword?: string;
  password?: string;
  newPassword?: string;
  current_password?: string;
  new_password?: string;
}

export async function POST(req: NextRequest) {
  // Get auth token from header
  const authHeader = req.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;

  if (!accessToken) {
    return NextResponse.json(
      { success: false, message: "Authentication required" },
      { status: 401 }
    );
  }

  // Validate portal-user token
  const payload = await verifyPortalUserToken(accessToken);
  if (!payload) {
    return NextResponse.json(
      { success: false, message: "Invalid or expired token" },
      { status: 401 }
    );
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

  const currentPass = body.currentPassword || body.current_password;
  const newPass = body.password || body.newPassword || body.new_password;

  if (!currentPass) {
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

  if (newPass.length < 4) {
    return NextResponse.json(
      { success: false, message: "La nuova password deve essere di almeno 4 caratteri" },
      { status: 400 }
    );
  }

  try {
    const tenantDb = `vinc-${payload.tenantId}`;
    const { PortalUser: PortalUserModel } = await connectWithModels(tenantDb);

    const user = await PortalUserModel.findOne({
      portal_user_id: payload.portalUserId,
      tenant_id: payload.tenantId,
      is_active: true,
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    // Verify current password
    const passwordValid = await bcrypt.compare(currentPass, user.password_hash);
    if (!passwordValid) {
      return NextResponse.json(
        { success: false, message: "La password attuale non è corretta" },
        { status: 401 }
      );
    }

    // Hash and set new password
    const newHash = await bcrypt.hash(newPass, 10);
    await PortalUserModel.updateOne(
      { _id: user._id },
      { $set: { password_hash: newHash } }
    );

    // Send confirmation email (non-blocking)
    if (user.email) {
      try {
        await sendPasswordResetConfirmation(tenantDb, user.email, {
          customer_name: user.email.split("@")[0],
          reset_date: new Intl.DateTimeFormat("it-IT", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          }).format(new Date()),
          channel: user.channel || undefined,
        });
      } catch (emailError) {
        console.error("[change-password] Email send failed:", emailError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Password cambiata con successo",
    });
  } catch (error) {
    console.error("[change-password] Error:", error);
    return NextResponse.json(
      { success: false, message: "Si è verificato un errore" },
      { status: 500 }
    );
  }
}
