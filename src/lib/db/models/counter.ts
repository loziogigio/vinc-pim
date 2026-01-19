import mongoose, { Schema, Document } from "mongoose";
import { getPooledConnection } from "@/lib/db/connection-pool";

/**
 * Counter Model
 *
 * Used for generating sequential numbers (e.g., order numbers per year).
 * Uses atomic findOneAndUpdate with $inc for thread-safe increments.
 *
 * NOTE: Counter functions that need tenant isolation (getNextCustomerPublicCode,
 * getNextOrderNumber, getNextCartNumber) require a tenantDb parameter.
 */

export interface ICounter extends Document {
  _id: string; // Sequence identifier (e.g., "order_number_2025")
  value: number; // Current counter value
}

const CounterSchema = new Schema<ICounter>(
  {
    _id: {
      type: String,
      required: true,
    },
    value: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    // No automatic timestamps needed for counters
    timestamps: false,
  }
);

export { CounterSchema };

export const CounterModel =
  mongoose.models.Counter || mongoose.model<ICounter>("Counter", CounterSchema);

/**
 * Get a Counter model for a specific tenant database.
 */
async function getCounterModel(tenantDb: string) {
  const connection = await getPooledConnection(tenantDb);
  if (connection.models.Counter) {
    return connection.models.Counter;
  }
  return connection.model<ICounter>("Counter", CounterSchema);
}

/**
 * Get the next sequential order number for a given year.
 * Uses atomic increment to ensure uniqueness even with concurrent requests.
 *
 * @param tenantDb - The tenant database name (e.g., "vinc-hidros-it")
 * @param year - The year for the order number sequence (e.g., 2025)
 * @returns The next order number in the sequence
 */
export async function getNextOrderNumber(tenantDb: string, year: number): Promise<number> {
  const Counter = await getCounterModel(tenantDb);
  const result = await Counter.findOneAndUpdate(
    { _id: `order_number_${year}` },
    { $inc: { value: 1 } },
    {
      upsert: true, // Create if doesn't exist
      returnDocument: "after", // Return updated document
      new: true, // Mongoose alias for returnDocument: "after"
    }
  );

  if (!result) {
    throw new Error(`Failed to generate order number for year ${year}`);
  }

  return result.value;
}

/**
 * Get the next sequential cart number for a given year.
 * Uses atomic increment to ensure uniqueness even with concurrent requests.
 * Cart numbers are assigned immediately on cart creation.
 *
 * @param tenantDb - The tenant database name (e.g., "vinc-hidros-it")
 * @param year - The year for the cart number sequence (e.g., 2025)
 * @returns The next cart number in the sequence
 */
export async function getNextCartNumber(tenantDb: string, year: number): Promise<number> {
  const Counter = await getCounterModel(tenantDb);
  const result = await Counter.findOneAndUpdate(
    { _id: `cart_number_${year}` },
    { $inc: { value: 1 } },
    {
      upsert: true, // Create if doesn't exist
      returnDocument: "after", // Return updated document
      new: true, // Mongoose alias for returnDocument: "after"
    }
  );

  if (!result) {
    throw new Error(`Failed to generate cart number for year ${year}`);
  }

  return result.value;
}

/**
 * Get a generic sequential counter value.
 * Useful for other sequences like invoice numbers, quote numbers, etc.
 *
 * @param sequenceName - Unique identifier for the sequence
 * @returns The next value in the sequence
 */
export async function getNextSequenceValue(sequenceName: string): Promise<number> {
  const result = await CounterModel.findOneAndUpdate(
    { _id: sequenceName },
    { $inc: { value: 1 } },
    {
      upsert: true,
      returnDocument: "after",
      new: true,
    }
  );

  if (!result) {
    throw new Error(`Failed to generate sequence value for ${sequenceName}`);
  }

  return result.value;
}

/**
 * Get the current value of a counter without incrementing.
 *
 * @param sequenceName - Unique identifier for the sequence
 * @returns The current value, or 0 if the sequence doesn't exist
 */
export async function getCurrentSequenceValue(sequenceName: string): Promise<number> {
  const result = await CounterModel.findById(sequenceName);
  return result?.value ?? 0;
}

/**
 * Get the next customer public code.
 * Generates a human-readable, unique, incremental code in format "C-XXXXX".
 * Uses atomic increment to ensure uniqueness even with concurrent requests.
 *
 * Format examples:
 * - C-00001 to C-99999 (5 digits, zero-padded)
 * - C-100000+ (expands naturally beyond 99999)
 *
 * @param tenantDb - The tenant database name (e.g., "vinc-hidros-it")
 * @returns The next customer public code (e.g., "C-00001", "C-00002")
 */
export async function getNextCustomerPublicCode(tenantDb: string): Promise<string> {
  const Counter = await getCounterModel(tenantDb);
  const result = await Counter.findOneAndUpdate(
    { _id: `customer_public_code` },
    { $inc: { value: 1 } },
    {
      upsert: true,
      returnDocument: "after",
      new: true,
    }
  );

  if (!result) {
    throw new Error(`Failed to generate customer public code for tenant ${tenantDb}`);
  }

  // Format: C-XXXXX (minimum 5 digits with zero-padding, expands if > 99999)
  return `C-${String(result.value).padStart(5, "0")}`;
}

/**
 * Set a counter to a specific value.
 * Useful for initialization or migration.
 *
 * @param sequenceName - Unique identifier for the sequence
 * @param value - The value to set
 */
export async function setSequenceValue(
  sequenceName: string,
  value: number
): Promise<void> {
  await CounterModel.findOneAndUpdate(
    { _id: sequenceName },
    { value },
    { upsert: true }
  );
}
