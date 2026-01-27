/**
 * Notification Template Service
 *
 * CRUD operations for notification templates.
 */

import { connectWithModels } from "@/lib/db/connection";
import type {
  INotificationTemplate,
  INotificationTemplateDocument,
  NotificationTrigger,
  INotificationChannels,
  TemplateType,
  ITemplateChannels,
  ITemplateProduct,
} from "@/lib/db/models/notification-template";

import {
  generateProductPayload,
  generateGenericPayload,
} from "./seed-campaign-templates";

// ============================================
// TYPES
// ============================================

export interface CreateTemplateInput {
  template_id: string;
  name: string;
  description?: string;
  trigger: NotificationTrigger;
  channels?: INotificationChannels;
  variables?: string[];
  is_active?: boolean;
  created_by?: string;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  trigger?: NotificationTrigger;
  channels?: INotificationChannels;
  variables?: string[];
  header_id?: string;
  footer_id?: string;
  use_default_header?: boolean;
  use_default_footer?: boolean;
  is_active?: boolean;
  updated_by?: string;
}

export interface ListTemplatesOptions {
  page?: number;
  limit?: number;
  trigger?: NotificationTrigger;
  is_active?: boolean;
  is_default?: boolean;
  search?: string;
}

export interface ListTemplatesResult {
  templates: INotificationTemplateDocument[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * List templates with pagination and filtering.
 */
export async function listTemplates(
  tenantDb: string,
  options: ListTemplatesOptions = {}
): Promise<ListTemplatesResult> {
  const { NotificationTemplate } = await connectWithModels(tenantDb);

  const page = options.page || 1;
  const limit = options.limit || 20;
  const skip = (page - 1) * limit;

  // Build query
  const query: Record<string, unknown> = {};

  if (options.trigger) {
    query.trigger = options.trigger;
  }

  if (options.is_active !== undefined) {
    query.is_active = options.is_active;
  }

  if (options.is_default !== undefined) {
    query.is_default = options.is_default;
  }

  if (options.search) {
    query.$or = [
      { name: { $regex: options.search, $options: "i" } },
      { description: { $regex: options.search, $options: "i" } },
      { template_id: { $regex: options.search, $options: "i" } }
    ];
  }

  const [templates, total] = await Promise.all([
    NotificationTemplate.find(query)
      .sort({ is_default: -1, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean<INotificationTemplateDocument[]>(),
    NotificationTemplate.countDocuments(query)
  ]);

  return {
    templates,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get a template by ID.
 */
export async function getTemplate(
  tenantDb: string,
  templateId: string
): Promise<INotificationTemplateDocument | null> {
  const { NotificationTemplate } = await connectWithModels(tenantDb);
  return NotificationTemplate.findOne({ template_id: templateId }).lean<INotificationTemplateDocument>();
}

/**
 * Get a template by trigger (returns the active one).
 */
export async function getTemplateByTrigger(
  tenantDb: string,
  trigger: NotificationTrigger
): Promise<INotificationTemplateDocument | null> {
  const { NotificationTemplate } = await connectWithModels(tenantDb);
  return NotificationTemplate.findOne({
    trigger,
    is_active: true
  }).lean<INotificationTemplateDocument>();
}

/**
 * Create a new template.
 */
export async function createTemplate(
  tenantDb: string,
  input: CreateTemplateInput
): Promise<INotificationTemplateDocument> {
  const { NotificationTemplate } = await connectWithModels(tenantDb);

  // Check for duplicate template_id
  const existing = await NotificationTemplate.findOne({
    template_id: input.template_id
  });

  if (existing) {
    throw new Error(`Template with ID "${input.template_id}" already exists`);
  }

  const template = await NotificationTemplate.create({
    template_id: input.template_id.toLowerCase().replace(/[^a-z0-9_-]/g, "_"),
    name: input.name,
    description: input.description,
    trigger: input.trigger,
    channels: input.channels || {},
    variables: input.variables || [],
    is_active: input.is_active ?? true,
    is_default: false,
    created_by: input.created_by
  });

  return template.toObject() as INotificationTemplateDocument;
}

/**
 * Update an existing template.
 */
export async function updateTemplate(
  tenantDb: string,
  templateId: string,
  input: UpdateTemplateInput
): Promise<INotificationTemplateDocument | null> {
  const { NotificationTemplate } = await connectWithModels(tenantDb);

  const updateFields: Record<string, unknown> = {};

  if (input.name !== undefined) {
    updateFields.name = input.name;
  }

  if (input.description !== undefined) {
    updateFields.description = input.description;
  }

  if (input.trigger !== undefined) {
    updateFields.trigger = input.trigger;
  }

  if (input.channels !== undefined) {
    // Update channels object entirely
    updateFields.channels = input.channels;
  }

  if (input.variables !== undefined) {
    updateFields.variables = input.variables;
  }

  if (input.is_active !== undefined) {
    updateFields.is_active = input.is_active;
  }

  // Header/Footer settings
  if (input.header_id !== undefined) {
    updateFields.header_id = input.header_id || null;
  }

  if (input.footer_id !== undefined) {
    updateFields.footer_id = input.footer_id || null;
  }

  if (input.use_default_header !== undefined) {
    updateFields.use_default_header = input.use_default_header;
  }

  if (input.use_default_footer !== undefined) {
    updateFields.use_default_footer = input.use_default_footer;
  }

  if (input.updated_by) {
    updateFields.updated_by = input.updated_by;
  }

  const result = await NotificationTemplate.findOneAndUpdate(
    { template_id: templateId },
    { $set: updateFields },
    { new: true, runValidators: true }
  ).lean<INotificationTemplateDocument>();

  return result;
}

/**
 * Delete a template.
 * Default templates cannot be deleted, only deactivated.
 */
export async function deleteTemplate(
  tenantDb: string,
  templateId: string
): Promise<{ success: boolean; error?: string }> {
  const { NotificationTemplate } = await connectWithModels(tenantDb);

  const template = await NotificationTemplate.findOne({ template_id: templateId });

  if (!template) {
    return { success: false, error: "Template not found" };
  }

  if (template.is_default) {
    return {
      success: false,
      error: "Default templates cannot be deleted. You can deactivate them instead."
    };
  }

  await NotificationTemplate.deleteOne({ template_id: templateId });
  return { success: true };
}

/**
 * Toggle template active status.
 */
export async function toggleTemplateActive(
  tenantDb: string,
  templateId: string
): Promise<INotificationTemplateDocument | null> {
  const { NotificationTemplate } = await connectWithModels(tenantDb);

  const template = await NotificationTemplate.findOne({ template_id: templateId });

  if (!template) {
    return null;
  }

  template.is_active = !template.is_active;
  await template.save();

  return template.toObject() as INotificationTemplateDocument;
}

/**
 * Duplicate a template.
 */
export async function duplicateTemplate(
  tenantDb: string,
  templateId: string,
  newTemplateId: string,
  newName: string,
  createdBy?: string
): Promise<INotificationTemplateDocument> {
  const { NotificationTemplate } = await connectWithModels(tenantDb);

  const source = await NotificationTemplate.findOne({ template_id: templateId });

  if (!source) {
    throw new Error(`Source template "${templateId}" not found`);
  }

  // Check for duplicate
  const existing = await NotificationTemplate.findOne({
    template_id: newTemplateId
  });

  if (existing) {
    throw new Error(`Template with ID "${newTemplateId}" already exists`);
  }

  const duplicate = await NotificationTemplate.create({
    template_id: newTemplateId.toLowerCase().replace(/[^a-z0-9_-]/g, "_"),
    name: newName,
    description: source.description,
    trigger: "custom", // Duplicates become custom
    channels: source.channels,
    variables: source.variables,
    is_active: true,
    is_default: false,
    created_by: createdBy
  });

  return duplicate.toObject() as INotificationTemplateDocument;
}

/**
 * Get available triggers for new templates.
 */
export function getAvailableTriggers(): { value: NotificationTrigger; label: string }[] {
  const { TRIGGER_LABELS } = require("@/lib/db/models/notification-template");

  return Object.entries(TRIGGER_LABELS).map(([value, label]) => ({
    value: value as NotificationTrigger,
    label: label as string
  }));
}

/**
 * Get company info from home settings for email variables.
 */
async function getCompanyInfoFromSettings(
  tenantDb: string
): Promise<Record<string, string>> {
  const { HomeSettings } = await connectWithModels(tenantDb);

  try {
    const settings = await HomeSettings.findOne({}).lean();
    if (!settings) return {};

    const companyInfo = (settings as { company_info?: Record<string, string>; branding?: { title?: string; logo?: string; primaryColor?: string; shopUrl?: string } }).company_info || {};
    const branding = (settings as { branding?: { title?: string; logo?: string; primaryColor?: string; shopUrl?: string } }).branding || {};

    // Build contact_info from phone and email
    const contactParts = [];
    if (companyInfo.phone) contactParts.push(`📞 ${companyInfo.phone}`);
    if (companyInfo.email) contactParts.push(`✉️ ${companyInfo.email}`);

    // Build address from address lines
    const addressParts = [companyInfo.address_line1, companyInfo.address_line2].filter(Boolean);

    return {
      company_name: companyInfo.legal_name || branding.title || "",
      logo: branding.logo || "",
      address: addressParts.join(", "),
      address_line1: companyInfo.address_line1 || "",
      address_line2: companyInfo.address_line2 || "",
      phone: companyInfo.phone || "",
      email: companyInfo.email || "",
      vat_number: companyInfo.vat_number || "",
      support_email: companyInfo.support_email || companyInfo.email || "",
      business_hours: companyInfo.business_hours || "",
      contact_info: contactParts.join(" | ") || "",
      primary_color: branding.primaryColor || "#009f7f",
      shop_name: branding.title || "",
      shop_url: branding.shopUrl || "",
    };
  } catch (error) {
    console.error("Error fetching company info:", error);
    return {};
  }
}

/**
 * Preview template with sample data.
 * Combines header + content + footer if configured.
 * Fetches company info from home settings for dynamic values.
 */
export async function previewTemplate(
  tenantDb: string,
  templateId: string,
  sampleData: Record<string, string>
): Promise<{ subject: string; html: string } | null> {
  const { EmailComponent } = await connectWithModels(tenantDb);
  const template = await getTemplate(tenantDb, templateId);

  if (!template || !template.channels?.email) {
    return null;
  }

  const email = template.channels.email;

  // Get company info from home settings
  const companyInfo = await getCompanyInfoFromSettings(tenantDb);

  // Get header and footer components
  let headerHtml = "";
  let footerHtml = "";

  // Get header
  if (template.use_default_header !== false) {
    // Use default header
    const defaultHeader = await EmailComponent.findOne({ type: "header", is_default: true }).lean();
    if (defaultHeader) {
      headerHtml = (defaultHeader as { html_content: string }).html_content;
    }
  } else if (template.header_id) {
    // Use specific header
    const header = await EmailComponent.findOne({ component_id: template.header_id }).lean();
    if (header) {
      headerHtml = (header as { html_content: string }).html_content;
    }
  }

  // Get footer
  if (template.use_default_footer !== false) {
    // Use default footer
    const defaultFooter = await EmailComponent.findOne({ type: "footer", is_default: true }).lean();
    if (defaultFooter) {
      footerHtml = (defaultFooter as { html_content: string }).html_content;
    }
  } else if (template.footer_id) {
    // Use specific footer
    const footer = await EmailComponent.findOne({ component_id: template.footer_id }).lean();
    if (footer) {
      footerHtml = (footer as { html_content: string }).html_content;
    }
  }

  // Replace variables with sample data
  let subject = email.subject;

  // Combine header + content + footer
  let html = "";

  // Wrap content in a container if we have header or footer
  if (headerHtml || footerHtml) {
    const contentWrapper = `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f6fa;">
  <tr>
    <td align="center" style="padding: 0 20px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff;">
        <tr>
          <td style="padding: 40px;">
            ${email.html_body}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
    `.trim();

    html = headerHtml + contentWrapper + footerHtml;
  } else {
    html = email.html_body;
  }

  // Replace all variables - priority: sampleData > companyInfo > defaults
  const allData: Record<string, string> = {
    // Defaults
    primary_color: "#009f7f",
    company_name: "Your Company",
    current_year: new Date().getFullYear().toString(),
    address: "",
    contact_info: "",
    business_hours: "",
    // From home settings
    ...companyInfo,
    // From sample/custom data (highest priority)
    ...sampleData,
  };

  for (const [key, value] of Object.entries(allData)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    subject = subject.replace(regex, value);
    html = html.replace(regex, value);
  }

  // Handle conditional blocks with else - {{#if variable}}...{{else}}...{{/if}}
  html = html.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, varName, ifContent, elseContent) => {
      const hasValue = allData[varName] && allData[varName].trim() !== "";
      return hasValue ? ifContent : elseContent;
    }
  );

  // Handle conditional blocks without else - {{#if variable}}...{{/if}}
  html = html.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, varName, content) => {
      const hasValue = allData[varName] && allData[varName].trim() !== "";
      return hasValue ? content : "";
    }
  );

  return { subject, html };
}

/**
 * Preview template with inline data (for unsaved changes).
 * Used when the frontend needs to preview changes before saving.
 */
export async function previewTemplateInline(
  tenantDb: string,
  templateData: {
    html_body: string;
    subject: string;
    use_default_header?: boolean;
    use_default_footer?: boolean;
    header_id?: string;
    footer_id?: string;
  },
  sampleData: Record<string, string>
): Promise<{ subject: string; html: string }> {
  const { EmailComponent, HomeSettings } = await connectWithModels(tenantDb);

  // Get company info from home settings
  let companyInfo: Record<string, string> = {};
  try {
    const settings = await HomeSettings.findOne({}).lean();
    if (settings) {
      const ci = (settings as { company_info?: Record<string, string>; branding?: { title?: string; logo?: string; primaryColor?: string } }).company_info || {};
      const br = (settings as { branding?: { title?: string; logo?: string; primaryColor?: string } }).branding || {};

      const contactParts = [];
      if (ci.phone) contactParts.push(`📞 ${ci.phone}`);
      if (ci.email) contactParts.push(`✉️ ${ci.email}`);

      companyInfo = {
        company_name: ci.legal_name || br.title || "",
        logo: br.logo || "",
        address: [ci.address_line1, ci.address_line2].filter(Boolean).join(", "),
        phone: ci.phone || "",
        email: ci.email || "",
        contact_info: contactParts.join(" | ") || "",
        business_hours: ci.business_hours || "",
        primary_color: br.primaryColor || "#009f7f",
      };
    }
  } catch (error) {
    console.error("Error fetching company info for preview:", error);
  }

  // Get header and footer components
  let headerHtml = "";
  let footerHtml = "";

  // Get header
  if (templateData.use_default_header !== false) {
    const defaultHeader = await EmailComponent.findOne({ type: "header", is_default: true }).lean();
    if (defaultHeader) {
      headerHtml = (defaultHeader as { html_content: string }).html_content;
    }
  } else if (templateData.header_id) {
    const header = await EmailComponent.findOne({ component_id: templateData.header_id }).lean();
    if (header) {
      headerHtml = (header as { html_content: string }).html_content;
    }
  }

  // Get footer
  if (templateData.use_default_footer !== false) {
    const defaultFooter = await EmailComponent.findOne({ type: "footer", is_default: true }).lean();
    if (defaultFooter) {
      footerHtml = (defaultFooter as { html_content: string }).html_content;
    }
  } else if (templateData.footer_id) {
    const footer = await EmailComponent.findOne({ component_id: templateData.footer_id }).lean();
    if (footer) {
      footerHtml = (footer as { html_content: string }).html_content;
    }
  }

  let subject = templateData.subject || "";
  let html = "";

  // Wrap content in a container if we have header or footer
  if (headerHtml || footerHtml) {
    const contentWrapper = `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f6fa;">
  <tr>
    <td align="center" style="padding: 0 20px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff;">
        <tr>
          <td style="padding: 40px;">
            ${templateData.html_body}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
    `.trim();

    html = headerHtml + contentWrapper + footerHtml;
  } else {
    html = templateData.html_body;
  }

  // Replace variables
  const allData: Record<string, string> = {
    primary_color: "#009f7f",
    company_name: "Your Company",
    current_year: new Date().getFullYear().toString(),
    address: "",
    contact_info: "",
    business_hours: "",
    ...companyInfo,
    ...sampleData,
  };

  for (const [key, value] of Object.entries(allData)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    subject = subject.replace(regex, value);
    html = html.replace(regex, value);
  }

  // Handle conditional blocks with else - {{#if variable}}...{{else}}...{{/if}}
  html = html.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, varName, ifContent, elseContent) => {
      const hasValue = allData[varName] && allData[varName].trim() !== "";
      return hasValue ? ifContent : elseContent;
    }
  );

  // Handle conditional blocks without else - {{#if variable}}...{{/if}}
  html = html.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, varName, content) => {
      const hasValue = allData[varName] && allData[varName].trim() !== "";
      return hasValue ? content : "";
    }
  );

  return { subject, html };
}

// ============================================
// DEFAULT HEADER/FOOTER FUNCTIONS
// ============================================

/**
 * Get the default email header component.
 */
export async function getDefaultHeader(
  tenantDb: string
): Promise<{ html_content: string } | null> {
  const { EmailComponent } = await connectWithModels(tenantDb);
  const header = await EmailComponent.findOne({ type: "header", is_default: true }).lean();
  return header as { html_content: string } | null;
}

/**
 * Get the default email footer component.
 */
export async function getDefaultFooter(
  tenantDb: string
): Promise<{ html_content: string } | null> {
  const { EmailComponent } = await connectWithModels(tenantDb);
  const footer = await EmailComponent.findOne({ type: "footer", is_default: true }).lean();
  return footer as { html_content: string } | null;
}

// ============================================
// CAMPAIGN TEMPLATE FUNCTIONS (NEW)
// ============================================

export interface ListCampaignTemplatesOptions {
  page?: number;
  limit?: number;
  type?: TemplateType;
  search?: string;
}

export interface CreateCampaignTemplateInput {
  name: string;
  type: TemplateType;
  title: string;
  body: string;
  // Product template fields
  products?: ITemplateProduct[];
  filters?: Record<string, string[]>;
  // Generic template fields
  url?: string;
  image?: string;
  open_in_new_tab?: boolean;
  // Channel toggles
  template_channels?: ITemplateChannels;
  created_by?: string;
}

export interface UpdateCampaignTemplateInput {
  name?: string;
  title?: string;
  body?: string;
  products?: ITemplateProduct[];
  filters?: Record<string, string[]>;
  url?: string;
  image?: string;
  open_in_new_tab?: boolean;
  template_channels?: ITemplateChannels;
  updated_by?: string;
}

/**
 * List campaign templates (product/generic types only).
 */
export async function listCampaignTemplates(
  tenantDb: string,
  options: ListCampaignTemplatesOptions = {}
): Promise<ListTemplatesResult> {
  const { NotificationTemplate } = await connectWithModels(tenantDb);

  const page = options.page || 1;
  const limit = options.limit || 20;
  const skip = (page - 1) * limit;

  // Only campaign templates (with type field)
  const query: Record<string, unknown> = {
    type: { $in: ["product", "generic"] }
  };

  if (options.type) {
    query.type = options.type;
  }

  if (options.search) {
    query.$or = [
      { name: { $regex: options.search, $options: "i" } },
      { title: { $regex: options.search, $options: "i" } },
      { template_id: { $regex: options.search, $options: "i" } }
    ];
  }

  const [templates, total] = await Promise.all([
    NotificationTemplate.find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean<INotificationTemplateDocument[]>(),
    NotificationTemplate.countDocuments(query)
  ]);

  return {
    templates,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Create a new campaign template.
 * Generates template_id from name automatically.
 */
export async function createCampaignTemplate(
  tenantDb: string,
  input: CreateCampaignTemplateInput
): Promise<INotificationTemplateDocument> {
  const { NotificationTemplate } = await connectWithModels(tenantDb);

  // Generate template_id from name
  const baseId = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  // Check for duplicates and add suffix if needed
  let templateId = baseId;
  let counter = 1;
  while (await NotificationTemplate.findOne({ template_id: templateId })) {
    templateId = `${baseId}-${counter}`;
    counter++;
  }

  // Determine trigger based on type
  const trigger: NotificationTrigger = input.type === "product" ? "back_in_stock" : "newsletter";

  // Default channel settings
  const defaultChannels: ITemplateChannels = {
    email: { enabled: true },
    mobile: { enabled: true },
    web_in_app: { enabled: true },
  };

  const template = await NotificationTemplate.create({
    template_id: templateId,
    name: input.name,
    type: input.type,
    trigger,
    title: input.title,
    body: input.body,
    // Product fields
    products: input.products || [],
    filters: input.filters,
    // Generic fields
    url: input.url,
    image: input.image,
    open_in_new_tab: input.open_in_new_tab ?? true,
    // Channels
    template_channels: input.template_channels || defaultChannels,
    // Header/footer for email
    use_default_header: true,
    use_default_footer: true,
    is_active: true,
    is_default: false,
    created_by: input.created_by,
  });

  return template.toObject() as INotificationTemplateDocument;
}

/**
 * Update a campaign template.
 */
export async function updateCampaignTemplate(
  tenantDb: string,
  templateId: string,
  input: UpdateCampaignTemplateInput
): Promise<INotificationTemplateDocument | null> {
  const { NotificationTemplate } = await connectWithModels(tenantDb);

  const updateFields: Record<string, unknown> = {};

  if (input.name !== undefined) updateFields.name = input.name;
  if (input.title !== undefined) updateFields.title = input.title;
  if (input.body !== undefined) updateFields.body = input.body;
  if (input.products !== undefined) updateFields.products = input.products;
  if (input.filters !== undefined) updateFields.filters = input.filters;
  if (input.url !== undefined) updateFields.url = input.url;
  if (input.image !== undefined) updateFields.image = input.image;
  if (input.open_in_new_tab !== undefined) updateFields.open_in_new_tab = input.open_in_new_tab;
  if (input.template_channels !== undefined) updateFields.template_channels = input.template_channels;
  if (input.updated_by) updateFields.updated_by = input.updated_by;

  const result = await NotificationTemplate.findOneAndUpdate(
    { template_id: templateId },
    { $set: updateFields },
    { new: true, runValidators: true }
  ).lean<INotificationTemplateDocument>();

  return result;
}

/**
 * Generate notification payload for mobile/in-app based on template type.
 */
export function generateNotificationPayload(
  template: INotificationTemplate
): ReturnType<typeof generateProductPayload> | ReturnType<typeof generateGenericPayload> {
  if (template.type === "product") {
    return generateProductPayload(
      template.products || [],
      template.filters
    );
  } else {
    return generateGenericPayload(
      template.url,
      template.image,
      template.open_in_new_tab
    );
  }
}

/**
 * Preview campaign template with all 3 channel formats.
 */
export async function previewCampaignTemplate(
  tenantDb: string,
  templateId: string
): Promise<{
  email: { subject: string; html: string } | null;
  mobile: { title: string; body: string; payload: unknown };
  web_in_app: { title: string; body: string; icon?: string; action_url?: string };
} | null> {
  const template = await getTemplate(tenantDb, templateId);

  if (!template || !template.type) {
    return null;
  }

  // Generate email preview
  let emailPreview: { subject: string; html: string } | null = null;

  if (template.template_channels?.email?.enabled) {
    // Build sample data from template
    const sampleData: Record<string, string> = {
      title: template.title,
      body: template.body,
    };

    if (template.url) sampleData.url = template.url;
    if (template.image) sampleData.image = template.image;

    // Use the new template_channels email structure
    const emailChannel = template.template_channels.email;
    if (emailChannel.html_body) {
      emailPreview = await previewTemplateInline(
        tenantDb,
        {
          html_body: emailChannel.html_body,
          subject: emailChannel.subject || template.title,
          use_default_header: template.use_default_header,
          use_default_footer: template.use_default_footer,
          header_id: template.header_id,
          footer_id: template.footer_id,
        },
        sampleData
      );
    }
  }

  // Generate mobile preview
  const payload = generateNotificationPayload(template);
  const mobilePreview = {
    title: template.title,
    body: template.body,
    payload,
  };

  // Generate web/in-app preview
  const webInAppChannel = template.template_channels?.web_in_app;
  const webInAppPreview = {
    title: template.title,
    body: template.body,
    icon: webInAppChannel?.icon,
    action_url: webInAppChannel?.action_url || template.url,
  };

  return {
    email: emailPreview,
    mobile: mobilePreview,
    web_in_app: webInAppPreview,
  };
}
