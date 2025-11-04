import { B2BHomeSettingsModel, HomeSettingsDocument } from "./models/home-settings";
import type { CompanyBranding, ProductCardStyle } from "@/lib/types/home-settings";
export { computeMediaCardStyle, computeMediaHoverDeclarations } from "@/lib/home-settings/style-utils";
import { connectToDatabase } from "./connection";

const GLOBAL_HOME_SETTINGS_ID = process.env.HOME_SETTINGS_ID?.trim() || "global-b2b-home";

const DEFAULT_BRANDING: CompanyBranding = {
  title: "B2B Store",
  primaryColor: "#009f7f",
  secondaryColor: "#02b290"
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

async function ensureConnection() {
  await connectToDatabase();
}

const migrateLegacyHomeSettings = async (customerId?: string) => {
  try {
    const db = B2BHomeSettingsModel.db;
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
    await B2BHomeSettingsModel.create(rest);
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

export async function getHomeSettings(): Promise<HomeSettingsDocument | null> {
  await ensureConnection();

  try {
    let settings = await B2BHomeSettingsModel.findOne(
      { customerId: GLOBAL_HOME_SETTINGS_ID },
      null,
      { sort: { updatedAt: -1 } }
    ).lean<HomeSettingsDocument>();

    if (!settings) {
      const migrated = await migrateLegacyHomeSettings(GLOBAL_HOME_SETTINGS_ID);
      if (migrated) {
        settings = await B2BHomeSettingsModel.findOne(
          { customerId: GLOBAL_HOME_SETTINGS_ID },
          null,
          { sort: { updatedAt: -1 } }
        ).lean<HomeSettingsDocument>();
      }
    }

    if (!settings) {
      settings = await B2BHomeSettingsModel.findOne({}, null, { sort: { updatedAt: -1 } }).lean<HomeSettingsDocument>();
      if (!settings) {
        const migrated = await migrateLegacyHomeSettings();
        if (migrated) {
          settings = await B2BHomeSettingsModel.findOne({}, null, { sort: { updatedAt: -1 } }).lean<HomeSettingsDocument>();
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
  lastModifiedBy?: string;
};

export async function upsertHomeSettings(
  data: HomeSettingsUpdate
): Promise<HomeSettingsDocument | null> {
  await ensureConnection();

  try {
    let doc = await B2BHomeSettingsModel.findOne(
      { customerId: GLOBAL_HOME_SETTINGS_ID },
      null,
      { sort: { updatedAt: -1 } }
    ).exec();

    if (!doc) {
      const migrated = await migrateLegacyHomeSettings(GLOBAL_HOME_SETTINGS_ID);
      if (migrated) {
        doc = await B2BHomeSettingsModel.findOne(
          { customerId: GLOBAL_HOME_SETTINGS_ID },
          null,
          { sort: { updatedAt: -1 } }
        ).exec();
      }
    }

    const brandingUpdate = data.branding ? { ...(data.branding as Partial<CompanyBranding>) } : undefined;
    const cardStyleUpdate = data.cardStyle ? { ...(data.cardStyle as Partial<ProductCardStyle>) } : undefined;

    if (!doc) {
      doc = new B2BHomeSettingsModel({
        customerId: GLOBAL_HOME_SETTINGS_ID,
        branding: mergeBranding(undefined, brandingUpdate),
        defaultCardVariant: data.defaultCardVariant ?? "b2b",
        cardStyle: mergeCardStyle(undefined, cardStyleUpdate),
        lastModifiedBy: data.lastModifiedBy
      });
    } else {
      if (brandingUpdate) {
        const currentBranding = typeof doc.branding?.toObject === "function" ? doc.branding.toObject() : doc.branding;
        doc.branding = mergeBranding(currentBranding, brandingUpdate);
      }
      if (cardStyleUpdate) {
        const currentCardStyle = typeof doc.cardStyle?.toObject === "function" ? doc.cardStyle.toObject() : doc.cardStyle;
        doc.cardStyle = mergeCardStyle(currentCardStyle, cardStyleUpdate);
      }
      if (data.defaultCardVariant) {
        doc.defaultCardVariant = data.defaultCardVariant;
      }
      if (data.lastModifiedBy) {
        doc.lastModifiedBy = data.lastModifiedBy;
      }
    }

    const saved = await doc.save();
    return saved.toObject() as HomeSettingsDocument;
  } catch (error) {
    console.error("Error upserting home settings:", error);
    return null;
  }
}

export async function updateBranding(
  branding: Partial<CompanyBranding>,
  lastModifiedBy?: string
): Promise<HomeSettingsDocument | null> {
  return upsertHomeSettings({ branding, lastModifiedBy });
}

export async function updateCardStyle(
  cardStyle: Partial<ProductCardStyle>,
  lastModifiedBy?: string
): Promise<HomeSettingsDocument | null> {
  return upsertHomeSettings({ cardStyle, lastModifiedBy });
}

export async function updateCardVariant(
  variant: "b2b" | "horizontal" | "compact" | "detailed",
  lastModifiedBy?: string
): Promise<HomeSettingsDocument | null> {
  return upsertHomeSettings({ defaultCardVariant: variant, lastModifiedBy });
}

export async function initializeHomeSettings(
  companyTitle: string
): Promise<HomeSettingsDocument | null> {
  return upsertHomeSettings({
    branding: { title: companyTitle },
    defaultCardVariant: "b2b",
    cardStyle: DEFAULT_CARD_STYLE
  });
}

export async function deleteHomeSettings(): Promise<boolean> {
  await ensureConnection();

  try {
    await B2BHomeSettingsModel.deleteMany({});
    return true;
  } catch (error) {
    console.error("Error deleting home settings:", error);
    return false;
  }
}
