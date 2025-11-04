#!/usr/bin/env node
/**
 * Simple HTTP Server for Test Files
 * Serves CSV files from test-data/batch-import directory
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8888;
const BASE_DIR = path.join(__dirname, '../test-data/batch-import');

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
    res.end('Method Not Allowed');
    return;
  }

  // Parse the requested file
  const filename = path.basename(req.url);
  const filepath = path.join(BASE_DIR, filename);

  // Security check: ensure file is within BASE_DIR
  if (!filepath.startsWith(BASE_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Check if file exists
  if (!fs.existsSync(filepath)) {
    res.writeHead(404);
    res.end('File Not Found');
    console.log(`❌ 404: ${filename}`);
    return;
  }

  // Serve the file
  try {
    const content = fs.readFileSync(filepath);
    res.writeHead(200, {
      'Content-Type': 'text/csv',
      'Content-Length': content.length,
    });
    res.end(content);
    console.log(`✓ Served: ${filename} (${content.length} bytes)`);
  } catch (error) {
    res.writeHead(500);
    res.end('Internal Server Error');
    console.error(`❌ Error serving ${filename}:`, error.message);
  }
});

server.listen(PORT, () => {
  console.log(`
========================================
TEST FILE SERVER RUNNING
========================================
Port: ${PORT}
Directory: ${BASE_DIR}
========================================
`);
  console.log('Available files:');
  try {
    const files = fs.readdirSync(BASE_DIR).filter(f => f.endsWith('.csv'));
    files.forEach(file => {
      const stats = fs.statSync(path.join(BASE_DIR, file));
      console.log(`  • http://localhost:${PORT}/${file} (${stats.size} bytes)`);
    });
  } catch (error) {
    console.error('Error listing files:', error.message);
  }
  console.log('\nPress Ctrl+C to stop\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n✓ Server stopped');
  process.exit(0);
});
