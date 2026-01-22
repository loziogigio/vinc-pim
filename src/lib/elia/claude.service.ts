/**
 * Claude Service
 * Anthropic Claude API integration with retry/fallback strategy
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  getEliaConfig,
  EliaIntentExtraction,
  EliaIntentExtractionSchema,
  EliaProductAnalysisResult,
  EliaProductAnalysisSchema,
} from '@/lib/types/elia';
import {
  getIntentExtractionPrompt,
  getIntentExtractionUserMessage,
  getProductAnalysisPrompt,
  getProductAnalysisUserMessage,
} from './prompts';

// ============================================
// MODEL CONFIGURATION
// ============================================

interface ModelConfig {
  model: string;
  maxRetries: number;
  timeoutMs: number;
  temperature: number;
}

const HAIKU_CONFIG: ModelConfig = {
  model: 'claude-haiku-4-5-20251001',
  maxRetries: 2,
  timeoutMs: 5000,
  temperature: 0.2, // Lower temp for consistent structured output
};

const SONNET_CONFIG: ModelConfig = {
  model: 'claude-sonnet-4-5-20250929',
  maxRetries: 1,
  timeoutMs: 8000,
  temperature: 0.2,
};

// ============================================
// METRICS (for monitoring)
// ============================================

export interface IntentMetrics {
  model: string;
  success: boolean;
  durationMs: number;
  fallbackUsed: boolean;
  retries: number;
  queryLength: number;
  complexityScore: number;
}

// Metrics callback - can be replaced with PostHog or other analytics
let metricsCallback: ((metrics: IntentMetrics) => void) | null = null;

export function setMetricsCallback(callback: (metrics: IntentMetrics) => void) {
  metricsCallback = callback;
}

function logMetrics(metrics: IntentMetrics) {
  console.log('[ELIA Metrics]', JSON.stringify(metrics));
  if (metricsCallback) {
    metricsCallback(metrics);
  }
}

// ============================================
// SINGLETON CLIENT
// ============================================

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const config = getEliaConfig();

    if (!config.anthropicApiKey) {
      throw new Error('VINC_ANTHROPIC_API_KEY is not configured');
    }

    anthropicClient = new Anthropic({
      apiKey: config.anthropicApiKey,
    });
  }

  return anthropicClient;
}

// ============================================
// COMPLEXITY DETECTION
// ============================================

/**
 * Calculate query complexity to decide Haiku vs Sonnet
 * Returns score 0-4, use Haiku if < 2
 */
function calculateComplexity(query: string): number {
  const indicators = [
    query.length > 150, // Long query
    (query.match(/\b(e|o|ma|però|oppure)\b/gi) || []).length > 3, // Multiple conditions
    /confronta|vs|meglio|differenza|paragona/i.test(query), // Comparison request
    /consiglio|suggerisci|migliore|raccomanda/i.test(query), // Recommendation request
  ];

  return indicators.filter(Boolean).length;
}

/**
 * Decide whether to use Haiku (cheap) or go straight to Sonnet
 */
function shouldUseHaiku(query: string): boolean {
  const complexityScore = calculateComplexity(query);
  return complexityScore < 2;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function timeout<T>(ms: number, promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timeout after ${ms}ms`)), ms)
    ),
  ]);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// INTENT EXTRACTION WITH RETRY
// ============================================

/**
 * Check if an object is a valid SynonymTerm
 */
function isValidSynonymTerm(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const term = obj as Record<string, unknown>;
  return (
    typeof term.term === 'string' &&
    term.term.length > 0 &&
    typeof term.precision === 'number' &&
    term.precision >= 0 &&
    term.precision <= 1
  );
}

/**
 * Check if a field is a valid SynonymTerm array with minimum items
 */
function isValidSynonymArray(arr: unknown, minItems: number = 0): boolean {
  return (
    Array.isArray(arr) &&
    arr.length >= minItems &&
    arr.every(isValidSynonymTerm)
  );
}

/**
 * Validate intent structure (arrays with precision)
 */
function validateIntent(intent: EliaIntentExtraction): void {
  // Validate product synonym arrays (2 levels)
  if (!isValidSynonymArray(intent.product_exact, 1)) {
    throw new Error('Invalid intent: product_exact must have at least 1 SynonymTerm object');
  }
  if (!isValidSynonymArray(intent.product_synonyms, 2)) {
    throw new Error('Invalid intent: product_synonyms must have at least 2 SynonymTerm objects');
  }

  // Validate attribute synonym arrays (3 levels)
  if (!isValidSynonymArray(intent.attribute_exact, 0)) {
    throw new Error('Invalid intent: attribute_exact must be an array of SynonymTerm objects');
  }
  if (!isValidSynonymArray(intent.attribute_synonyms, 3)) {
    throw new Error('Invalid intent: attribute_synonyms must have at least 3 SynonymTerm objects');
  }
  if (!isValidSynonymArray(intent.attribute_related, 3)) {
    throw new Error('Invalid intent: attribute_related must have at least 3 SynonymTerm objects');
  }

  // Validate spec synonym arrays (3 levels)
  if (!isValidSynonymArray(intent.spec_exact, 0)) {
    throw new Error('Invalid intent: spec_exact must be an array of SynonymTerm objects');
  }
  if (!isValidSynonymArray(intent.spec_synonyms, 3)) {
    throw new Error('Invalid intent: spec_synonyms must have at least 3 SynonymTerm objects');
  }
  if (!isValidSynonymArray(intent.spec_related, 3)) {
    throw new Error('Invalid intent: spec_related must have at least 3 SynonymTerm objects');
  }

  // Validate required fields
  if (!intent.intent_type || !intent.user_message) {
    throw new Error('Invalid intent: missing required fields (intent_type or user_message)');
  }
  if (!intent.sort_by || !intent.stock_filter) {
    throw new Error('Invalid intent: missing required fields (sort_by or stock_filter)');
  }
}

/**
 * Extract intent with specific model config and retry logic
 */
async function extractIntentWithModel(
  query: string,
  language: string,
  modelConfig: ModelConfig
): Promise<EliaIntentExtraction> {
  const client = getAnthropicClient();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < modelConfig.maxRetries; attempt++) {
    try {
      const requestPromise = client.messages.create({
        model: modelConfig.model,
        max_tokens: 2048,
        temperature: modelConfig.temperature,
        system: getIntentExtractionPrompt(language),
        messages: [
          {
            role: 'user',
            content: getIntentExtractionUserMessage(query, language),
          },
        ],
        tools: [
          {
            name: 'extract_intent',
            description: 'Extract search intent from user query',
            input_schema: EliaIntentExtractionSchema,
          },
        ],
        tool_choice: { type: 'tool', name: 'extract_intent' },
      });

      // Apply timeout
      const response = await timeout(modelConfig.timeoutMs, requestPromise);

      // Extract tool use result
      const toolUse = response.content.find((block) => block.type === 'tool_use');

      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new Error('Claude did not return structured intent');
      }

      const intent = toolUse.input as EliaIntentExtraction;

      // Validate the response
      validateIntent(intent);

      console.log(`[ELIA] Intent extracted with ${modelConfig.model} (attempt ${attempt + 1})`);
      return intent;
    } catch (error) {
      lastError = error as Error;
      console.warn(
        `[ELIA] ${modelConfig.model} attempt ${attempt + 1} failed:`,
        lastError.message
      );

      // Don't retry on validation errors - escalate immediately
      if (lastError.message.includes('Invalid intent')) {
        throw lastError;
      }

      // Exponential backoff for retries
      if (attempt < modelConfig.maxRetries - 1) {
        const backoffMs = Math.pow(2, attempt) * 100;
        await sleep(backoffMs);
      }
    }
  }

  throw lastError || new Error('Intent extraction failed after retries');
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Extract search intent from user query
 * Uses Haiku first (cheaper), falls back to Sonnet if needed
 *
 * @param query - User search query
 * @param language - Language for prompt and response (default: 'it')
 */
export async function extractIntent(
  query: string,
  language: string = 'it'
): Promise<EliaIntentExtraction> {
  const startTime = Date.now();
  const complexityScore = calculateComplexity(query);
  const useHaiku = shouldUseHaiku(query);

  let usedModel = '';
  let fallbackUsed = false;
  let totalRetries = 0;

  try {
    if (useHaiku) {
      // Try Haiku first (cheaper)
      try {
        usedModel = HAIKU_CONFIG.model;
        const intent = await extractIntentWithModel(query, language, HAIKU_CONFIG);

        logMetrics({
          model: usedModel,
          success: true,
          durationMs: Date.now() - startTime,
          fallbackUsed: false,
          retries: 0,
          queryLength: query.length,
          complexityScore,
        });

        return intent;
      } catch (haikuError) {
        console.warn('[ELIA] Haiku failed, falling back to Sonnet:', (haikuError as Error).message);
        fallbackUsed = true;
        totalRetries = HAIKU_CONFIG.maxRetries;
      }
    }

    // Use Sonnet (either as fallback or for complex queries)
    usedModel = SONNET_CONFIG.model;
    const intent = await extractIntentWithModel(query, language, SONNET_CONFIG);

    logMetrics({
      model: usedModel,
      success: true,
      durationMs: Date.now() - startTime,
      fallbackUsed,
      retries: totalRetries,
      queryLength: query.length,
      complexityScore,
    });

    return intent;
  } catch (error) {
    logMetrics({
      model: usedModel,
      success: false,
      durationMs: Date.now() - startTime,
      fallbackUsed,
      retries: totalRetries + SONNET_CONFIG.maxRetries,
      queryLength: query.length,
      complexityScore,
    });

    throw new Error(`Intent extraction failed: ${(error as Error).message}`);
  }
}

/**
 * Extract intent forcing a specific model (for testing/debugging)
 */
export async function extractIntentWithSpecificModel(
  query: string,
  language: string = 'it',
  model: 'haiku' | 'sonnet'
): Promise<EliaIntentExtraction> {
  const config = model === 'haiku' ? HAIKU_CONFIG : SONNET_CONFIG;
  return extractIntentWithModel(query, language, config);
}

// ============================================
// PRODUCT ANALYSIS
// ============================================

/**
 * Product analysis request
 */
export interface AnalyzeProductsRequest {
  /** Products with ERP data */
  products: Record<string, unknown>[];
  /** Intent with sort/filter preferences */
  intent: {
    sort_by: string;
    stock_filter: string;
    attributes?: Record<string, unknown>;
  };
  /** Original user message */
  user_message?: string;
  /** Language for response (default: 'it') */
  language?: string;
}

/**
 * Analyze and reorder products using Claude
 * Uses Haiku for fast, cost-effective analysis
 */
export async function analyzeProducts(
  request: AnalyzeProductsRequest
): Promise<EliaProductAnalysisResult> {
  const { products, intent, user_message, language = 'it' } = request;
  const client = getAnthropicClient();
  const startTime = Date.now();

  console.log(`[ELIA Analyze] Starting Claude analysis for ${products.length} products`);
  console.log(`[ELIA Analyze] Intent: sort_by=${intent.sort_by}, stock_filter=${intent.stock_filter}`);

  try {
    const requestPromise = client.messages.create({
      model: HAIKU_CONFIG.model,
      max_tokens: 4096,
      temperature: 0.1, // Very low temp for consistent sorting
      system: getProductAnalysisPrompt(language),
      messages: [
        {
          role: 'user',
          content: getProductAnalysisUserMessage(products, intent, user_message),
        },
      ],
      tools: [
        {
          name: 'analyze_products',
          description: 'Return analyzed and reordered products',
          input_schema: EliaProductAnalysisSchema,
        },
      ],
      tool_choice: { type: 'tool', name: 'analyze_products' },
    });

    // Apply timeout (30s for analysis - Haiku should be fast but network latency varies)
    const response = await timeout(30000, requestPromise);

    // Extract tool use result
    const toolUse = response.content.find((block) => block.type === 'tool_use');

    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('Claude did not return structured analysis');
    }

    const result = toolUse.input as EliaProductAnalysisResult;

    const durationMs = Date.now() - startTime;
    console.log(`[ELIA Analyze] Claude analysis completed in ${durationMs}ms`);
    console.log(`[ELIA Analyze] Result: ${result.total_count} products, summary: ${result.summary}`);

    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(`[ELIA Analyze] Claude analysis failed after ${durationMs}ms:`, (error as Error).message);
    throw new Error(`Product analysis failed: ${(error as Error).message}`);
  }
}

// ============================================
// HEALTH CHECK
// ============================================

/**
 * Check if Claude API is accessible
 */
export async function checkClaudeHealth(): Promise<boolean> {
  try {
    const client = getAnthropicClient();
    return client !== null;
  } catch {
    return false;
  }
}

/**
 * Get current model configuration (for debugging)
 */
export function getModelConfig() {
  return {
    haiku: { ...HAIKU_CONFIG },
    sonnet: { ...SONNET_CONFIG },
  };
}
