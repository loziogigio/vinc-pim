/**
 * SSO Reset Password API
 *
 * POST /api/auth/reset-password
 *
 * Resets password for a portal user by email (forgot password flow).
 * - If no password provided: generates temp password and sends email
 * - If password provided: sets the password directly
 *
 * No authentication required (forgot password flow).
 * Returns generic success even if user not found (prevent enumeration).
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectWithModels } from "@/lib/db/connection";
import { sendForgotPasswordNotification } from "@/lib/notifications/send.service";
import { generateSecurePassword } from "@/lib/utils/password";

interface ResetPasswordRequest {
  // User email
  username?: string;
  email?: string;

  // Tenant identification
  tenant_id: string;

  // Portal user channel (optional)
  channel?: string;

  // Optional: Set specific password (if not provided, generates temp)
  password?: string;

  // Optional: Customer info for email
  ragioneSociale?: string;
  contactName?: string;
}

export async function POST(req: NextRequest) {
  let body: ResetPasswordRequest;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request body" },
      { status: 400 }
    );
  }

  const {
    username,
    email,
    tenant_id,
    channel,
    password,
    ragioneSociale,
    contactName,
  } = body;

  const userEmail = (username || email || "").toLowerCase().trim();

  // Validate required fields
  if (!userEmail) {
    return NextResponse.json(
      { success: false, message: "Email is required" },
      { status: 400 }
    );
  }

  if (!tenant_id) {
    return NextResponse.json(
      { success: false, message: "Tenant ID is required" },
      { status: 400 }
    );
  }

  try {
    const tenantDb = `vinc-${tenant_id}`;
    const { PortalUser: PortalUserModel } = await connectWithModels(tenantDb);

    // Find portal user by email — prefer channel-specific match
    const baseQuery: Record<string, unknown> = {
      tenant_id,
      email: userEmail,
      is_active: true,
    };
    let user = channel
      ? await PortalUserModel.findOne({ ...baseQuery, channel })
      : null;
    if (!user) {
      user = await PortalUserModel.findOne(baseQuery);
    }

    // User not found — return generic success (prevent enumeration)
    if (!user) {
      return NextResponse.json({
        success: true,
        message: password
          ? "Password reimpostata con successo"
          : "Email di recupero inviata",
      });
    }

    // Determine the password to set
    let tempPassword: string | null = null;
    const passwordToSet = password || (tempPassword = generateSecurePassword(12));

    // Hash and update
    const newHash = await bcrypt.hash(passwordToSet, 10);
    await PortalUserModel.updateOne(
      { _id: user._id },
      { $set: { password_hash: newHash } }
    );

    // Send forgot password email with temp password
    if (tempPassword) {
      try {
        const result = await sendForgotPasswordNotification(tenantDb, userEmail, {
          customer_name: contactName || ragioneSociale || "Cliente",
          temporary_password: tempPassword,
          channel: channel || undefined,
        });

        if (!result.success) {
          console.warn("[reset-password] Email send warning:", result.error);
        }
      } catch (emailError) {
        console.error("[reset-password] Email send failed:", emailError);
      }
    }

    return NextResponse.json({
      success: true,
      message: password
        ? "Password reimpostata con successo"
        : "Email di recupero inviata",
    });
  } catch (error) {
    console.error("[reset-password] Error:", error);

    return NextResponse.json(
      { success: false, message: "Si è verificato un errore" },
      { status: 500 }
    );
  }
}
