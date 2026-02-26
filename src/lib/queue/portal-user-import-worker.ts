/**
 * Portal User Import Worker
 * Processes bulk portal user import jobs from the portal-user-import-queue.
 *
 * Supports two merge modes:
 * - "replace": Overwrite all provided fields
 * - "partial": Only update provided fields, preserve existing ones
 *
 * Reuses existing infrastructure:
 * - connectWithModels from connection
 * - bcrypt for password hashing (same as portal user POST route)
 */

import { Worker, Job } from "bullmq";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import { connectWithModels } from "../db/connection";
import type { ICustomerAccess } from "../types/portal-user";

// ============================================
// TYPES (exported for tests and reuse)
// ============================================

export interface PortalUserImportItem {
  username: string;
  email: string;
  password?: string;
  customer_access?: ICustomerAccess[];
  is_active?: boolean;
}

export interface PortalUserImportJobData {
  job_id: string;
  tenant_id: string;
  merge_mode: "replace" | "partial";
  users: PortalUserImportItem[];
  batch_metadata?: {
    batch_id: string;
    batch_part: number;
    batch_total_parts: number;
    batch_total_items?: number;
  };
}

// ============================================
// CONSTANTS
// ============================================

const BCRYPT_ROUNDS = 10;

// ============================================
// CORE PROCESSOR
// ============================================

/**
 * Core processor — testable without BullMQ Job dependency.
 * Takes plain data + optional progress callback.
 */
export async function processPortalUserImportData(
  data: PortalUserImportJobData,
  onProgress?: (percent: number) => void,
): Promise<{ processed: number; successful: number; failed: number }> {
  const { job_id, tenant_id, merge_mode, users, batch_metadata } = data;
  const tenantDb = `vinc-${tenant_id}`;

  console.log(`\n🔄 Processing portal user import: ${job_id}`);
  console.log(`   Tenant: ${tenant_id}`);
  console.log(`   Users: ${users.length}`);
  console.log(`   Merge mode: ${merge_mode}`);
  if (batch_metadata) {
    console.log(`   Batch: ${batch_metadata.batch_id} (part ${batch_metadata.batch_part}/${batch_metadata.batch_total_parts})`);
  }

  const {
    PortalUser: PortalUserModel,
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

  for (const userData of users) {
    try {
      const { username, email, password, customer_access, is_active } = userData;

      // Validate username
      if (!username) {
        errors.push({
          row: processed + 1,
          entity_code: "",
          error: "Missing username",
          raw_data: userData,
        });
        failed++;
        processed++;
        continue;
      }

      // Validate email
      if (!email) {
        errors.push({
          row: processed + 1,
          entity_code: username,
          error: "Missing email",
          raw_data: userData,
        });
        failed++;
        processed++;
        continue;
      }

      // Normalize
      const normalizedUsername = username.toLowerCase().trim();
      const normalizedEmail = email.toLowerCase().trim();

      // Lookup existing user by username
      const existing = await PortalUserModel.findOne({
        tenant_id,
        username: normalizedUsername,
      });

      if (existing) {
        // ========== UPDATE EXISTING ==========
        const updateDoc: Record<string, any> = {};

        if (normalizedEmail !== undefined) {
          updateDoc.email = normalizedEmail;
        }

        if (password !== undefined) {
          updateDoc.password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        }

        if (customer_access !== undefined) {
          updateDoc.customer_access = customer_access;
        }

        if (is_active !== undefined) {
          updateDoc.is_active = is_active;
        }

        // In partial mode, only update fields that were explicitly provided
        if (merge_mode === "partial") {
          const partialUpdate: Record<string, any> = {};
          if (userData.email !== undefined) partialUpdate.email = normalizedEmail;
          if (userData.password !== undefined) {
            partialUpdate.password_hash = await bcrypt.hash(password!, BCRYPT_ROUNDS);
          }
          if (userData.customer_access !== undefined) partialUpdate.customer_access = customer_access;
          if (userData.is_active !== undefined) partialUpdate.is_active = is_active;

          if (Object.keys(partialUpdate).length > 0) {
            await PortalUserModel.updateOne(
              { portal_user_id: existing.portal_user_id, tenant_id },
              { $set: partialUpdate },
            );
          }
        } else {
          // Replace mode: update all provided fields
          if (Object.keys(updateDoc).length > 0) {
            await PortalUserModel.updateOne(
              { portal_user_id: existing.portal_user_id, tenant_id },
              { $set: updateDoc },
            );
          }
        }
      } else {
        // ========== CREATE NEW USER ==========
        if (!password) {
          errors.push({
            row: processed + 1,
            entity_code: normalizedUsername,
            error: "Password is required for new users",
            raw_data: userData,
          });
          failed++;
          processed++;
          continue;
        }

        const portal_user_id = `PU-${nanoid(8)}`;
        const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        await PortalUserModel.create({
          portal_user_id,
          tenant_id,
          username: normalizedUsername,
          email: normalizedEmail,
          password_hash,
          customer_access: customer_access || [],
          is_active: is_active !== undefined ? is_active : true,
        });
      }

      successful++;
    } catch (error: any) {
      // Handle duplicate email error gracefully
      const isDuplicateKey = error.code === 11000;
      const errorMessage = isDuplicateKey
        ? "Email already used by another user"
        : error.message;

      if (errors.length < 1000) {
        errors.push({
          row: processed + 1,
          entity_code: userData.username || "",
          error: errorMessage,
          raw_data: userData,
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
        onProgress((processed / users.length) * 100);
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

  console.log(`✅ Portal user import completed: ${successful} successful, ${failed} failed (${durationSeconds.toFixed(1)}s)`);

  return { processed, successful, failed };
}

/**
 * BullMQ job handler — delegates to processPortalUserImportData.
 */
async function processPortalUserImport(job: Job<PortalUserImportJobData>) {
  return processPortalUserImportData(job.data, (pct) => job.updateProgress(pct));
}

// ============================================
// WORKER SETUP
// ============================================

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379");

export const portalUserImportWorker = new Worker(
  "portal-user-import-queue",
  processPortalUserImport,
  {
    connection: {
      host: REDIS_HOST,
      port: REDIS_PORT,
    },
    concurrency: 2,
  },
);

// Event listeners
portalUserImportWorker.on("completed", (job) => {
  console.log(`✓ Portal user import job ${job.id} completed`);
});

portalUserImportWorker.on("failed", (job, err) => {
  console.error(`✗ Portal user import job ${job?.id} failed:`, err);
});

portalUserImportWorker.on("progress", (job, progress) => {
  console.log(`Portal user import job ${job.id}: ${progress}%`);
});
