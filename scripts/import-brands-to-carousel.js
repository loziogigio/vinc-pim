import { MongoClient } from 'mongodb';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const MONGO_URI = process.env.VINC_MONGO_URL || 'mongodb://root:root@localhost:27017/?authSource=admin';
const MONGO_DB = process.env.VINC_MONGO_DB || 'hdr-api-it';
const BRAND_API_URL = 'https://hidros-admin.omnicommerce.cloud/api/resource/Home%20Brand?fields=%5B%22*%22%5D&filters=%5B%5B%22b2b%22,%22=%22,%221%22%5D,%5B%22status%22,%22=%22,%22Published%22%5D%5D&limit_page_length=1000&order_by=%60order%60%20ASC';
const BLOCK_ID = 'RDsevsAQt6mT7RcwudMej';

async function importBrands() {
  let client;

  try {
    console.log('Fetching brands from Hidros Admin API...');
    const { stdout } = await execAsync(`curl -s "${BRAND_API_URL}"`);
    const data = JSON.parse(stdout);
    const brands = data.data || [];

    console.log(`Found ${brands.length} brands`);

    // Transform brands to slides format
    const slides = brands.map((brand, index) => ({
      id: `slide-brand-${index}-${Date.now()}`,
      imageDesktop: {
        url: brand.image || '',
        alt: brand.label || brand.name || ''
      },
      imageMobile: {
        url: brand.image || '',
        alt: brand.label || brand.name || ''
      },
      link: {
        url: brand.url ? brand.url.replace('shop?text&id_brand=', 'shop?filters-id_brand=') : `shop?filters-id_brand=${brand.name}`,
        openInNewTab: false
      },
      title: '',
      overlay: {
        position: 'bottom',
        textColor: '#ffffff',
        backgroundColor: '#0f172a',
        backgroundOpacity: 0.65
      }
    }));

    console.log(`Transformed ${slides.length} slides`);

    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    client = new MongoClient(MONGO_URI);
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(MONGO_DB);
    const collection = db.collection('b2bhometemplates');

    // Update the block's slides (new structure: each version is a separate document)
    const result = await collection.updateOne(
      {
        'templateId': 'home-page',
        'isCurrent': true,  // Update current working version
        'blocks.id': BLOCK_ID
      },
      {
        $set: {
          'blocks.$[block].config.slides': slides,
          'lastSavedAt': new Date()
        }
      },
      {
        arrayFilters: [{ 'block.id': BLOCK_ID }]
      }
    );

    console.log('Update result:', result);

    if (result.modifiedCount > 0) {
      console.log(`✓ Successfully updated block ${BLOCK_ID} with ${slides.length} brand slides`);
    } else {
      console.log('✗ No documents were updated. Check if block ID is correct.');
    }

  } catch (error) {
    console.error('Error importing brands:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
}

importBrands();
