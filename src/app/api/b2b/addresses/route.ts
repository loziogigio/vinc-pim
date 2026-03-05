/**
 * B2B Addresses API
 *
 * POST /api/b2b/addresses
 *
 * Returns customer addresses from the Customer model (MongoDB).
 * Transforms to UI-friendly AddressB2B format.
 */

import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import type { IAddress } from "@/lib/db/models/customer";

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
 * Transform Customer IAddress to AddressB2B format (backward-compatible)
 */
function transformAddress(addr: IAddress): AddressB2B {
  const title = addr.city
    ? `${addr.street_address || addr.label || ""} - ${addr.city}`
    : addr.street_address || addr.label || addr.external_code || addr.address_id;

  return {
    id: addr.external_code || addr.address_id,
    title,
    isLegalSeat: addr.address_type === "billing",
    isDefault: addr.is_default || false,
    address: {
      street_address: addr.street_address || "",
      city: addr.city || "",
      state: addr.province || "",
      zip: addr.postal_code || "",
      country: addr.country || "",
    },
    contact: {
      phone: addr.phone || undefined,
      mobile: undefined,
      email: undefined,
    },
    agent: {
      code: undefined,
      name: undefined,
      email: undefined,
      phone: undefined,
    },
    paymentTerms: {
      code: undefined,
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
    const tenantDb = `vinc-${tenant_id}`;
    const { Customer: CustomerModel } = await connectWithModels(tenantDb);

    const customer = await CustomerModel.findOne(
      { customer_id },
      { addresses: 1 }
    ).lean();

    if (!customer) {
      return NextResponse.json({
        success: true,
        addresses: [],
      });
    }

    const transformedAddresses = ((customer as any).addresses || [])
      .map(transformAddress)
      .sort((a: AddressB2B, b: AddressB2B) => {
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

    return NextResponse.json(
      { success: false, message: "An error occurred" },
      { status: 500 }
    );
  }
}
