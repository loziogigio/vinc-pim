/**
 * Script to populate sample B2B categories
 * Run with: node scripts/populate-sample-categories.cjs
 */

const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

// Load environment variables
require('dotenv').config();

const MONGODB_URI = process.env.VINC_MONGO_URL;
const MONGODB_DB_NAME = process.env.VINC_MONGO_DB;

// Define Category Schema (matching the model)
const CategorySchema = new mongoose.Schema({
  category_id: { type: String, required: true, unique: true, index: true },
  wholesaler_id: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true, lowercase: true },
  description: { type: String, trim: true },
  parent_id: { type: String, index: true },
  level: { type: Number, default: 0, index: true },
  path: { type: [String], default: [] },
  hero_image: {
    url: String,
    alt_text: String,
    cdn_key: String,
  },
  seo: {
    title: String,
    description: String,
    keywords: [String],
  },
  display_order: { type: Number, default: 0 },
  is_active: { type: Boolean, default: true },
  product_count: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);

// Use actual wholesaler ID from the database
const WHOLESALER_ID = '6900ac2364787f6f09231006';

// Sample categories - Plumbing/Hydraulic B2B structure
const sampleCategories = [
  // Root Level Categories
  {
    name: 'Water Meters',
    slug: 'water-meters',
    description: 'Professional water metering solutions for residential and commercial applications',
    parent_id: null,
    display_order: 1,
    hero_image: {
      url: 'https://images.unsplash.com/photo-1581092583537-20d51876f04f?w=800',
      alt_text: 'Water meters and measurement devices',
    },
    seo: {
      title: 'Water Meters - Professional Metering Solutions',
      description: 'High-quality water meters for accurate consumption measurement in residential, commercial, and industrial settings.',
      keywords: ['water meters', 'flow meters', 'consumption meters', 'rotary meters'],
    },
  },
  {
    name: 'Valves & Fittings',
    slug: 'valves-fittings',
    description: 'Complete range of valves, fittings, and connection components for plumbing systems',
    parent_id: null,
    display_order: 2,
    hero_image: {
      url: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=800',
      alt_text: 'Brass valves and fittings',
    },
    seo: {
      title: 'Valves & Fittings - Plumbing Connection Components',
      description: 'Professional-grade valves, connectors, and fittings for hydraulic and plumbing installations.',
      keywords: ['ball valves', 'gate valves', 'brass fittings', 'plumbing connectors'],
    },
  },
  {
    name: 'Pumps & Motors',
    slug: 'pumps-motors',
    description: 'Industrial and residential pumps, circulators, and motor systems',
    parent_id: null,
    display_order: 3,
    hero_image: {
      url: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800',
      alt_text: 'Water pumps and circulation systems',
    },
    seo: {
      title: 'Pumps & Motors - Water Circulation Systems',
      description: 'High-performance pumps and motors for water circulation, pressure boosting, and drainage applications.',
      keywords: ['water pumps', 'circulators', 'submersible pumps', 'booster pumps'],
    },
  },
  {
    name: 'Pipes & Tubing',
    slug: 'pipes-tubing',
    description: 'PEX, copper, and multilayer piping systems for water distribution',
    parent_id: null,
    display_order: 4,
    hero_image: {
      url: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=800',
      alt_text: 'Various types of pipes and tubing',
    },
    seo: {
      title: 'Pipes & Tubing - Water Distribution Systems',
      description: 'Professional piping solutions including PEX, copper, and multilayer systems for modern plumbing installations.',
      keywords: ['pex pipes', 'copper tubing', 'multilayer pipes', 'water distribution'],
    },
  },
  {
    name: 'Heating Systems',
    slug: 'heating-systems',
    description: 'Radiators, underfloor heating, and thermal control systems',
    parent_id: null,
    display_order: 5,
    hero_image: {
      url: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800',
      alt_text: 'Heating radiators and systems',
    },
    seo: {
      title: 'Heating Systems - Radiators & Thermal Control',
      description: 'Complete heating solutions including radiators, underfloor systems, and thermostatic controls.',
      keywords: ['radiators', 'underfloor heating', 'heating systems', 'thermostats'],
    },
  },
  {
    name: 'Drainage & Sewage',
    slug: 'drainage-sewage',
    description: 'Drainage systems, pumps, and wastewater management solutions',
    parent_id: null,
    display_order: 6,
    hero_image: {
      url: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=800',
      alt_text: 'Drainage pipes and systems',
    },
    seo: {
      title: 'Drainage & Sewage - Wastewater Solutions',
      description: 'Professional drainage systems, sewage pumps, and wastewater management equipment.',
      keywords: ['drainage systems', 'sewage pumps', 'wastewater', 'drain pipes'],
    },
  },
];

// Child categories (will be added with parent references)
const childCategories = [
  // Water Meters subcategories
  {
    name: 'Rotary Meters',
    slug: 'rotary-meters',
    description: 'Single and multi-jet rotary water meters for residential use',
    parent_slug: 'water-meters',
    display_order: 1,
  },
  {
    name: 'Ultrasonic Meters',
    slug: 'ultrasonic-meters',
    description: 'Advanced ultrasonic water meters with electronic readout',
    parent_slug: 'water-meters',
    display_order: 2,
  },
  {
    name: 'Bulk Meters',
    slug: 'bulk-meters',
    description: 'Large diameter meters for commercial and industrial applications',
    parent_slug: 'water-meters',
    display_order: 3,
  },

  // Valves & Fittings subcategories
  {
    name: 'Ball Valves',
    slug: 'ball-valves',
    description: 'Quarter-turn ball valves in brass and stainless steel',
    parent_slug: 'valves-fittings',
    display_order: 1,
  },
  {
    name: 'Gate Valves',
    slug: 'gate-valves',
    description: 'Rising and non-rising stem gate valves',
    parent_slug: 'valves-fittings',
    display_order: 2,
  },
  {
    name: 'Check Valves',
    slug: 'check-valves',
    description: 'Non-return valves and backflow preventers',
    parent_slug: 'valves-fittings',
    display_order: 3,
  },
  {
    name: 'Brass Fittings',
    slug: 'brass-fittings',
    description: 'Compression and threaded brass fittings',
    parent_slug: 'valves-fittings',
    display_order: 4,
  },

  // Pumps & Motors subcategories
  {
    name: 'Circulation Pumps',
    slug: 'circulation-pumps',
    description: 'Central heating circulators and zone pumps',
    parent_slug: 'pumps-motors',
    display_order: 1,
  },
  {
    name: 'Submersible Pumps',
    slug: 'submersible-pumps',
    description: 'Drainage and sewage submersible pumps',
    parent_slug: 'pumps-motors',
    display_order: 2,
  },
  {
    name: 'Booster Pumps',
    slug: 'booster-pumps',
    description: 'Pressure boosting systems for low water pressure',
    parent_slug: 'pumps-motors',
    display_order: 3,
  },
];

async function populateCategories() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      dbName: MONGODB_DB_NAME,
    });
    console.log('✅ Connected to MongoDB');

    // Clear existing demo categories
    console.log('🗑️  Removing existing demo categories...');
    await Category.deleteMany({ wholesaler_id: WHOLESALER_ID });

    // Create root categories first
    console.log('📦 Creating root categories...');
    const createdRootCategories = [];

    for (const category of sampleCategories) {
      const newCategory = await Category.create({
        category_id: nanoid(12),
        wholesaler_id: WHOLESALER_ID,
        ...category,
        level: 0,
        path: [],
      });
      createdRootCategories.push(newCategory);
      console.log(`  ✓ Created: ${newCategory.name}`);
    }

    // Create child categories
    console.log('📦 Creating child categories...');
    for (const childCat of childCategories) {
      const parent = createdRootCategories.find(c => c.slug === childCat.parent_slug);
      if (!parent) {
        console.log(`  ⚠️  Parent not found for: ${childCat.name}`);
        continue;
      }

      const newChild = await Category.create({
        category_id: nanoid(12),
        wholesaler_id: WHOLESALER_ID,
        name: childCat.name,
        slug: childCat.slug,
        description: childCat.description,
        parent_id: parent.category_id,
        level: 1,
        path: [parent.category_id],
        display_order: childCat.display_order,
        is_active: true,
        product_count: 0,
        seo: {
          title: `${childCat.name} - ${parent.name}`,
          description: childCat.description,
          keywords: [childCat.name.toLowerCase(), parent.name.toLowerCase()],
        },
      });
      console.log(`  ✓ Created: ${newChild.name} (child of ${parent.name})`);
    }

    // Summary
    const totalCategories = await Category.countDocuments({ wholesaler_id: WHOLESALER_ID });
    console.log(`\n✅ Successfully created ${totalCategories} categories!`);
    console.log(`   - Root categories: ${createdRootCategories.length}`);
    console.log(`   - Child categories: ${childCategories.length}`);
    console.log(`\n📍 Wholesaler ID: ${WHOLESALER_ID}`);
    console.log(`\n🌐 View categories at: http://localhost:3001/b2b/pim/categories`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the script
populateCategories();
