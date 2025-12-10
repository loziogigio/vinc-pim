/**
 * POST /api/elia/intent
 * Extract search intent from natural language query
 *
 * This is a test endpoint for Step 1 - Intent Extraction
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  extractSearchIntent,
  validateQuery,
} from '@/lib/elia/intent.service';
import { getModelConfig } from '@/lib/elia/claude.service';
import { getEliaConfig } from '@/lib/types/elia';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, language = 'it' } = body;

    // Validate query
    const validation = validateQuery(query);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    // Extract intent
    const result = await extractSearchIntent(query, language);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          code: 'INTENT_EXTRACTION_FAILED',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        query,
        language,
        intent: result.intent,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Intent extraction error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/elia/intent
 * Get configuration info (for debugging)
 */
export async function GET() {
  const config = getEliaConfig();
  const modelConfig = getModelConfig();

  return NextResponse.json({
    success: true,
    data: {
      service: 'elia-intent',
      config: {
        minQueryLength: config.minQueryLength,
        maxQueryLength: config.maxQueryLength,
        hasApiKey: !!config.anthropicApiKey,
      },
      models: {
        haiku: {
          model: modelConfig.haiku.model,
          maxRetries: modelConfig.haiku.maxRetries,
          timeoutMs: modelConfig.haiku.timeoutMs,
        },
        sonnet: {
          model: modelConfig.sonnet.model,
          maxRetries: modelConfig.sonnet.maxRetries,
          timeoutMs: modelConfig.sonnet.timeoutMs,
        },
      },
      strategy: 'Haiku first for simple queries (complexity < 2), Sonnet for complex or as fallback',
      timestamp: new Date().toISOString(),
    },
  });
}