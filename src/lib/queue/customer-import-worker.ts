/**
 * Customer Import Worker
 * Processes bulk customer import jobs from the customer-import-queue.
 *
 * Supports two merge modes:
 * - "replace": Replace all fields, addresses, and tags
 * - "partial": Deep-merge only provided fields, additive tag upsert
 *
 * Reuses existing services:
 * - upsertCustomerTagsBatch / upsertAddressTagOverridesBatch from tag-pricing.service
 * - getNextCustomerPublicCode from counter
 * - validateLegalInfo from customer model
 * - connectWithModels from connection
 */

import { Worker, Job } from "bullmq";
import { nanoid } from "nanoid";
import { connectWithModels } from "../db/connection";
import { getNextCustomerPublicCode } from "../db/models/counter";
import { validateLegalInfo } from "../db/models/customer";
import {
  upsertCustomerTagsBatch,
  upsertAddressTagOverridesBatch,
} from "../services/tag-pricing.service";

// ============================================
// TYPES (exported for tests and reuse)
// ============================================

export interface CustomerImportAddress {
  external_code?: string;
  address_type?: "delivery" | "billing" | "both";
  label?: string;
  is_default?: boolean;
  recipient_name?: string;
  street_address?: string;
  street_address_2?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
  phone?: string;
  delivery_notes?: string;
  tag_overrides?: string[];
}

export interface CustomerImportItem {
  external_code: string;
  customer_type?: "business" | "private" | "reseller";
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  legal_info?: {
    vat_number?: string;
    fiscal_code?: string;
    pec_email?: string;
    sdi_code?: string;
  };
  tags?: string[];
  addresses?: CustomerImportAddress[];
}

export interface CustomerImportJobData {
  job_id: string;
  tenant_id: string;
  merge_mode: "replace" | "partial";
  customers: CustomerImportItem[];
  batch_metadata?: {
    batch_id: string;
    batch_part: number;
    batch_total_parts: number;
    batch_total_items?: number;
  };
}

// ============================================
// HELPERS
// ============================================

/**
 * Deep merge two objects, with source values overriding target values.
 * Skips undefined/null source values. Arrays are replaced, not merged.
 */
function deepMerge(target: any, source: any): any {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (sourceValue === undefined || sourceValue === null) {
      continue;
    }

    if (
      typeof sourceValue === "object" &&
      !Array.isArray(sourceValue) &&
      !(sourceValue instanceof Date) &&
      sourceValue.constructor === Object &&
      typeof targetValue === "object" &&
      targetValue !== null &&
      !Array.isArray(targetValue) &&
      !(targetValue instanceof Date) &&
      targetValue.constructor === Object
    ) {
      result[key] = deepMerge(targetValue, sourceValue);
    } else {
      result[key] = sourceValue;
    }
  }

  return result;
}

/**
 * Build an address document from import data.
 */
function buildAddress(input: CustomerImportAddress): any {
  return {
    address_id: nanoid(8),
    external_code: input.external_code,
    address_type: input.address_type || "delivery",
    label: input.label,
    is_default: input.is_default || false,
    recipient_name: input.recipient_name || "",
    street_address: input.street_address || "",
    street_address_2: input.street_address_2,
    city: input.city || "",
    province: input.province || "",
    postal_code: input.postal_code || "",
    country: input.country || "IT",
    phone: input.phone,
    delivery_notes: input.delivery_notes,
    tag_overrides: [],
    created_at: new Date(),
    updated_at: new Date(),
  };
}

// ============================================
// CORE PROCESSOR
// ============================================

/**
 * Core processor — testable without BullMQ Job dependency.
 * Takes plain data + optional progress callback.
 */
export async function processCustomerImportData(
  data: CustomerImportJobData,
  onProgress?: (percent: number) => void,
): Promise<{ processed: number; successful: number; failed: number }> {
  const { job_id, tenant_id, merge_mode, customers, batch_metadata } = data;
  const tenantDb = `vinc-${tenant_id}`;

  console.log(`\n🔄 Processing customer import: ${job_id}`);
  console.log(`   Tenant: ${tenant_id}`);
  console.log(`   Customers: ${customers.length}`);
  console.log(`   Merge mode: ${merge_mode}`);
  if (batch_metadata) {
    console.log(`   Batch: ${batch_metadata.batch_id} (part ${batch_metadata.batch_part}/${batch_metadata.batch_total_parts})`);
  }

  const {
    Customer: CustomerModel,
    ImportJob: ImportJobModel,
  } = await connectWithModels(tenantDb);

  // Mark job as processing
  await ImportJobModel.findOneAndUpdate(
    { job_id },
    { $set: { status: "processing", started_at: new Date() } },
  );

  let processed = 0;
  let successful = 0;
  let failed = 0;
  const errors: { row: number; entity_code: string; error: string; raw_data?: any }[] = [];

  for (const customerData of customers) {
    try {
      const { external_code } = customerData;

      if (!external_code) {
        errors.push({
          row: processed + 1,
          entity_code: "",
          error: "Missing external_code",
          raw_data: customerData,
        });
        failed++;
        processed++;
        continue;
      }

      // Validate legal info if provided
      if (customerData.legal_info) {
        const validation = validateLegalInfo(customerData.legal_info);
        if (!validation.valid) {
          errors.push({
            row: processed + 1,
            entity_code: external_code,
            error: `Invalid legal info: ${validation.errors.join(", ")}`,
            raw_data: customerData,
          });
          failed++;
          processed++;
          continue;
        }
      }

      // Lookup existing customer by external_code
      const existing = await CustomerModel.findOne({
        tenant_id,
        external_code,
      });

      if (existing) {
        // ========== UPDATE EXISTING ==========
        if (merge_mode === "replace") {
          // Replace: overwrite all provided fields
          const updateDoc: Record<string, any> = {};
          const fields = [
            "customer_type", "email", "phone",
            "first_name", "last_name", "company_name", "legal_info",
          ] as const;

          for (const field of fields) {
            if (customerData[field] !== undefined) {
              updateDoc[field] = customerData[field];
            }
          }

          // Replace addresses if provided
          if (customerData.addresses && customerData.addresses.length > 0) {
            updateDoc.addresses = customerData.addresses.map(buildAddress);
          }

          if (Object.keys(updateDoc).length > 0) {
            await CustomerModel.updateOne(
              { customer_id: existing.customer_id, tenant_id },
              { $set: updateDoc },
            );
          }
        } else {
          // Partial: deep-merge only provided fields
          const existingObj = existing.toObject();
          const updateFields: Record<string, any> = {};

          // Merge simple fields
          const fields = [
            "customer_type", "email", "phone",
            "first_name", "last_name", "company_name",
          ] as const;

          for (const field of fields) {
            if (customerData[field] !== undefined && customerData[field] !== null) {
              updateFields[field] = customerData[field];
            }
          }

          // Deep merge legal_info
          if (customerData.legal_info) {
            updateFields.legal_info = deepMerge(
              existingObj.legal_info || {},
              customerData.legal_info,
            );
          }

          // Merge addresses: match by external_code, create new ones
          if (customerData.addresses && customerData.addresses.length > 0) {
            const existingAddresses = [...(existingObj.addresses || [])];

            for (const addrInput of customerData.addresses) {
              if (addrInput.external_code) {
                const idx = existingAddresses.findIndex(
                  (a: any) => a.external_code === addrInput.external_code,
                );
                if (idx !== -1) {
                  // Update existing address (merge fields)
                  const merged = deepMerge(existingAddresses[idx], addrInput);
                  merged.updated_at = new Date();
                  // Preserve address_id and tag_overrides
                  merged.address_id = existingAddresses[idx].address_id;
                  merged.tag_overrides = existingAddresses[idx].tag_overrides || [];
                  existingAddresses[idx] = merged;
                } else {
                  // New address
                  existingAddresses.push(buildAddress(addrInput));
                }
              } else {
                // No external_code — always create new
                existingAddresses.push(buildAddress(addrInput));
              }
            }

            updateFields.addresses = existingAddresses;
          }

          if (Object.keys(updateFields).length > 0) {
            await CustomerModel.updateOne(
              { customer_id: existing.customer_id, tenant_id },
              { $set: updateFields },
            );
          }
        }

        // Upsert customer-level tags
        if (customerData.tags && customerData.tags.length > 0) {
          await upsertCustomerTagsBatch(
            tenantDb, tenant_id, existing.customer_id, customerData.tags,
          );
        }

        // Upsert address-level tag overrides
        if (customerData.addresses) {
          // Re-fetch to get current addresses (may have been updated above)
          const refreshed = await CustomerModel.findOne({
            customer_id: existing.customer_id, tenant_id,
          });
          if (refreshed) {
            for (const addrInput of customerData.addresses) {
              if (addrInput.tag_overrides && addrInput.tag_overrides.length > 0 && addrInput.external_code) {
                const addr = (refreshed.addresses || []).find(
                  (a: any) => a.external_code === addrInput.external_code,
                );
                if (addr) {
                  await upsertAddressTagOverridesBatch(
                    tenantDb, tenant_id, existing.customer_id,
                    addr.address_id, addrInput.tag_overrides,
                  );
                }
              }
            }
          }
        }
      } else {
        // ========== CREATE NEW CUSTOMER ==========
        const customer_id = `cust_${nanoid(12)}`;
        const public_code = await getNextCustomerPublicCode(tenantDb);

        const addresses = (customerData.addresses || []).map(buildAddress);

        await CustomerModel.create({
          customer_id,
          external_code,
          public_code,
          tenant_id,
          customer_type: customerData.customer_type || "business",
          is_guest: false,
          email: customerData.email || "",
          phone: customerData.phone,
          first_name: customerData.first_name,
          last_name: customerData.last_name,
          company_name: customerData.company_name,
          legal_info: customerData.legal_info,
          tags: [],
          addresses,
        });

        // Upsert customer-level tags
        if (customerData.tags && customerData.tags.length > 0) {
          await upsertCustomerTagsBatch(
            tenantDb, tenant_id, customer_id, customerData.tags,
          );
        }

        // Upsert address-level tag overrides
        if (customerData.addresses) {
          // Re-fetch to get created addresses with their IDs
          const created = await CustomerModel.findOne({ customer_id, tenant_id });
          if (created) {
            for (const addrInput of customerData.addresses) {
              if (addrInput.tag_overrides && addrInput.tag_overrides.length > 0 && addrInput.external_code) {
                const addr = (created.addresses || []).find(
                  (a: any) => a.external_code === addrInput.external_code,
                );
                if (addr) {
                  await upsertAddressTagOverridesBatch(
                    tenantDb, tenant_id, customer_id,
                    addr.address_id, addrInput.tag_overrides,
                  );
                }
              }
            }
          }
        }
      }

      successful++;
    } catch (error: any) {
      if (errors.length < 1000) {
        errors.push({
          row: processed + 1,
          entity_code: customerData.external_code || "",
          error: error.message,
          raw_data: customerData,
        });
      }
      failed++;
    }

    processed++;

    // Update progress every 100 rows
    if (processed % 100 === 0) {
      await ImportJobModel.findOneAndUpdate(
        { job_id },
        {
          processed_rows: processed,
          successful_rows: successful,
          failed_rows: failed,
        },
      );
      if (onProgress) {
        onProgress((processed / customers.length) * 100);
      }
    }
  }

  // Mark job as completed
  const completedAt = new Date();
  const jobDoc = await ImportJobModel.findOne({ job_id });
  const startedAt = jobDoc?.started_at || completedAt;
  const durationSeconds = (completedAt.getTime() - startedAt.getTime()) / 1000;

  await ImportJobModel.findOneAndUpdate(
    { job_id },
    {
      status: "completed",
      processed_rows: processed,
      successful_rows: successful,
      failed_rows: failed,
      import_errors: errors.slice(0, 1000),
      completed_at: completedAt,
      duration_seconds: durationSeconds,
    },
  );

  console.log(`✅ Customer import completed: ${successful} successful, ${failed} failed (${durationSeconds.toFixed(1)}s)`);

  return { processed, successful, failed };
}

/**
 * BullMQ job handler — delegates to processCustomerImportData.
 */
async function processCustomerImport(job: Job<CustomerImportJobData>) {
  return processCustomerImportData(job.data, (pct) => job.updateProgress(pct));
}

// ============================================
// WORKER SETUP
// ============================================

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379");

export const customerImportWorker = new Worker(
  "customer-import-queue",
  processCustomerImport,
  {
    connection: {
      host: REDIS_HOST,
      port: REDIS_PORT,
    },
    concurrency: 2,
  },
);

// Event listeners
customerImportWorker.on("completed", (job) => {
  console.log(`✓ Customer import job ${job.id} completed`);
});

customerImportWorker.on("failed", (job, err) => {
  console.error(`✗ Customer import job ${job?.id} failed:`, err);
});

customerImportWorker.on("progress", (job, progress) => {
  console.log(`Customer import job ${job.id}: ${progress}%`);
});
