/**
 * Model Registry for Connection Pool
 *
 * Provides tenant-specific models using pooled connections.
 * Models are registered per-connection, enabling true multi-tenant concurrency.
 */

import mongoose from "mongoose";
import { getPooledConnection } from "./connection-pool";

// Import all schemas
import { PIMProductSchema } from "./models/pim-product";
import { CustomerSchema } from "./models/customer";
import { OrderSchema } from "./models/order";
import { APIKeySchema } from "./models/api-key";
import { B2BUserSchema } from "./models/b2b-user";
import { ImportJobSchema } from "./models/import-job";
import { LanguageSchema } from "./models/language";
import { BrandSchema } from "./models/brand";
import { CategorySchema } from "./models/category";
import { TagSchema } from "./models/tag";
import { CollectionSchema } from "./models/collection";
import { ActivityLogSchema } from "./models/activity-log";
import { B2BProductSchema } from "./models/b2b-product";
import { MenuItemSchema } from "./models/menu";
import { ProductTypeSchema } from "./models/product-type";
import { TechnicalSpecificationSchema } from "./models/technical-specification";
import { PageSchema } from "./models/page";
import { HomeSettingsSchema } from "./models/home-settings";
import { HomeTemplateSchema } from "./models/home-template";
import { ProductTemplateSchema } from "./models/product-template";
import { ProductTemplateSimpleSchema } from "./models/product-template-simple";
import { SynonymDictionarySchema } from "./models/synonym-dictionary";
import { PortalUserSchema } from "./models/portal-user";
import { CounterSchema } from "./models/counter";
import { ImportSourceSchema } from "./models/import-source";
import { AssociationJobSchema } from "./models/association-job";
import { UOMSchema } from "./models/uom";
import { EmailLogSchema } from "./models/email-log";
import { ProductCorrelationSchema } from "./models/product-correlation";
import { MobileHomeConfigSchema } from "./models/mobile-home-config";
import { NotificationTemplateSchema } from "./models/notification-template";
import { EmailComponentSchema } from "./models/email-component";
import { PushSubscriptionSchema } from "./models/push-subscription";
import { FCMTokenSchema } from "./models/fcm-token";
import { NotificationSchema } from "./models/notification";
import { CampaignSchema } from "./models/campaign";
import { UserTagSchema } from "./models/user-tag";
import { CustomerTagSchema } from "./models/customer-tag";
import { ThreadSchema } from "./models/thread";
import { B2CStorefrontSchema } from "./models/b2c-storefront";
import { ShippingConfigSchema } from "./models/shipping-config";
import { DepartureSchema } from "./models/departure";
import { BookingSchema } from "./models/booking";
import { ProductLikeSchema, LikeStatsSchema } from "./models/product-like";
import { ProductReminderSchema } from "./models/product-reminder";
import { DocumentSchema } from "./models/document";
import { DocumentTemplateSchema } from "./models/document-template";
import { DocumentSettingsSchema } from "./models/document-settings";
import { PaymentTransactionSchema } from "./models/payment-transaction";
import { TenantPaymentConfigSchema } from "./models/tenant-payment-config";
import { RecurringContractSchema } from "./models/recurring-contract";
import { SalesChannelSchema } from "./models/sales-channel";
import { BatchSyncLogSchema } from "./models/batch-sync-log";
import { B2CPageSchema } from "./models/b2c-page";
import { FormSubmissionSchema } from "./models/form-submission";
import { FormDefinitionSchema } from "./models/form-definition";
import { B2CSitemapSchema } from "./models/b2c-sitemap";
import { CouponSchema } from "./models/coupon";
import { TenantPricingConfigSchema } from "./models/tenant-pricing-config";
import { PricingRequestLogSchema } from "./models/pricing-request-log";
import { B2BPortalSchema } from "./models/b2b-portal";
import { B2BPageSchema } from "./models/b2b-page";
import { B2BSitemapSchema } from "./models/b2b-sitemap";
import { B2BFormDefinitionSchema } from "./models/b2b-form-definition";
import { B2BFormSubmissionSchema } from "./models/b2b-form-submission";
import { BlogPostSchema } from "./models/blog-post";
import { BlogPostVersionSchema } from "./models/blog-post-version";
import { BlogCategorySchema } from "./models/blog-category";
import { BlogTagSchema } from "./models/blog-tag";
import {
  DataModelDefinitionSchema,
  type IDataModelDefinition,
  type DataModelField,
} from "./models/data-model-definition";
import { RoleSchema } from "./models/role";

// Model name to schema mapping
const MODEL_SCHEMAS: Record<string, mongoose.Schema> = {
  PIMProduct: PIMProductSchema,
  Customer: CustomerSchema,
  Order: OrderSchema,
  APIKey: APIKeySchema,
  B2BUser: B2BUserSchema,
  Role: RoleSchema,
  ImportJob: ImportJobSchema,
  Language: LanguageSchema,
  Brand: BrandSchema,
  Category: CategorySchema,
  Tag: TagSchema,
  Collection: CollectionSchema,
  ActivityLog: ActivityLogSchema,
  B2BProduct: B2BProductSchema,
  MenuItem: MenuItemSchema,
  ProductType: ProductTypeSchema,
  TechnicalSpecification: TechnicalSpecificationSchema,
  Page: PageSchema,
  HomeSettings: HomeSettingsSchema,
  HomeTemplate: HomeTemplateSchema,
  ProductTemplate: ProductTemplateSchema,
  ProductTemplateSimple: ProductTemplateSimpleSchema,
  SynonymDictionary: SynonymDictionarySchema,
  PortalUser: PortalUserSchema,
  Counter: CounterSchema,
  ImportSource: ImportSourceSchema,
  AssociationJob: AssociationJobSchema,
  UOM: UOMSchema,
  EmailLog: EmailLogSchema,
  ProductCorrelation: ProductCorrelationSchema,
  MobileHomeConfig: MobileHomeConfigSchema,
  NotificationTemplate: NotificationTemplateSchema,
  EmailComponent: EmailComponentSchema,
  PushSubscription: PushSubscriptionSchema,
  FCMToken: FCMTokenSchema,
  Notification: NotificationSchema,
  Campaign: CampaignSchema,
  UserTag: UserTagSchema,
  CustomerTag: CustomerTagSchema,
  Thread: ThreadSchema,
  B2CStorefront: B2CStorefrontSchema,
  ShippingConfig: ShippingConfigSchema,
  Departure: DepartureSchema,
  Booking: BookingSchema,
  ProductLike: ProductLikeSchema,
  LikeStats: LikeStatsSchema,
  ProductReminder: ProductReminderSchema,
  Document: DocumentSchema,
  DocumentTemplate: DocumentTemplateSchema,
  DocumentSettings: DocumentSettingsSchema,
  PaymentTransaction: PaymentTransactionSchema,
  TenantPaymentConfig: TenantPaymentConfigSchema,
  RecurringContract: RecurringContractSchema,
  SalesChannel: SalesChannelSchema,
  BatchSyncLog: BatchSyncLogSchema,
  B2CPage: B2CPageSchema,
  FormSubmission: FormSubmissionSchema,
  FormDefinition: FormDefinitionSchema,
  B2CSitemap: B2CSitemapSchema,
  Coupon: CouponSchema,
  TenantPricingConfig: TenantPricingConfigSchema,
  PricingRequestLog: PricingRequestLogSchema,
  B2BPortal: B2BPortalSchema,
  B2BPage: B2BPageSchema,
  B2BSitemap: B2BSitemapSchema,
  B2BFormDefinition: B2BFormDefinitionSchema,
  B2BFormSubmission: B2BFormSubmissionSchema,
  BlogPost: BlogPostSchema,
  BlogPostVersion: BlogPostVersionSchema,
  BlogCategory: BlogCategorySchema,
  BlogTag: BlogTagSchema,
  DataModelDefinition: DataModelDefinitionSchema,
};

/**
 * Get a model for a specific tenant database from the connection pool.
 * Models are cached per connection.
 *
 * @param dbName - Tenant database name (e.g., "vinc-hidros-it")
 * @param modelName - Model name (e.g., "PIMProduct", "Customer")
 * @returns Mongoose model bound to the tenant's connection
 */
export async function getModel<T extends mongoose.Document>(
  dbName: string,
  modelName: string
): Promise<mongoose.Model<T>> {
  const connection = await getPooledConnection(dbName);

  // Return existing model if already registered
  if (connection.models[modelName]) {
    return connection.models[modelName] as mongoose.Model<T>;
  }

  // Get schema and register model
  const schema = MODEL_SCHEMAS[modelName];
  if (!schema) {
    throw new Error(`Unknown model: ${modelName}. Add it to MODEL_SCHEMAS in model-registry.ts`);
  }

  return connection.model<T>(modelName, schema);
}

/**
 * Helper to get common models for a tenant.
 * Returns an object with all registered models for the tenant.
 */
export async function getTenantModels(dbName: string) {
  const connection = await getPooledConnection(dbName);

  // Register all models on this connection if not already done
  for (const [name, schema] of Object.entries(MODEL_SCHEMAS)) {
    if (!connection.models[name]) {
      connection.model(name, schema);
    }
  }

  return {
    PIMProduct: connection.models.PIMProduct,
    Customer: connection.models.Customer,
    Order: connection.models.Order,
    APIKey: connection.models.APIKey,
    B2BUser: connection.models.B2BUser,
    Role: connection.models.Role,
    ImportJob: connection.models.ImportJob,
    Language: connection.models.Language,
    Brand: connection.models.Brand,
    Category: connection.models.Category,
    Tag: connection.models.Tag,
    Collection: connection.models.Collection,
    ActivityLog: connection.models.ActivityLog,
    B2BProduct: connection.models.B2BProduct,
    MenuItem: connection.models.MenuItem,
    ProductType: connection.models.ProductType,
    TechnicalSpecification: connection.models.TechnicalSpecification,
    Page: connection.models.Page,
    HomeSettings: connection.models.HomeSettings,
    HomeTemplate: connection.models.HomeTemplate,
    ProductTemplate: connection.models.ProductTemplate,
    ProductTemplateSimple: connection.models.ProductTemplateSimple,
    SynonymDictionary: connection.models.SynonymDictionary,
    PortalUser: connection.models.PortalUser,
    Counter: connection.models.Counter,
    ImportSource: connection.models.ImportSource,
    AssociationJob: connection.models.AssociationJob,
    UOM: connection.models.UOM,
    EmailLog: connection.models.EmailLog,
    ProductCorrelation: connection.models.ProductCorrelation,
    MobileHomeConfig: connection.models.MobileHomeConfig,
    NotificationTemplate: connection.models.NotificationTemplate,
    EmailComponent: connection.models.EmailComponent,
    PushSubscription: connection.models.PushSubscription,
    FCMToken: connection.models.FCMToken,
    Notification: connection.models.Notification,
    Campaign: connection.models.Campaign,
    UserTag: connection.models.UserTag,
    CustomerTag: connection.models.CustomerTag,
    Thread: connection.models.Thread,
    B2CStorefront: connection.models.B2CStorefront,
    ShippingConfig: connection.models.ShippingConfig,
    Departure: connection.models.Departure,
    Booking: connection.models.Booking,
    ProductLike: connection.models.ProductLike,
    LikeStats: connection.models.LikeStats,
    ProductReminder: connection.models.ProductReminder,
    Document: connection.models.Document,
    DocumentTemplate: connection.models.DocumentTemplate,
    DocumentSettings: connection.models.DocumentSettings,
    PaymentTransaction: connection.models.PaymentTransaction,
    TenantPaymentConfig: connection.models.TenantPaymentConfig,
    RecurringContract: connection.models.RecurringContract,
    SalesChannel: connection.models.SalesChannel,
    BatchSyncLog: connection.models.BatchSyncLog,
    B2CPage: connection.models.B2CPage,
    FormSubmission: connection.models.FormSubmission,
    FormDefinition: connection.models.FormDefinition,
    B2CSitemap: connection.models.B2CSitemap,
    Coupon: connection.models.Coupon,
    TenantPricingConfig: connection.models.TenantPricingConfig,
    PricingRequestLog: connection.models.PricingRequestLog,
    B2BPortal: connection.models.B2BPortal,
    B2BPage: connection.models.B2BPage,
    B2BSitemap: connection.models.B2BSitemap,
    B2BFormDefinition: connection.models.B2BFormDefinition,
    B2BFormSubmission: connection.models.B2BFormSubmission,
    BlogPost: connection.models.BlogPost,
    BlogPostVersion: connection.models.BlogPostVersion,
    BlogCategory: connection.models.BlogCategory,
    BlogTag: connection.models.BlogTag,
    DataModelDefinition: connection.models.DataModelDefinition,
  };
}

/**
 * Synchronous model registry getter for use with an existing connection.
 * Use this when you already have a connection and need to get models.
 */
export function getModelRegistry(connection: mongoose.Connection) {
  // Register all models on this connection if not already done
  for (const [name, schema] of Object.entries(MODEL_SCHEMAS)) {
    if (!connection.models[name]) {
      connection.model(name, schema);
    }
  }

  return {
    PIMProduct: connection.models.PIMProduct,
    Customer: connection.models.Customer,
    Order: connection.models.Order,
    APIKey: connection.models.APIKey,
    B2BUser: connection.models.B2BUser,
    Role: connection.models.Role,
    ImportJob: connection.models.ImportJob,
    Language: connection.models.Language,
    Brand: connection.models.Brand,
    Category: connection.models.Category,
    Tag: connection.models.Tag,
    Collection: connection.models.Collection,
    ActivityLog: connection.models.ActivityLog,
    B2BProduct: connection.models.B2BProduct,
    MenuItem: connection.models.MenuItem,
    ProductType: connection.models.ProductType,
    TechnicalSpecification: connection.models.TechnicalSpecification,
    Page: connection.models.Page,
    HomeSettings: connection.models.HomeSettings,
    HomeTemplate: connection.models.HomeTemplate,
    ProductTemplate: connection.models.ProductTemplate,
    ProductTemplateSimple: connection.models.ProductTemplateSimple,
    SynonymDictionary: connection.models.SynonymDictionary,
    PortalUser: connection.models.PortalUser,
    Counter: connection.models.Counter,
    ImportSource: connection.models.ImportSource,
    AssociationJob: connection.models.AssociationJob,
    UOM: connection.models.UOM,
    EmailLog: connection.models.EmailLog,
    ProductCorrelation: connection.models.ProductCorrelation,
    MobileHomeConfig: connection.models.MobileHomeConfig,
    NotificationTemplate: connection.models.NotificationTemplate,
    EmailComponent: connection.models.EmailComponent,
    PushSubscription: connection.models.PushSubscription,
    FCMToken: connection.models.FCMToken,
    Notification: connection.models.Notification,
    Campaign: connection.models.Campaign,
    UserTag: connection.models.UserTag,
    CustomerTag: connection.models.CustomerTag,
    Thread: connection.models.Thread,
    B2CStorefront: connection.models.B2CStorefront,
    ShippingConfig: connection.models.ShippingConfig,
    Departure: connection.models.Departure,
    Booking: connection.models.Booking,
    ProductLike: connection.models.ProductLike,
    LikeStats: connection.models.LikeStats,
    ProductReminder: connection.models.ProductReminder,
    PaymentTransaction: connection.models.PaymentTransaction,
    TenantPaymentConfig: connection.models.TenantPaymentConfig,
    RecurringContract: connection.models.RecurringContract,
    SalesChannel: connection.models.SalesChannel,
    BatchSyncLog: connection.models.BatchSyncLog,
    B2CPage: connection.models.B2CPage,
    FormSubmission: connection.models.FormSubmission,
    FormDefinition: connection.models.FormDefinition,
    B2CSitemap: connection.models.B2CSitemap,
    Coupon: connection.models.Coupon,
    TenantPricingConfig: connection.models.TenantPricingConfig,
    PricingRequestLog: connection.models.PricingRequestLog,
    B2BPortal: connection.models.B2BPortal,
    B2BPage: connection.models.B2BPage,
    B2BSitemap: connection.models.B2BSitemap,
    B2BFormDefinition: connection.models.B2BFormDefinition,
    B2BFormSubmission: connection.models.B2BFormSubmission,
    BlogPost: connection.models.BlogPost,
    BlogPostVersion: connection.models.BlogPostVersion,
    BlogCategory: connection.models.BlogCategory,
    BlogTag: connection.models.BlogTag,
    DataModelDefinition: connection.models.DataModelDefinition,
  };
}

/**
 * Convenience function to connect and get models in one call.
 * Use this in route handlers.
 *
 * @example
 * const { PIMProduct, Customer } = await connectWithModels("vinc-hidros-it");
 * const products = await PIMProduct.find({ status: "published" });
 */
export async function connectWithModels(dbName: string) {
  return getTenantModels(dbName);
}

/**
 * Resolve (and lazily register) the dynamic Mongoose model that stores records
 * for a given DataModelDefinition. Each definition has its own physical
 * collection `dyn_<slug>` in the tenant DB.
 *
 * Indexes are derived from the definition shape:
 *   - {relation_id, channel, _id desc}     — list-by-user, newest first
 *   - {relation_id, channel} unique        — only when cardinality === "single"
 *   - {relation_id, channel, external_ref} unique partial — only when external_ref_field set
 *   - {`data.<slug>`} ascending            — one per filterable: true field (top-level only)
 */
export async function getDataModelRecordModel(
  dbName: string,
  definition: Pick<
    IDataModelDefinition,
    "slug" | "cardinality" | "fields" | "external_ref_field"
  >
): Promise<mongoose.Model<mongoose.Document>> {
  const connection = await getPooledConnection(dbName);
  const modelName = `DynRecord_${definition.slug}`;
  if (connection.models[modelName]) {
    return connection.models[modelName] as mongoose.Model<mongoose.Document>;
  }

  const schema = new mongoose.Schema(
    {
      relation_id: { type: String, required: true },
      channel: { type: String, required: true },
      external_ref: { type: String },
      data: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
      source: { type: String },
      imported_at: { type: Date },
    },
    {
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      collection: `dyn_${definition.slug}`,
      strict: false,
    }
  );

  schema.index({ relation_id: 1, channel: 1, _id: -1 });

  if (definition.cardinality === "single") {
    schema.index({ relation_id: 1, channel: 1 }, { unique: true });
  }

  if (definition.external_ref_field) {
    schema.index(
      { relation_id: 1, channel: 1, external_ref: 1 },
      {
        unique: true,
        partialFilterExpression: { external_ref: { $exists: true, $type: "string" } },
      }
    );
  }

  for (const f of (definition.fields ?? []) as DataModelField[]) {
    if (f.filterable) {
      schema.index({ [`data.${f.slug}`]: 1 });
    }
  }

  return connection.model(modelName, schema);
}
