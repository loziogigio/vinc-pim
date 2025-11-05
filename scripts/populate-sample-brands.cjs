/**
 * Populate Sample Brands
 *
 * This script creates sample brands for testing the brand management system
 *
 * Usage: node scripts/populate-sample-brands.cjs
 */

require("dotenv").config({ path: ".env.local" });
const mongoose = require("mongoose");
const { nanoid } = require("nanoid");

// Sample brands data with real brands
const sampleBrands = [
  {
    label: "Vaillant",
    slug: "vaillant",
    description: "Premium heating and cooling systems manufacturer",
    website_url: "https://www.vaillant.com",
    logo_url: "https://www.vaillant.com/images/vaillant-logo.svg",
    is_active: true,
    display_order: 1,
  },
  {
    label: "Viessmann",
    slug: "viessmann",
    description: "Integrated climate and renewable energy solutions",
    website_url: "https://www.viessmann.com",
    logo_url: "https://www.viessmann.com/logo.svg",
    is_active: true,
    display_order: 2,
  },
  {
    label: "Giacomini",
    slug: "giacomini",
    description: "Heating and plumbing components manufacturer",
    website_url: "https://www.giacomini.com",
    is_active: true,
    display_order: 3,
  },
  {
    label: "Caleffi",
    slug: "caleffi",
    description: "Components for heating and plumbing systems",
    website_url: "https://www.caleffi.com",
    is_active: true,
    display_order: 4,
  },
  {
    label: "Watts",
    slug: "watts",
    description: "Plumbing, heating and water quality products",
    website_url: "https://www.watts.com",
    is_active: true,
    display_order: 5,
  },
  {
    label: "Honeywell",
    slug: "honeywell",
    description: "Building technologies and HVAC controls",
    website_url: "https://www.honeywell.com",
    is_active: true,
    display_order: 6,
  },
  {
    label: "Grundfos",
    slug: "grundfos",
    description: "Advanced pump solutions and water technology",
    website_url: "https://www.grundfos.com",
    is_active: true,
    display_order: 7,
  },
  {
    label: "Wilo",
    slug: "wilo",
    description: "Pumps and pump systems for various applications",
    website_url: "https://www.wilo.com",
    is_active: true,
    display_order: 8,
  },
  {
    label: "Flamco",
    slug: "flamco",
    description: "Expansion vessels and pressure control",
    website_url: "https://www.flamcogroup.com",
    is_active: true,
    display_order: 9,
  },
  {
    label: "Seitron",
    slug: "seitron",
    description: "Gas detection and HVAC controls",
    website_url: "https://www.seitron.com",
    is_active: true,
    display_order: 10,
  },
  {
    label: "Test Brand Inactive",
    slug: "test-brand-inactive",
    description: "Inactive brand for testing filters",
    is_active: false,
    display_order: 999,
  },
];

// Define schema inline to avoid import issues
const BrandSchema = new mongoose.Schema(
  {
    brand_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    wholesaler_id: {
      type: String,
      required: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    logo_url: {
      type: String,
      trim: true,
    },
    website_url: {
      type: String,
      trim: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    product_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    display_order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

// Compound indexes
BrandSchema.index({ wholesaler_id: 1, slug: 1 }, { unique: true });
BrandSchema.index({ wholesaler_id: 1, label: 1 });
BrandSchema.index({ wholesaler_id: 1, is_active: 1 });
BrandSchema.index({ wholesaler_id: 1, created_at: -1 });

const Brand =
  mongoose.models.Brand || mongoose.model("Brand", BrandSchema);

async function populateBrands() {
  try {
    // Connect to MongoDB
    console.log("🔌 Connecting to MongoDB...");
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error(
        "MONGO_URI or MONGODB_URI not found in environment variables"
      );
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    // Get wholesaler ID from environment or use default
    const wholesalerId =
      process.env.TEST_WHOLESALER_ID || "default-wholesaler-id";
    console.log(`\n📦 Using wholesaler_id: ${wholesalerId}\n`);

    // Clear existing brands for this wholesaler
    const deleteResult = await Brand.deleteMany({
      wholesaler_id: wholesalerId,
    });
    console.log(
      `🗑️  Deleted ${deleteResult.deletedCount} existing brands\n`
    );

    // Create sample brands
    console.log("📝 Creating sample brands...\n");
    let created = 0;

    for (const brandData of sampleBrands) {
      const brand = await Brand.create({
        brand_id: nanoid(12),
        wholesaler_id: wholesalerId,
        ...brandData,
      });

      console.log(
        `✅ Created: ${brand.label} (${brand.slug}) - ${
          brand.is_active ? "Active" : "Inactive"
        }`
      );
      created++;
    }

    console.log(`\n🎉 Successfully created ${created} sample brands!`);

    // Show summary
    const activeCount = await Brand.countDocuments({
      wholesaler_id: wholesalerId,
      is_active: true,
    });
    const inactiveCount = await Brand.countDocuments({
      wholesaler_id: wholesalerId,
      is_active: false,
    });

    console.log("\n📊 Summary:");
    console.log(`   - Active brands: ${activeCount}`);
    console.log(`   - Inactive brands: ${inactiveCount}`);
    console.log(`   - Total brands: ${created}`);

    console.log("\n✨ Sample brands have been populated successfully!");
  } catch (error) {
    console.error("❌ Error populating brands:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Disconnected from MongoDB");
  }
}

// Run the script
populateBrands();
