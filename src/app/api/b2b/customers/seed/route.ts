import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { nanoid } from "nanoid";

/**
 * POST /api/b2b/customers/seed
 * Create test customers with addresses
 * Body: { clear?: boolean } - optionally clear existing customers first
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { Customer: CustomerModel } = await connectWithModels(tenantDb);

    const body = await req.json().catch(() => ({}));
    const tenant_id = session.tenantId;

    // Optionally clear existing customers
    if (body.clear) {
      await CustomerModel.deleteMany({ tenant_id });
    }

    // Data generators
    const italianCities = [
      { city: "Milano", province: "MI", postal_code: "20100" },
      { city: "Roma", province: "RM", postal_code: "00100" },
      { city: "Torino", province: "TO", postal_code: "10100" },
      { city: "Napoli", province: "NA", postal_code: "80100" },
      { city: "Firenze", province: "FI", postal_code: "50100" },
      { city: "Bologna", province: "BO", postal_code: "40100" },
      { city: "Genova", province: "GE", postal_code: "16100" },
      { city: "Palermo", province: "PA", postal_code: "90100" },
      { city: "Bari", province: "BA", postal_code: "70100" },
      { city: "Venezia", province: "VE", postal_code: "30100" },
    ];

    const companyNames = [
      "Acme Srl", "Beta SpA", "Gamma Trading", "Delta Industries", "Epsilon Tech",
      "Zeta Solutions", "Eta Consulting", "Theta Manufacturing", "Iota Services", "Kappa Group",
    ];

    const firstNames = ["Marco", "Luca", "Giuseppe", "Giovanni", "Francesco", "Andrea", "Alessandro", "Matteo", "Lorenzo", "Davide"];
    const lastNames = ["Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco"];
    const streetNames = ["Via Roma", "Via Milano", "Via Garibaldi", "Via Dante", "Via Manzoni"];

    const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
    const randomElement = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

    const generateVatNumber = () => `IT${String(randomInt(10000000000, 99999999999))}`;
    const generateSdiCode = () => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      return Array.from({ length: 7 }, () => chars[randomInt(0, chars.length - 1)]).join("");
    };
    const generateFiscalCode = () => {
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      let code = "";
      for (let i = 0; i < 6; i++) code += letters[randomInt(0, 25)];
      code += String(randomInt(10, 99));
      code += letters[randomInt(0, 25)];
      code += String(randomInt(10, 99));
      code += letters[randomInt(0, 25)];
      code += String(randomInt(100, 999));
      code += letters[randomInt(0, 25)];
      return code;
    };

    const generateAddress = (name: string) => {
      const location = randomElement(italianCities);
      return {
        address_id: nanoid(8),
        address_type: "both" as const,
        label: "Sede Principale",
        is_default: true,
        recipient_name: name,
        street_address: `${randomElement(streetNames)} ${randomInt(1, 200)}`,
        city: location.city,
        province: location.province,
        postal_code: location.postal_code,
        country: "IT",
        phone: `+39 0${randomInt(2, 9)} ${randomInt(1000000, 9999999)}`,
        created_at: new Date(),
        updated_at: new Date(),
      };
    };

    const customers = [];

    // 8 business customers
    for (let i = 0; i < 8; i++) {
      const companyName = companyNames[i % companyNames.length];
      const address = generateAddress(companyName);
      customers.push({
        customer_id: nanoid(12),
        external_code: `CLI-${randomInt(1000, 9999)}`,
        tenant_id,
        customer_type: "business",
        is_guest: false,
        email: `info@${companyName.toLowerCase().replace(/\s+/g, "")}${i}.it`,
        phone: `+39 0${randomInt(2, 9)} ${randomInt(1000000, 9999999)}`,
        company_name: companyName,
        legal_info: {
          vat_number: generateVatNumber(),
          fiscal_code: generateVatNumber().replace("IT", ""),
          pec_email: `${companyName.toLowerCase().replace(/\s+/g, "")}@pec.it`,
          sdi_code: generateSdiCode(),
        },
        addresses: [address],
        default_shipping_address_id: address.address_id,
        default_billing_address_id: address.address_id,
      });
    }

    // 6 private customers (registered)
    for (let i = 0; i < 6; i++) {
      const firstName = firstNames[i % firstNames.length];
      const lastName = lastNames[i % lastNames.length];
      const fullName = `${firstName} ${lastName}`;
      const address = generateAddress(fullName);
      customers.push({
        customer_id: nanoid(12),
        tenant_id,
        customer_type: "private",
        is_guest: false,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomInt(1, 99)}@email.it`,
        phone: `+39 3${randomInt(20, 99)} ${randomInt(1000000, 9999999)}`,
        first_name: firstName,
        last_name: lastName,
        legal_info: {
          fiscal_code: generateFiscalCode(),
        },
        addresses: [address],
        default_shipping_address_id: address.address_id,
        default_billing_address_id: address.address_id,
      });
    }

    // 4 guest customers
    for (let i = 0; i < 4; i++) {
      const firstName = firstNames[(i + 6) % firstNames.length];
      const lastName = lastNames[(i + 6) % lastNames.length];
      const fullName = `${firstName} ${lastName}`;
      const address = generateAddress(fullName);
      customers.push({
        customer_id: nanoid(12),
        tenant_id,
        customer_type: "private",
        is_guest: true,
        email: `guest.${firstName.toLowerCase()}${randomInt(1, 999)}@email.it`,
        phone: `+39 3${randomInt(20, 99)} ${randomInt(1000000, 9999999)}`,
        first_name: firstName,
        last_name: lastName,
        addresses: [address],
        default_shipping_address_id: address.address_id,
        default_billing_address_id: address.address_id,
      });
    }

    // 2 reseller customers
    for (let i = 0; i < 2; i++) {
      const companyName = `${lastNames[i]} Distribuzione`;
      const address = generateAddress(companyName);
      customers.push({
        customer_id: nanoid(12),
        external_code: `RES-${randomInt(100, 999)}`,
        tenant_id,
        customer_type: "reseller",
        is_guest: false,
        email: `ordini@${companyName.toLowerCase().replace(/\s+/g, "")}${i}.it`,
        phone: `+39 0${randomInt(2, 9)} ${randomInt(1000000, 9999999)}`,
        company_name: companyName,
        legal_info: {
          vat_number: generateVatNumber(),
          pec_email: `${companyName.toLowerCase().replace(/\s+/g, "")}@pec.it`,
          sdi_code: generateSdiCode(),
        },
        addresses: [address],
        default_shipping_address_id: address.address_id,
        default_billing_address_id: address.address_id,
      });
    }

    // Insert all customers
    const created = await CustomerModel.insertMany(customers);

    // Count by type
    const counts = {
      business: created.filter(c => c.customer_type === "business").length,
      private_registered: created.filter(c => c.customer_type === "private" && !c.is_guest).length,
      private_guest: created.filter(c => c.customer_type === "private" && c.is_guest).length,
      reseller: created.filter(c => c.customer_type === "reseller").length,
    };

    return NextResponse.json({
      success: true,
      message: `Created ${created.length} test customers`,
      tenant_id,
      counts,
      customer_ids: created.map(c => c.customer_id),
    });
  } catch (error) {
    console.error("Error seeding customers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
