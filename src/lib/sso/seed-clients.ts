/**
 * SSO OAuth Client Seeder
 *
 * Seeds default OAuth client applications for SSO.
 * Run this on initial setup to create the first-party clients.
 */

import { createAuthClient } from "./oauth";
import { getAuthClientModel } from "@/lib/db/models/sso-auth-client";

interface ClientConfig {
  client_id: string;
  name: string;
  description: string;
  type: "web" | "mobile" | "api";
  is_first_party: boolean;
  // Only needed for mobile apps (deep links) - web apps use tenant domains
  redirect_uris?: string[];
}

/**
 * Default VINC first-party OAuth clients.
 *
 * NOTE: For web clients, redirect URIs are validated against tenant configuration
 * (domains in superadmin and branding URLs in home-settings).
 * Only mobile apps need explicit redirect_uris for deep links.
 */
const DEFAULT_CLIENTS: ClientConfig[] = [
  {
    client_id: "vinc-b2b",
    name: "VINC B2B Portal",
    description: "B2B e-commerce portal for suppliers and retailers",
    type: "web",
    is_first_party: true,
  },
  {
    client_id: "vinc-vetrina",
    name: "VINC Vetrina",
    description: "Public storefront for retailers",
    type: "web",
    is_first_party: true,
  },
  {
    client_id: "vinc-commerce-suite",
    name: "VINC Commerce Suite",
    description: "Main commerce suite admin panel",
    type: "web",
    is_first_party: true,
  },
  {
    client_id: "vinc-mobile",
    name: "VINC Mobile App",
    description: "Native mobile application for iOS and Android",
    type: "mobile",
    // Deep links for mobile apps (app-specific, not tenant-specific)
    redirect_uris: [
      "vincmobile://auth/callback",
      "com.vendereincloud.mobile://auth/callback",
    ],
    is_first_party: true,
  },
  {
    client_id: "vinc-pim",
    name: "VINC PIM",
    description: "Product Information Management system",
    type: "web",
    is_first_party: true,
  },
];

export interface SeedResult {
  client_id: string;
  name: string;
  status: "created" | "exists" | "error";
  client_secret?: string;
  error?: string;
}

/**
 * Seed default OAuth clients.
 *
 * @param force If true, recreate existing clients (generates new secrets)
 */
export async function seedOAuthClients(
  force = false
): Promise<SeedResult[]> {
  const AuthClient = await getAuthClientModel();
  const results: SeedResult[] = [];

  for (const config of DEFAULT_CLIENTS) {
    try {
      // Check if client already exists
      const existing = await AuthClient.findByClientId(config.client_id);

      if (existing && !force) {
        results.push({
          client_id: config.client_id,
          name: config.name,
          status: "exists",
        });
        continue;
      }

      // Delete existing if forcing
      if (existing && force) {
        await AuthClient.deleteOne({ client_id: config.client_id });
      }

      // Create new client
      const { client, clientSecret } = await createAuthClient(
        config.client_id,
        config.name,
        config.redirect_uris || [],
        {
          type: config.type,
          description: config.description,
          isFirstParty: config.is_first_party,
        }
      );

      results.push({
        client_id: client.client_id,
        name: client.name,
        status: "created",
        client_secret: clientSecret,
      });
    } catch (error) {
      results.push({
        client_id: config.client_id,
        name: config.name,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}

/**
 * Get all registered OAuth clients.
 */
export async function listOAuthClients() {
  const AuthClient = await getAuthClientModel();

  return AuthClient.find({ is_active: true })
    .select("client_id name type description is_first_party redirect_uris created_at")
    .lean();
}

/**
 * Create a custom OAuth client (for third-party integrations).
 */
export async function createCustomClient(
  clientId: string,
  name: string,
  redirectUris: string[],
  options?: {
    type?: "web" | "mobile" | "api";
    allowedOrigins?: string[];
    description?: string;
    logoUrl?: string;
  }
): Promise<{ clientId: string; clientSecret: string }> {
  const { client, clientSecret } = await createAuthClient(
    clientId,
    name,
    redirectUris,
    {
      ...options,
      isFirstParty: false,
    }
  );

  return {
    clientId: client.client_id,
    clientSecret,
  };
}

/**
 * Deactivate an OAuth client.
 */
export async function deactivateClient(clientId: string): Promise<boolean> {
  const AuthClient = await getAuthClientModel();

  const result = await AuthClient.updateOne(
    { client_id: clientId },
    { $set: { is_active: false, deactivated_at: new Date() } }
  );

  return result.modifiedCount > 0;
}
