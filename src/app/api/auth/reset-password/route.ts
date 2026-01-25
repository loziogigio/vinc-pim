/**
 * SSO Reset Password API
 *
 * POST /api/auth/reset-password
 *
 * Resets password for a user by email (forgot password flow).
 * - If no password provided: generates temp password and sends email
 * - If password provided: sets the password directly
 *
 * No authentication required (forgot password flow).
 */

import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { getVincApiForTenant, VincApiError } from "@/lib/vinc-api";
import { sendForgotPasswordNotification } from "@/lib/notifications/send.service";

interface ResetPasswordRequest {
  // User email
  username?: string;
  email?: string;

  // Tenant identification
  tenant_id: string;

  // Optional: Set specific password (if not provided, generates temp)
  password?: string;

  // Optional: Customer info for email
  ragioneSociale?: string;
  contactName?: string;
}

/**
 * Generate a secure random password
 */
function generateSecurePassword(length: number = 12): string {
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  const special = "!@#$%^&*";
  const all = lowercase + uppercase + digits + special;

  // Ensure at least one of each type
  let password =
    lowercase[crypto.randomInt(lowercase.length)] +
    uppercase[crypto.randomInt(uppercase.length)] +
    digits[crypto.randomInt(digits.length)] +
    special[crypto.randomInt(special.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += all[crypto.randomInt(all.length)];
  }

  // Shuffle the password
  const shuffled = password
    .split("")
    .sort(() => crypto.randomInt(3) - 1)
    .join("");

  return shuffled;
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
    password,
    ragioneSociale,
    contactName,
  } = body;

  const userEmail = username || email;

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
    // Get VINC API client for tenant
    const vincApi = getVincApiForTenant(tenant_id);

    // Determine the password to set
    let passwordToSet = password;
    let tempPassword: string | null = null;

    // If no password provided, generate a temporary one (forgot password flow)
    if (!password) {
      tempPassword = generateSecurePassword(12);
      passwordToSet = tempPassword;
    }

    // Call VINC API to set the password by email
    await vincApi.auth.setPasswordByEmail(userEmail, passwordToSet!);

    // Send forgot password email with temp password using notification templates
    const tenantDb = `vinc-${tenant_id}`;
    if (tempPassword) {
      try {
        const result = await sendForgotPasswordNotification(tenantDb, userEmail, {
          customer_name: contactName || ragioneSociale || "Cliente",
          temporary_password: tempPassword,
        });

        if (!result.success) {
          console.warn("[reset-password] Email send warning:", result.error);
          // Don't fail the request if email fails - password was already changed
        }
      } catch (emailError) {
        console.error("[reset-password] Email send failed:", emailError);
        // Don't fail the request if email fails - password was already changed
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

    if (error instanceof VincApiError) {
      if (error.status === 404) {
        return NextResponse.json(
          { success: false, message: "Utente non trovato" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { success: false, message: error.detail || "Operazione fallita" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Si è verificato un errore" },
      { status: 500 }
    );
  }
}
