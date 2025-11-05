/**
 * Recalculate Brand Product Counts
 *
 * This script recalculates the product_count for all brands based on actual product associations
 *
 * Usage: node scripts/recalculate-brand-counts.mjs
 */

import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ path: ".env.local" });

// Define schemas inline
const BrandSchema = new mongoose.Schema(
  {
    brand_id: { type: String, required: true, unique: true, index: true },
    wholesaler_id: { type: String, required: true, index: true },
    label: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, trim: true },
    logo_url: { type: String, trim: true },
    website_url: { type: String, trim: true },
    is_active: { type: Boolean, default: true },
    product_count: { type: Number, default: 0, min: 0 },
    display_order: { type: Number, default: 0 },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

const PIMProductSchema = new mongoose.Schema({
  entity_code: { type: String, required: true, index: true },
  wholesaler_id: { type: String, required: true, index: true },
  isCurrent: { type: Boolean, default: true },
  brand: {
    id: { type: String },
    name: { type: String },
    slug: { type: String },
    image: {
      id: { type: String },
      thumbnail: { type: String },
      original: { type: String },
    },
  },
});

const Brand = mongoose.models.Brand || mongoose.model("Brand", BrandSchema);
const PIMProduct = mongoose.models.PIMProduct || mongoose.model("PIMProduct", PIMProductSchema);

async function recalculateBrandCounts() {
  try {
    // Connect to MongoDB
    console.log("🔌 Connecting to MongoDB...");
    const mongoUri = process.env.VINC_MONGO_URL || process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error(
        "VINC_MONGO_URL, MONGO_URI or MONGODB_URI not found in environment variables"
      );
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    // Get all brands
    const brands = await Brand.find({}).lean();
    console.log(`📊 Found ${brands.length} brands\n`);

    let updated = 0;
    let unchanged = 0;

    for (const brand of brands) {
      // Count products for this brand
      const productCount = await PIMProduct.countDocuments({
        wholesaler_id: brand.wholesaler_id,
        isCurrent: true,
        "brand.id": brand.brand_id,
      });

      // Only update if count changed
      if (productCount !== brand.product_count) {
        await Brand.updateOne(
          { brand_id: brand.brand_id, wholesaler_id: brand.wholesaler_id },
          { $set: { product_count: productCount } }
        );

        console.log(
          `✅ ${brand.label}: ${brand.product_count} → ${productCount}`
        );
        updated++;
      } else {
        console.log(`✓  ${brand.label}: ${productCount} (no change)`);
        unchanged++;
      }
    }

    console.log("\n📈 Summary:");
    console.log(`   - Updated: ${updated} brands`);
    console.log(`   - Unchanged: ${unchanged} brands`);
    console.log(`   - Total: ${brands.length} brands`);

    console.log("\n✨ Brand counts recalculated successfully!");
  } catch (error) {
    console.error("❌ Error recalculating brand counts:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Disconnected from MongoDB");
  }
}

// Run the script
recalculateBrandCounts();
