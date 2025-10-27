import { MongoClient } from 'mongodb';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const MONGO_URI = process.env.VINC_MONGO_URL || 'mongodb://root:root@localhost:27017/?authSource=admin';
const MONGO_DB = process.env.VINC_MONGO_DB || 'hdr-api-it';
const FLYER_API_URL = 'https://hidros-admin.omnicommerce.cloud/api/resource/Flyer?fields=%5B%22*%22%5D&filters=%5B%5B%22b2b%22,%22=%22,%221%22%5D%5D&limit_page_length=1000&order_by=%60order%60%20ASC';
const BLOCK_ID = process.argv[2]; // Pass block ID as argument

async function importFlyers() {
  let client;

  try {
    if (!BLOCK_ID) {
      console.error('Please provide block ID as argument');
      console.error('Usage: node import-flyers-to-carousel.js <BLOCK_ID>');
      process.exit(1);
    }

    console.log('Fetching flyers from Hidros Admin API...');
    const { stdout } = await execAsync(`curl -s "${FLYER_API_URL}"`);
    const data = JSON.parse(stdout);
    const flyers = data.data || [];

    console.log(`Found ${flyers.length} flyers`);

    // Transform flyers to slides format
    const slides = flyers.map((flyer, index) => ({
      id: `slide-flyer-${index}-${Date.now()}`,
      imageDesktop: {
        url: flyer.flyer_image || '',
        alt: flyer.label || flyer.name || ''
      },
      imageMobile: {
        url: flyer.flyer_image || '',
        alt: flyer.label || flyer.name || ''
      },
      link: {
        url: flyer.pdf || '',
        openInNewTab: true  // Open PDF in new tab
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
      console.log(`✓ Successfully updated block ${BLOCK_ID} with ${slides.length} flyer slides`);
    } else {
      console.log('✗ No documents were updated. Check if block ID is correct.');
    }

  } catch (error) {
    console.error('Error importing flyers:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
}

importFlyers();
