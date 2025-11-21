#!/usr/bin/env node
/**
 * Seed Common Units of Measurement (UOMs)
 * Run this once to populate the UOM catalog with standard units
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const crypto = require("crypto");

// Simple ID generator (alternative to nanoid for CommonJS)
function generateId() {
  return crypto.randomBytes(6).toString("base64url");
}

const COMMON_UOMS = [
  // Weight
  { symbol: "g", name: "Gram", category: "weight", display_order: 1 },
  { symbol: "kg", name: "Kilogram", category: "weight", display_order: 2 },
  { symbol: "t", name: "Ton", category: "weight", display_order: 3 },
  { symbol: "lb", name: "Pound", category: "weight", display_order: 4 },
  { symbol: "oz", name: "Ounce", category: "weight", display_order: 5 },

  // Length
  { symbol: "mm", name: "Millimeter", category: "length", display_order: 1 },
  { symbol: "cm", name: "Centimeter", category: "length", display_order: 2 },
  { symbol: "m", name: "Meter", category: "length", display_order: 3 },
  { symbol: "km", name: "Kilometer", category: "length", display_order: 4 },
  { symbol: "in", name: "Inch", category: "length", display_order: 5 },
  { symbol: "ft", name: "Foot", category: "length", display_order: 6 },
  { symbol: "yd", name: "Yard", category: "length", display_order: 7 },

  // Pressure
  { symbol: "bar", name: "Bar", category: "pressure", display_order: 1 },
  { symbol: "psi", name: "PSI", category: "pressure", display_order: 2 },
  { symbol: "Pa", name: "Pascal", category: "pressure", display_order: 3 },
  { symbol: "kPa", name: "Kilopascal", category: "pressure", display_order: 4 },
  { symbol: "MPa", name: "Megapascal", category: "pressure", display_order: 5 },

  // Temperature
  { symbol: "°C", name: "Celsius", category: "temperature", display_order: 1 },
  { symbol: "°F", name: "Fahrenheit", category: "temperature", display_order: 2 },
  { symbol: "K", name: "Kelvin", category: "temperature", display_order: 3 },

  // Volume
  { symbol: "ml", name: "Milliliter", category: "volume", display_order: 1 },
  { symbol: "l", name: "Liter", category: "volume", display_order: 2 },
  { symbol: "m³", name: "Cubic Meter", category: "volume", display_order: 3 },
  { symbol: "gal", name: "Gallon", category: "volume", display_order: 4 },
  { symbol: "qt", name: "Quart", category: "volume", display_order: 5 },

  // Time
  { symbol: "s", name: "Second", category: "time", display_order: 1 },
  { symbol: "min", name: "Minute", category: "time", display_order: 2 },
  { symbol: "h", name: "Hour", category: "time", display_order: 3 },
  { symbol: "d", name: "Day", category: "time", display_order: 4 },
  { symbol: "mo", name: "Month", category: "time", display_order: 5 },
  { symbol: "yr", name: "Year", category: "time", display_order: 6 },

  // Other common units
  { symbol: "%", name: "Percent", category: "other", display_order: 1 },
  { symbol: "pcs", name: "Pieces", category: "other", display_order: 2 },
  { symbol: "box", name: "Box", category: "other", display_order: 3 },
  { symbol: "pkg", name: "Package", category: "other", display_order: 4 },
  { symbol: "W", name: "Watt", category: "other", display_order: 5 },
  { symbol: "V", name: "Volt", category: "other", display_order: 6 },
  { symbol: "A", name: "Ampere", category: "other", display_order: 7 },
  { symbol: "Hz", name: "Hertz", category: "other", display_order: 8 },
];

async function main() {
  console.log("🌱 Seeding UOMs...\n");

  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.VINC_MONGO_URL, {
      dbName: process.env.VINC_MONGO_DB,
    });

    console.log(`✅ Connected to database: ${process.env.VINC_MONGO_DB}\n`);

    // Define UOM model
    const UOMModel =
      mongoose.models.UOMs ||
      mongoose.model(
        "UOMs",
        new mongoose.Schema({}, { strict: false })
      );

    let created = 0;
    let skipped = 0;

    for (const uomData of COMMON_UOMS) {
      // Check if UOM already exists (case-insensitive)
      const existing = await UOMModel.findOne({
        symbol: { $regex: new RegExp(`^${uomData.symbol}$`, "i") },
      });

      if (existing) {
        console.log(`  ⏭️  Skipped: ${uomData.symbol} (${uomData.name}) - already exists`);
        skipped++;
      } else {
        await UOMModel.create({
          uom_id: generateId(),
          ...uomData,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        });
        console.log(`  ✅ Created: ${uomData.symbol} (${uomData.name})`);
        created++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Created: ${created}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${COMMON_UOMS.length}\n`);

    await mongoose.connection.close();
    console.log("✅ Done!\n");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main();
