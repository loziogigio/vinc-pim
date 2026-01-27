/**
 * B2B Addresses API
 *
 * POST /api/b2b/addresses
 *
 * Proxies address requests to the VINC API.
 * Transforms VINC API B2BAddress format to UI-friendly AddressB2B format.
 */

import { NextRequest, NextResponse } from "next/server";
import { getVincApiForTenant, VincApiError } from "@/lib/vinc-api";
import type { B2BAddress } from "@/lib/vinc-api/types";

interface AddressB2B {
  id: string;
  title: string;
  isLegalSeat: boolean;
  isDefault: boolean;
  address: {
    street_address: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  contact: {
    phone?: string;
    mobile?: string;
    email?: string;
  };
  agent: {
    code?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  paymentTerms: {
    code?: string;
    label?: string;
  };
  port: {
    code?: string;
    label?: string;
  };
  carrier: {
    code?: string;
    label?: string;
  };
  currency: {
    code?: string;
    label?: string;
  };
}

interface AddressesRequest {
  customer_id: string;
  tenant_id: string;
}

/**
 * Transform VINC API B2BAddress to AddressB2B format
 * Maps fields from PostgreSQL model to the UI model
 */
function transformVincAddress(addr: B2BAddress): AddressB2B {
  const title = addr.city
    ? `${addr.street || addr.label || ""} - ${addr.city}`
    : addr.street || addr.label || addr.erp_address_id;

  return {
    id: addr.erp_address_id,
    title,
    isLegalSeat: false, // VINC API doesn't have legal seat info
    isDefault: addr.is_default || false,
    address: {
      street_address: addr.street || "",
      city: addr.city || "",
      state: addr.province || "",
      zip: addr.zip || "",
      country: addr.country || "",
    },
    contact: {
      phone: addr.phone || undefined,
      mobile: undefined,
      email: addr.email || undefined,
    },
    agent: {
      code: undefined,
      name: undefined,
      email: undefined,
      phone: undefined,
    },
    paymentTerms: {
      code: addr.payment_terms_code || undefined,
      label: undefined,
    },
    port: {
      code: undefined,
      label: undefined,
    },
    carrier: {
      code: undefined,
      label: undefined,
    },
    currency: {
      code: undefined,
      label: undefined,
    },
  };
}

export async function POST(req: NextRequest) {
  let body: AddressesRequest;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request body" },
      { status: 400 }
    );
  }

  const { customer_id, tenant_id } = body;

  // Validate required fields
  if (!customer_id) {
    return NextResponse.json(
      { success: false, message: "Customer ID is required" },
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

    // Call VINC API to get addresses
    const addresses = await vincApi.b2b.getAddresses(customer_id);

    // Transform to AddressB2B format and sort default address first
    const transformedAddresses = addresses
      .filter((addr) => addr.is_active)
      .map(transformVincAddress)
      .sort((a, b) => {
        // Default address first
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return 0;
      });

    return NextResponse.json({
      success: true,
      addresses: transformedAddresses,
    });
  } catch (error) {
    console.error("[b2b/addresses] Error:", error);

    if (error instanceof VincApiError) {
      return NextResponse.json(
        {
          success: false,
          message: error.detail || "Failed to fetch addresses",
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { success: false, message: "An error occurred" },
      { status: 500 }
    );
  }
}
