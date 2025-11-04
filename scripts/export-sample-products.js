/**
 * Export sample products for CSV generation
 */

import { MongoClient } from 'mongodb';

const MONGO_URL = process.env.VINC_MONGO_URL || 'mongodb://root:root@localhost:27017/?authSource=admin';
const MONGO_DB = process.env.VINC_MONGO_DB || 'hdr-api-it';

async function exportSampleProducts() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    const db = client.db(MONGO_DB);
    const products = await db.collection('products_b2b')
      .find({})
      .limit(10)
      .toArray();

    console.log(JSON.stringify(products, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

exportSampleProducts();
