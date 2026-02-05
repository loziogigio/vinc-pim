/**
 * /api/admin/reseller-domains/[id]/verify
 *
 * POST - Verify domain ownership via DNS TXT record
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth, unauthorizedResponse } from "@/lib/auth/admin-auth";
import { getResellerDomainModel } from "@/lib/db/models/admin-reseller-domain";
import dns from "dns/promises";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/reseller-domains/[id]/verify
 * Verify domain ownership by checking DNS TXT record
 *
 * Expected DNS record: _vinc-verify.{hostname} = {verification_token}
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await verifyAdminAuth(req);
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await params;
    const ResellerDomainModel = await getResellerDomainModel();

    const domain = await ResellerDomainModel.findById(id);

    if (!domain) {
      return NextResponse.json(
        { error: "Reseller domain not found" },
        { status: 404 }
      );
    }

    if (domain.is_verified) {
      return NextResponse.json({
        success: true,
        already_verified: true,
        message: "Domain is already verified",
      });
    }

    if (!domain.verification_token) {
      return NextResponse.json(
        { error: "No verification token found. Please recreate the domain." },
        { status: 400 }
      );
    }

    // Check DNS TXT record
    const txtRecordName = `_vinc-verify.${domain.hostname}`;
    let txtRecords: string[][] = [];

    try {
      txtRecords = await dns.resolveTxt(txtRecordName);
    } catch (dnsError) {
      // DNS lookup failed - record doesn't exist
      return NextResponse.json({
        success: false,
        verified: false,
        message: `DNS TXT record not found. Please add: ${txtRecordName} = ${domain.verification_token}`,
        expected_record: {
          name: txtRecordName,
          type: "TXT",
          value: domain.verification_token,
        },
      });
    }

    // Flatten TXT records (they can be split into multiple strings)
    const flattenedRecords = txtRecords.map((record) => record.join(""));

    // Check if verification token matches
    const isVerified = flattenedRecords.some(
      (record) => record === domain.verification_token
    );

    if (!isVerified) {
      return NextResponse.json({
        success: false,
        verified: false,
        message: "DNS TXT record found but value doesn't match",
        expected: domain.verification_token,
        found: flattenedRecords,
      });
    }

    // Update domain as verified
    await ResellerDomainModel.findByIdAndUpdate(id, {
      $set: {
        is_verified: true,
        verified_at: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      verified: true,
      message: `Domain '${domain.hostname}' verified successfully`,
      verified_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Verify reseller domain error:", error);
    return NextResponse.json(
      { error: "Failed to verify domain" },
      { status: 500 }
    );
  }
}
