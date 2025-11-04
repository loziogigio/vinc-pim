/**
 * Test API Endpoint - Products with Varying Quality
 * Returns paginated product data with different completeness levels for auto-publish testing
 *
 * Quality Distribution:
 * - 30% High Quality (score >= 85) - All fields filled → Auto-Published
 * - 40% Medium Quality (score 70-84) - Required + some optional → Auto-Published
 * - 30% Low Quality (score < 70) - Minimal fields → Draft
 */

import { NextRequest, NextResponse } from 'next/server';

// Generate test product data with varying quality
function generateProducts(page: number, pageSize: number) {
  const startIndex = (page - 1) * pageSize + 1;
  const products = [];

  const categories = ['Electronics', 'Clothing', 'Home & Garden', 'Sports & Outdoors', 'Beauty'];
  const brands = ['BrandA', 'BrandB', 'BrandC', 'BrandD'];
  const stockStatuses = ['in_stock', 'out_of_stock', 'pre_order'];

  for (let i = 0; i < pageSize; i++) {
    const index = startIndex + i;
    const rand = Math.random();

    let product: any;

    // 30% High Quality - Complete products with all fields (score >= 85)
    if (rand < 0.3) {
      product = {
        entity_code: `HIGH-QUAL-${String(index).padStart(5, '0')}`,
        sku: `SKU-HQ-${index}`,
        name: `Premium Product ${index}`,
        description: `This is a complete, high-quality product with all fields populated. Product #${index} comes with full specifications and detailed information.`,
        short_description: `Premium quality product ${index} with excellent features`,
        quantity: Math.floor(Math.random() * 500) + 100,
        price: (Math.random() * 500 + 50).toFixed(2),
        special_price: (Math.random() * 400 + 40).toFixed(2),
        image: {
          id: `img-hq-${index}`,
          thumbnail: `https://via.placeholder.com/150/0000FF/FFFFFF?text=HQ+${index}`,
          original: `https://via.placeholder.com/600/0000FF/FFFFFF?text=HighQuality+${index}`
        },
        gallery: [
          {
            id: `gallery-1-${index}`,
            thumbnail: `https://via.placeholder.com/150/0000FF?text=G1+${index}`,
            original: `https://via.placeholder.com/600/0000FF?text=Gallery1+${index}`
          },
          {
            id: `gallery-2-${index}`,
            thumbnail: `https://via.placeholder.com/150/0000FF?text=G2+${index}`,
            original: `https://via.placeholder.com/600/0000FF?text=Gallery2+${index}`
          }
        ],
        brand: {
          name: brands[Math.floor(Math.random() * brands.length)],
          id: `brand-${Math.floor(Math.random() * 4) + 1}`
        },
        category: {
          name: categories[Math.floor(Math.random() * categories.length)],
          id: `cat-${Math.floor(Math.random() * 5) + 1}`
        },
        categories: [
          { name: 'Main Category', id: 'main-1' },
          { name: 'Sub Category', id: 'sub-1' }
        ],
        features: [
          { label: 'Color', value: 'Blue', unit: '' },
          { label: 'Size', value: 'Large', unit: '' },
          { label: 'Material', value: 'Premium', unit: '' },
          { label: 'Warranty', value: '2', unit: 'Years' },
          { label: 'Weight', value: '5.5', unit: 'kg' }
        ],
        stock_status: 'in_stock',
        weight: (Math.random() * 10 + 1).toFixed(2),
        dimensions: {
          length: (Math.random() * 50 + 10).toFixed(2),
          width: (Math.random() * 50 + 10).toFixed(2),
          height: (Math.random() * 50 + 10).toFixed(2),
          unit: 'cm'
        }
      };
    }
    // 40% Medium Quality - Required fields + some optional (score 70-84)
    else if (rand < 0.7) {
      product = {
        entity_code: `MED-QUAL-${String(index).padStart(5, '0')}`,
        sku: `SKU-MQ-${index}`,
        name: `Standard Product ${index}`,
        description: `Standard quality product ${index} with essential information.`,
        short_description: `Product ${index}`,
        quantity: Math.floor(Math.random() * 300) + 50,
        price: (Math.random() * 300 + 30).toFixed(2),
        image: {
          id: `img-mq-${index}`,
          thumbnail: `https://via.placeholder.com/150/FFA500/FFFFFF?text=MQ+${index}`,
          original: `https://via.placeholder.com/600/FFA500/FFFFFF?text=MediumQuality+${index}`
        },
        brand: {
          name: brands[Math.floor(Math.random() * brands.length)],
          id: `brand-${Math.floor(Math.random() * 4) + 1}`
        },
        category: {
          name: categories[Math.floor(Math.random() * categories.length)],
          id: `cat-${Math.floor(Math.random() * 5) + 1}`
        },
        features: [
          { label: 'Color', value: 'Standard', unit: '' },
          { label: 'Size', value: 'Medium', unit: '' },
          { label: 'Material', value: 'Standard', unit: '' },
          { label: 'Warranty', value: '1', unit: 'Year' }
        ],
        stock_status: stockStatuses[Math.floor(Math.random() * stockStatuses.length)]
      };
    }
    // 30% Low Quality - Only required fields, minimal info (score < 70)
    else {
      product = {
        entity_code: `LOW-QUAL-${String(index).padStart(5, '0')}`,
        sku: `SKU-LQ-${index}`,
        name: `Basic Product ${index}`,
        quantity: Math.floor(Math.random() * 100) + 10,
        image: {
          id: `img-lq-${index}`,
          thumbnail: `https://via.placeholder.com/150/FF0000/FFFFFF?text=LQ+${index}`,
          original: `https://via.placeholder.com/600/FF0000/FFFFFF?text=LowQuality+${index}`
        },
        stock_status: 'in_stock'
      };
    }

    products.push(product);
  }

  return products;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '200');

    // Generate products
    const products = generateProducts(page, pageSize);

    // Return flat array (worker expects array, not wrapped in data field)
    return NextResponse.json(products);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
