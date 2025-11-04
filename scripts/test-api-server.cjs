#!/usr/bin/env node
/**
 * Simple API Server for Import Testing
 * Returns paginated product data with random errors
 */

const http = require('http');
const PORT = 8889;
const ERROR_RATE = 0.05; // 5% error rate

// Generate product data
function generateProducts(page, pageSize) {
  const startIndex = (page - 1) * pageSize + 1;
  const products = [];

  for (let i = 0; i < pageSize; i++) {
    const index = startIndex + i;
    const shouldError = Math.random() < ERROR_RATE;

    let product;
    if (shouldError) {
      const errorType = Math.floor(Math.random() * 4);
      switch (errorType) {
        case 0:
          // Missing entity_code
          product = {
            sku: `SKU-${index}`,
            name: `Test Product ${index}`,
            description: `Description for product ${index}`,
            price: (Math.random() * 100).toFixed(2),
            category: 'Electronics',
            stock: Math.floor(Math.random() * 1000),
            weight: (Math.random() * 50).toFixed(2),
            brand: 'BrandA',
            status: 'active'
          };
          break;
        case 1:
          // Invalid price
          product = {
            entity_code: `TEST-PROD-${String(index).padStart(5, '0')}`,
            sku: `SKU-${index}`,
            name: `Test Product ${index}`,
            description: `Description for product ${index}`,
            price: 'invalid-price',
            category: 'Electronics',
            stock: Math.floor(Math.random() * 1000),
            weight: (Math.random() * 50).toFixed(2),
            brand: 'BrandB',
            status: 'active'
          };
          break;
        case 2:
          // Missing name
          product = {
            entity_code: `TEST-PROD-${String(index).padStart(5, '0')}`,
            sku: `SKU-${index}`,
            description: `Description for product ${index}`,
            price: (Math.random() * 100).toFixed(2),
            category: 'Home',
            stock: Math.floor(Math.random() * 1000),
            weight: (Math.random() * 50).toFixed(2),
            brand: 'BrandC',
            status: 'active'
          };
          break;
        case 3:
          // Invalid stock
          product = {
            entity_code: `TEST-PROD-${String(index).padStart(5, '0')}`,
            sku: `SKU-${index}`,
            name: `Test Product ${index}`,
            description: `Description for product ${index}`,
            price: (Math.random() * 100).toFixed(2),
            category: 'Sports',
            stock: 'invalid-stock',
            weight: (Math.random() * 50).toFixed(2),
            brand: 'BrandA',
            status: 'active'
          };
          break;
      }
    } else {
      // Valid product
      const categories = ['Electronics', 'Clothing', 'Home', 'Sports'];
      const brands = ['BrandA', 'BrandB', 'BrandC'];
      product = {
        entity_code: `TEST-PROD-${String(index).padStart(5, '0')}`,
        sku: `SKU-${index}`,
        name: `Test Product ${index}`,
        description: `This is test product number ${index}`,
        price: (Math.random() * 100).toFixed(2),
        category: categories[Math.floor(Math.random() * categories.length)],
        stock: Math.floor(Math.random() * 1000),
        weight: (Math.random() * 50).toFixed(2),
        brand: brands[Math.floor(Math.random() * brands.length)],
        status: 'active'
      };
    }

    products.push(product);
  }

  return products;
}

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    res.writeHead(405);
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  // Parse query parameters
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('pageSize') || '200');

  // Generate products
  const products = generateProducts(page, pageSize);

  // Return flat array (worker expects array, not wrapped in data field)
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(products));

  console.log(`✓ Served page ${page} (${products.length} products)`);
});

server.listen(PORT, () => {
  console.log(`
========================================
TEST API SERVER RUNNING
========================================
Port: ${PORT}
URL: http://localhost:${PORT}
Error Rate: ${(ERROR_RATE * 100)}%
========================================

Example requests:
  • http://localhost:${PORT}?page=1&pageSize=200
  • http://localhost:${PORT}?page=2&pageSize=200

Press Ctrl+C to stop
`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n✓ Server stopped');
  process.exit(0);
});
