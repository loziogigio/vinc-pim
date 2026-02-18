import type { HomeSettingsDocument } from "./models/home-settings";
import type { CompanyBranding, ProductCardStyle, CDNConfiguration, CDNCredentials, SMTPSettings, CompanyContactInfo, HeaderConfig, HeaderRow, MetaTags } from "@/lib/types/home-settings";
export { computeMediaCardStyle, computeMediaHoverDeclarations } from "@/lib/home-settings/style-utils";
import { connectWithModels, autoDetectTenantDb } from "./connection";

const GLOBAL_HOME_SETTINGS_ID = process.env.HOME_SETTINGS_ID?.trim() || "global-b2b-home";

const DEFAULT_BRANDING: CompanyBranding = {
  title: "B2B Store",
  primaryColor: "#009f7f",
  secondaryColor: "#02b290",
  // Extended theming colors
  accentColor: "",
  textColor: "#000000",
  mutedColor: "#595959",
  backgroundColor: "#ffffff",
  headerBackgroundColor: "",
  footerBackgroundColor: "#f5f5f5",
  footerTextColor: "#666666"
};

const LEGACY_HOME_SETTINGS_COLLECTION = "homesettings";

const DEFAULT_CARD_STYLE: ProductCardStyle = {
  borderWidth: 1,
  borderColor: "#EAEEF2",
  borderStyle: "solid",
  shadowSize: "none",
  shadowColor: "rgba(0, 0, 0, 0.1)",
  borderRadius: "md",
  hoverEffect: "none",
  hoverScale: 1.02,
  hoverShadowSize: "lg",
  backgroundColor: "#ffffff",
  hoverBackgroundColor: undefined
};

/**
 * Default header configuration matching vinc-b2b layout
 * Main row: 20-60-20 (Logo | Search+Radio | Icons)
 * Nav row: 50-50 (Menu+Buttons | Quick links)
 */
const DEFAULT_HEADER_CONFIG: HeaderConfig = {
  rows: [
    {
      id: "main",
      enabled: true,
      fixed: true,
      backgroundColor: "#ffffff",
      layout: "20-60-20",
      blocks: [
        {
          id: "left",
          alignment: "left",
          widgets: [
            { id: "logo", type: "logo", config: {} }
          ]
        },
        {
          id: "center",
          alignment: "center",
          widgets: [
            { id: "search", type: "search-bar", config: { width: "lg" } },
            { id: "radio", type: "radio-widget", config: {
              enabled: false,
              headerIcon: "",
              stations: [
                { id: "station-rtl", name: "RTL 102.5", logoUrl: "", streamUrl: "https://streamingv2.shoutcast.com/rtl-102-5" },
                { id: "station-rds", name: "RDS", logoUrl: "", streamUrl: "https://icstream.rds.radio/rds" }
              ]
            } }
          ]
        },
        {
          id: "right",
          alignment: "right",
          widgets: [
            { id: "app-launcher", type: "app-launcher", config: {} },
            { id: "no-price", type: "no-price", config: {} },
            { id: "favorites", type: "favorites", config: {} },
            { id: "compare", type: "compare", config: {} },
            { id: "profile", type: "profile", config: {} },
            { id: "cart", type: "cart", config: {} }
          ]
        }
      ]
    },
    {
      id: "nav",
      enabled: true,
      fixed: true,
      backgroundColor: "#f8fafc",
      layout: "50-50",
      blocks: [
        {
          id: "left",
          alignment: "left",
          widgets: [
            { id: "categories", type: "category-menu", config: { label: "Categorie" } },
            { id: "promo-btn", type: "button", config: { label: "Promozioni", url: "/promotions", variant: "primary" } },
            { id: "new-btn", type: "button", config: { label: "Nuovi arrivi", url: "/new-arrivals", variant: "secondary" } }
          ]
        },
        {
          id: "right",
          alignment: "right",
          widgets: [
            { id: "orders-btn", type: "button", config: { label: "i miei ordini", url: "/orders", variant: "outline" } },
            { id: "docs-btn", type: "button", config: { label: "i miei documenti", url: "/documents", variant: "outline" } },
            { id: "delivery", type: "company-info", config: { showDeliveryAddress: true } }
          ]
        }
      ]
    }
  ]
};

export { DEFAULT_HEADER_CONFIG };

/**
 * Get models for the current tenant database
 * Uses auto-detection from headers/session if tenantDb not provided
 */
async function getHomeSettingsModel(tenantDb?: string) {
  const dbName = tenantDb ?? await autoDetectTenantDb();
  const models = await connectWithModels(dbName);
  return models.HomeSettings;
}

const migrateLegacyHomeSettings = async (customerId?: string, tenantDb?: string) => {
  try {
    const HomeSettingsModel = await getHomeSettingsModel(tenantDb);
    const db = HomeSettingsModel.db;
    if (!db || typeof db.collection !== "function") {
      return null;
    }

    const legacyCollection = db.collection(LEGACY_HOME_SETTINGS_COLLECTION);
    if (!legacyCollection) {
      return null;
    }

    const query = customerId ? { customerId } : {};
    const legacyDoc = await legacyCollection.findOne(query, { sort: { updatedAt: -1 } });
    if (!legacyDoc) {
      return null;
    }

    const { _id, ...rest } = legacyDoc;
    await HomeSettingsModel.create(rest);
    console.log("[home-settings] Migrated legacy home settings into b2bhomesettings collection.");
    return rest as HomeSettingsDocument;
  } catch (error) {
    console.error("[home-settings] Failed to migrate legacy home settings:", error);
    return null;
  }
};

function mergeBranding(current: CompanyBranding | undefined, update?: Partial<CompanyBranding>): CompanyBranding {
  return {
    ...(current ?? DEFAULT_BRANDING),
    ...(update ?? {})
  };
}

function mergeCardStyle(current: ProductCardStyle | undefined, update?: Partial<ProductCardStyle>): ProductCardStyle {
  return {
    ...(current ?? DEFAULT_CARD_STYLE),
    ...(update ?? {})
  };
}

export async function getHomeSettings(tenantDb?: string): Promise<HomeSettingsDocument | null> {
  try {
    const HomeSettingsModel = await getHomeSettingsModel(tenantDb);

    let settings = await HomeSettingsModel.findOne(
      { customerId: GLOBAL_HOME_SETTINGS_ID },
      null,
      { sort: { updatedAt: -1 } }
    ).lean<HomeSettingsDocument>();

    if (!settings) {
      const migrated = await migrateLegacyHomeSettings(GLOBAL_HOME_SETTINGS_ID, tenantDb);
      if (migrated) {
        settings = await HomeSettingsModel.findOne(
          { customerId: GLOBAL_HOME_SETTINGS_ID },
          null,
          { sort: { updatedAt: -1 } }
        ).lean<HomeSettingsDocument>();
      }
    }

    if (!settings) {
      settings = await HomeSettingsModel.findOne({}, null, { sort: { updatedAt: -1 } }).lean<HomeSettingsDocument>();
      if (!settings) {
        const migrated = await migrateLegacyHomeSettings(undefined, tenantDb);
        if (migrated) {
          settings = await HomeSettingsModel.findOne({}, null, { sort: { updatedAt: -1 } }).lean<HomeSettingsDocument>();
        }
      }
    }

    return settings ?? null;
  } catch (error) {
    console.error("Error fetching home settings:", error);
    return null;
  }
}

type HomeSettingsUpdate = {
  branding?: Partial<CompanyBranding> | CompanyBranding;
  defaultCardVariant?: "b2b" | "horizontal" | "compact" | "detailed";
  cardStyle?: Partial<ProductCardStyle> | ProductCardStyle;
  cdn?: Partial<CDNConfiguration> | CDNConfiguration;
  cdn_credentials?: Partial<CDNCredentials> | CDNCredentials;
  smtp_settings?: Partial<SMTPSettings> | SMTPSettings;
  company_info?: Partial<CompanyContactInfo> | CompanyContactInfo;
  footerHtml?: string;
  footerHtmlDraft?: string;
  headerConfig?: HeaderConfig;
  headerConfigDraft?: HeaderConfig;
  meta_tags?: Partial<MetaTags> | MetaTags;
  lastModifiedBy?: string;
};

export async function upsertHomeSettings(
  data: HomeSettingsUpdate,
  tenantDb?: string
): Promise<HomeSettingsDocument | null> {
  try {
    const HomeSettingsModel = await getHomeSettingsModel(tenantDb);

    // Check if document exists
    const existingDoc = await HomeSettingsModel.findOne(
      { customerId: GLOBAL_HOME_SETTINGS_ID }
    ).lean();

    // Try legacy migration if no document
    if (!existingDoc) {
      await migrateLegacyHomeSettings(GLOBAL_HOME_SETTINGS_ID, tenantDb);
    }

    // Re-check after migration attempt
    const docExists = existingDoc || await HomeSettingsModel.exists(
      { customerId: GLOBAL_HOME_SETTINGS_ID }
    );

    if (docExists) {
      // UPDATE: Use dot notation for partial updates
      const updateFields: Record<string, any> = {};

      if (data.branding) {
        const brandingUpdate = data.branding as Partial<CompanyBranding>;
        Object.entries(brandingUpdate).forEach(([key, value]) => {
          if (value !== undefined) {
            updateFields[`branding.${key}`] = value;
          }
        });
      }

      if (data.cardStyle) {
        const cardStyleUpdate = data.cardStyle as Partial<ProductCardStyle>;
        Object.entries(cardStyleUpdate).forEach(([key, value]) => {
          if (value !== undefined) {
            updateFields[`cardStyle.${key}`] = value;
          }
        });
      }

      if (data.cdn) {
        const cdnUpdate = data.cdn as Partial<CDNConfiguration>;
        Object.entries(cdnUpdate).forEach(([key, value]) => {
          if (value !== undefined) {
            updateFields[`cdn.${key}`] = value;
          }
        });
      }

      if (data.cdn_credentials) {
        const cdnCredsUpdate = data.cdn_credentials as Partial<CDNCredentials>;
        Object.entries(cdnCredsUpdate).forEach(([key, value]) => {
          if (value !== undefined) {
            updateFields[`cdn_credentials.${key}`] = value;
          }
        });
      }

      if (data.smtp_settings) {
        const smtpUpdate = data.smtp_settings as Partial<SMTPSettings>;
        Object.entries(smtpUpdate).forEach(([key, value]) => {
          if (value !== undefined) {
            updateFields[`smtp_settings.${key}`] = value;
          }
        });
      }

      if (data.company_info) {
        const companyInfoUpdate = data.company_info as Partial<CompanyContactInfo>;
        Object.entries(companyInfoUpdate).forEach(([key, value]) => {
          if (value !== undefined) {
            updateFields[`company_info.${key}`] = value;
          }
        });
      }

      if (data.defaultCardVariant) {
        updateFields.defaultCardVariant = data.defaultCardVariant;
      }

      if (data.footerHtml !== undefined) {
        updateFields.footerHtml = data.footerHtml;
      }

      if (data.footerHtmlDraft !== undefined) {
        updateFields.footerHtmlDraft = data.footerHtmlDraft;
      }

      // HeaderConfig is replaced as a whole (complex nested structure)
      if (data.headerConfig !== undefined) {
        updateFields.headerConfig = data.headerConfig;
      }

      // HeaderConfigDraft is replaced as a whole (complex nested structure)
      if (data.headerConfigDraft !== undefined) {
        updateFields.headerConfigDraft = data.headerConfigDraft;
      }

      // MetaTags - partial update using dot notation
      if (data.meta_tags) {
        const metaTagsUpdate = data.meta_tags as Partial<MetaTags>;
        Object.entries(metaTagsUpdate).forEach(([key, value]) => {
          if (value !== undefined) {
            updateFields[`meta_tags.${key}`] = value;
          }
        });
      }

      if (data.lastModifiedBy) {
        updateFields.lastModifiedBy = data.lastModifiedBy;
      }

      const result = await HomeSettingsModel.findOneAndUpdate(
        { customerId: GLOBAL_HOME_SETTINGS_ID },
        { $set: updateFields },
        { new: true, runValidators: true }
      ).lean<HomeSettingsDocument>();

      return result;
    } else {
      // INSERT: Create new document with full objects
      const newDoc = await HomeSettingsModel.create({
        customerId: GLOBAL_HOME_SETTINGS_ID,
        branding: mergeBranding(undefined, data.branding as Partial<CompanyBranding>),
        defaultCardVariant: data.defaultCardVariant ?? "b2b",
        cardStyle: mergeCardStyle(undefined, data.cardStyle as Partial<ProductCardStyle>),
        cdn: data.cdn,
        cdn_credentials: data.cdn_credentials,
        smtp_settings: data.smtp_settings,
        footerHtml: data.footerHtml,
        footerHtmlDraft: data.footerHtmlDraft,
        headerConfig: data.headerConfig ?? DEFAULT_HEADER_CONFIG,
        headerConfigDraft: data.headerConfigDraft ?? data.headerConfig ?? DEFAULT_HEADER_CONFIG,
        meta_tags: data.meta_tags,
        lastModifiedBy: data.lastModifiedBy
      });

      return newDoc.toObject() as HomeSettingsDocument;
    }
  } catch (error) {
    console.error("Error upserting home settings:", error);
    return null;
  }
}

export async function updateBranding(
  branding: Partial<CompanyBranding>,
  lastModifiedBy?: string,
  tenantDb?: string
): Promise<HomeSettingsDocument | null> {
  return upsertHomeSettings({ branding, lastModifiedBy }, tenantDb);
}

export async function updateCardStyle(
  cardStyle: Partial<ProductCardStyle>,
  lastModifiedBy?: string,
  tenantDb?: string
): Promise<HomeSettingsDocument | null> {
  return upsertHomeSettings({ cardStyle, lastModifiedBy }, tenantDb);
}

export async function updateCardVariant(
  variant: "b2b" | "horizontal" | "compact" | "detailed",
  lastModifiedBy?: string,
  tenantDb?: string
): Promise<HomeSettingsDocument | null> {
  return upsertHomeSettings({ defaultCardVariant: variant, lastModifiedBy }, tenantDb);
}

export async function initializeHomeSettings(
  companyTitle: string,
  tenantDb?: string
): Promise<HomeSettingsDocument | null> {
  return upsertHomeSettings({
    branding: { title: companyTitle },
    defaultCardVariant: "b2b",
    cardStyle: DEFAULT_CARD_STYLE
  }, tenantDb);
}

export async function deleteHomeSettings(tenantDb?: string): Promise<boolean> {
  try {
    const HomeSettingsModel = await getHomeSettingsModel(tenantDb);
    await HomeSettingsModel.deleteMany({});
    return true;
  } catch (error) {
    console.error("Error deleting home settings:", error);
    return false;
  }
}

export async function updateCDNConfiguration(
  cdn: Partial<CDNConfiguration>,
  lastModifiedBy?: string,
  tenantDb?: string
): Promise<HomeSettingsDocument | null> {
  return upsertHomeSettings({ cdn, lastModifiedBy }, tenantDb);
}

/**
 * Update CDN credentials for file uploads
 */
export async function updateCDNCredentials(
  cdn_credentials: Partial<CDNCredentials>,
  lastModifiedBy?: string,
  tenantDb?: string
): Promise<HomeSettingsDocument | null> {
  return upsertHomeSettings({ cdn_credentials, lastModifiedBy }, tenantDb);
}

/**
 * Update header configuration
 */
export async function updateHeaderConfig(
  headerConfig: HeaderConfig,
  lastModifiedBy?: string,
  tenantDb?: string
): Promise<HomeSettingsDocument | null> {
  return upsertHomeSettings({ headerConfig, lastModifiedBy }, tenantDb);
}

/**
 * Get CDN credentials from database
 */
export async function getCDNCredentials(tenantDb?: string): Promise<CDNCredentials | null> {
  try {
    const settings = await getHomeSettings(tenantDb);
    return settings?.cdn_credentials ?? null;
  } catch (error) {
    console.error("Error fetching CDN credentials:", error);
    return null;
  }
}

/**
 * Get CDN base URL from database settings
 * @returns CDN base URL or empty string if not configured
 */
export async function getCDNBaseUrl(tenantDb?: string): Promise<string> {
  try {
    const settings = await getHomeSettings(tenantDb);

    // Check if CDN is configured and enabled in database
    if (settings?.cdn?.enabled && settings.cdn.baseUrl) {
      return settings.cdn.baseUrl;
    }

    // Build URL from cdn_credentials if available
    const creds = settings?.cdn_credentials;
    if (creds?.cdn_url && creds?.bucket_name) {
      const normalizedEndpoint = creds.cdn_url.replace(/\/+$/, '');
      return `${normalizedEndpoint}/${creds.bucket_name}`;
    }

    return '';
  } catch (error) {
    console.error("Error fetching CDN base URL:", error);
    return '';
  }
}

/**
 * Construct full CDN URL from relative path
 * @param relativePath - Relative path (e.g., /product_images/10076/main_image.jpg)
 * @returns Full CDN URL or relative path if CDN not configured
 */
export async function constructCDNUrl(relativePath?: string, tenantDb?: string): Promise<string> {
  if (!relativePath) {
    return '';
  }

  const baseUrl = await getCDNBaseUrl(tenantDb);
  if (!baseUrl) {
    return relativePath;
  }

  // Ensure relative path starts with /
  const normalizedPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;

  return `${baseUrl}${normalizedPath}`;
}
