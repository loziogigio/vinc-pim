/**
 * Mock API Server for Testing Large Imports
 * Generates 1000 product items
 *
 * Usage: node test-data/mock-api-server.js
 */

const http = require('http');

const PORT = 3001;

// Generate 1000 mock products
function generateMockProducts(count = 1000) {
  const products = [];

  for (let i = 1; i <= count; i++) {
    products.push({
      id: i,
      name: `Product ${i} - Test Item`,
      sku: `SKU-${String(i).padStart(6, '0')}`,
      description: `This is a test product description for item ${i}. It contains detailed information about the product features and specifications.`,
      price: (Math.random() * 1000 + 10).toFixed(2),
      category: ['Electronics', 'Clothing', 'Home & Garden', 'Sports', 'Toys'][i % 5],
      stock: Math.floor(Math.random() * 500) + 1,
      brand: ['BrandA', 'BrandB', 'BrandC', 'BrandD'][i % 4]
    });
  }

  return products;
}

// Generate 50 products with errors for testing error handling
function generateProductsWithErrors() {
  const products = [];

  for (let i = 1; i <= 50; i++) {
    // Every other product has an error (25 valid, 25 with errors)
    if (i % 2 === 0) {
      // Valid product
      products.push({
        id: i,
        name: `Valid Product ${i}`,
        sku: `SKU-${String(i).padStart(6, '0')}`,
        description: `This is a valid test product description for item ${i}. It contains detailed information about the product features and specifications.`,
        price: (Math.random() * 1000 + 10).toFixed(2),
        category: ['Electronics', 'Clothing', 'Home & Garden', 'Sports', 'Toys'][i % 5],
        stock: Math.floor(Math.random() * 500) + 1,
        brand: ['BrandA', 'BrandB', 'BrandC', 'BrandD'][i % 4]
      });
    } else {
      // Product with errors - different types of errors
      const errorType = i % 8;

      if (errorType === 1) {
        // Missing ID (required field)
        products.push({
          // id: missing!
          name: `Error Product ${i} - Missing ID`,
          sku: `SKU-${String(i).padStart(6, '0')}`,
          description: 'This product is missing the ID field',
          price: 100,
          stock: 50
        });
      } else if (errorType === 3) {
        // Missing SKU
        products.push({
          id: i,
          name: `Error Product ${i} - Missing SKU`,
          // sku: missing!
          description: 'This product is missing the SKU field',
          price: 100,
          stock: 50
        });
      } else if (errorType === 5) {
        // Missing name
        products.push({
          id: i,
          // name: missing!
          sku: `SKU-${String(i).padStart(6, '0')}`,
          description: 'This product is missing the name field',
          price: 100,
          stock: 50
        });
      } else {
        // Empty/invalid data
        products.push({
          id: i,
          name: '', // Empty name
          sku: `SKU-${String(i).padStart(6, '0')}`,
          description: 'This product has an empty name',
          price: 100,
          stock: 50
        });
      }
    }
  }

  return products;
}

const mockProducts = generateMockProducts(1000);
const productsWithErrors = generateProductsWithErrors();

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/products' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mockProducts));
  } else if (req.url === '/products-with-errors' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(productsWithErrors));
  } else if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', products: mockProducts.length }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Mock API Server running on http://localhost:${PORT}`);
  console.log(`📦 Serving ${mockProducts.length} mock products`);
  console.log(`⚠️  Serving ${productsWithErrors.length} products with errors (50% error rate)`);
  console.log(`\n   Endpoints:`);
  console.log(`   GET http://localhost:${PORT}/products              - Get all 1000 products`);
  console.log(`   GET http://localhost:${PORT}/products-with-errors  - Get 50 products (25 valid, 25 with errors)`);
  console.log(`   GET http://localhost:${PORT}/health                - Health check`);
  console.log(`\n   Press Ctrl+C to stop`);
});
