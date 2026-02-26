/**
 * Product Sync API Route
 * Trigger marketplace sync for a specific product
 *
 * POST /api/products/{id}/sync
 * Body: { channels?: string[], operation?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncProductToMarketplaces, getEnabledChannels } from '@/lib/sync/marketplace-sync';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { channels, operation, priority } = body;

    // Validate channels if provided
    const enabledChannels = getEnabledChannels();
    const requestedChannels = channels || enabledChannels;

    // Check if requested channels are enabled
    const invalidChannels = requestedChannels.filter(
      (ch: string) => !enabledChannels.includes(ch)
    );

    if (invalidChannels.length > 0) {
      return NextResponse.json(
        {
          error: 'Invalid or disabled channels',
          invalid_channels: invalidChannels,
          available_channels: enabledChannels,
        },
        { status: 400 }
      );
    }

    // Queue sync job
    const job = await syncProductToMarketplaces(id, {
      channels: requestedChannels,
      operation: operation || 'update',
      priority: priority || 'normal',
    });

    return NextResponse.json({
      success: true,
      message: 'Sync job queued',
      job_id: job.id,
      product_id: id,
      channels: requestedChannels,
      operation: operation || 'update',
    });
  } catch (error: any) {
    console.error('Sync API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to queue sync job',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * Get available sync channels
 * GET /api/products/{id}/sync
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const enabledChannels = getEnabledChannels();

  return NextResponse.json({
    product_id: id,
    available_channels: enabledChannels,
    channel_info: {
      solr: {
        name: 'Solr 9',
        description: 'Search indexing',
        enabled: enabledChannels.includes('solr'),
      },
      ebay: {
        name: 'eBay',
        description: 'eBay marketplace',
        enabled: enabledChannels.includes('ebay'),
      },
      amazon: {
        name: 'Amazon',
        description: 'Amazon marketplace',
        enabled: enabledChannels.includes('amazon'),
      },
      trovaprezzi: {
        name: 'Trovaprezzi',
        description: 'Price comparison feed',
        enabled: enabledChannels.includes('trovaprezzi'),
      },
      manomano: {
        name: 'ManoMano',
        description: 'ManoMano marketplace',
        enabled: enabledChannels.includes('manomano'),
      },
    },
  });
}
