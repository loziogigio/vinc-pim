/**
 * Test script for ELIA intent extraction
 * Run with: pnpm dotenv -e .env -- vite-node scripts/test-elia-intent.ts
 */

import Anthropic from '@anthropic-ai/sdk';

const INTENT_EXTRACTION_PROMPT = `Sei ELIA, un assistente AI per l'analisi delle ricerche prodotti.

DEVI usare il tool extract_intent con TUTTI i campi richiesti:
1. intent_type: scegli tra "ricerca", "confronto", "consiglio", "specifico"
2. exact_intent: oggetto con keywords (array di stringhe), price_max (numero se menzionato), attributes (oggetto vuoto {})
3. synonym_1: versione leggermente più ampia (keywords diverse)
4. synonym_2: versione ancora più ampia
5. synonym_3: versione più ampia possibile
6. user_message: una frase amichevole di risposta
7. confidence: numero tra 0 e 1

ESEMPIO per "cerco scarpe nike rosse":
{
  "intent_type": "ricerca",
  "exact_intent": {"keywords": ["scarpe", "nike", "rosse"], "attributes": {}},
  "synonym_1": {"keywords": ["scarpe", "nike"], "attributes": {}},
  "synonym_2": {"keywords": ["calzature", "sportive"], "attributes": {}},
  "synonym_3": {"keywords": ["scarpe"], "attributes": {}},
  "user_message": "Cerco scarpe Nike rosse per te!",
  "confidence": 0.9
}`;

const SCHEMA = {
  type: 'object' as const,
  properties: {
    intent_type: {
      type: 'string' as const,
      enum: ['ricerca', 'confronto', 'consiglio', 'specifico'],
    },
    exact_intent: {
      type: 'object' as const,
      properties: {
        keywords: { type: 'array' as const, items: { type: 'string' as const } },
        price_min: { type: 'number' as const },
        price_max: { type: 'number' as const },
        attributes: { type: 'object' as const, additionalProperties: true },
      },
      required: ['keywords'],
    },
    synonym_1: {
      type: 'object' as const,
      properties: {
        keywords: { type: 'array' as const, items: { type: 'string' as const } },
        price_min: { type: 'number' as const },
        price_max: { type: 'number' as const },
        attributes: { type: 'object' as const, additionalProperties: true },
      },
      required: ['keywords'],
    },
    synonym_2: {
      type: 'object' as const,
      properties: {
        keywords: { type: 'array' as const, items: { type: 'string' as const } },
        price_min: { type: 'number' as const },
        price_max: { type: 'number' as const },
        attributes: { type: 'object' as const, additionalProperties: true },
      },
      required: ['keywords'],
    },
    synonym_3: {
      type: 'object' as const,
      properties: {
        keywords: { type: 'array' as const, items: { type: 'string' as const } },
        price_min: { type: 'number' as const },
        price_max: { type: 'number' as const },
        attributes: { type: 'object' as const, additionalProperties: true },
      },
      required: ['keywords'],
    },
    user_message: { type: 'string' as const },
    confidence: { type: 'number' as const, minimum: 0, maximum: 1 },
  },
  required: ['intent_type', 'exact_intent', 'synonym_1', 'synonym_2', 'synonym_3', 'user_message', 'confidence'],
};

async function testIntentExtraction() {
  const apiKey = process.env.VINC_ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error('VINC_ANTHROPIC_API_KEY not set');
    process.exit(1);
  }

  console.log('API Key found:', apiKey.substring(0, 20) + '...');

  const client = new Anthropic({ apiKey });

  const query = 'cerco un telefono resistente all acqua sotto i 500 euro';

  console.log('\n=== Testing intent extraction ===');
  console.log('Query:', query);
  console.log('\n--- Calling Claude Haiku ---\n');

  try {
    const response = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2048,
      system: INTENT_EXTRACTION_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Analizza questa query: "${query}"`,
        },
      ],
      tools: [
        {
          name: 'extract_intent',
          description: 'Extract search intent from query',
          input_schema: SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: 'extract_intent' },
    });

    console.log('Response stop_reason:', response.stop_reason);
    console.log('Response content length:', response.content.length);

    for (const block of response.content) {
      console.log('\n--- Block type:', block.type, '---');

      if (block.type === 'tool_use') {
        console.log('Tool name:', block.name);
        console.log('Tool input type:', typeof block.input);
        console.log('Tool input:', JSON.stringify(block.input, null, 2));

        // Check structure
        const input = block.input as Record<string, unknown>;
        console.log('\n--- Validating structure ---');
        console.log('Has exact_intent?', !!input.exact_intent);
        console.log('exact_intent type:', typeof input.exact_intent);

        if (input.exact_intent && typeof input.exact_intent === 'object') {
          const ei = input.exact_intent as Record<string, unknown>;
          console.log('exact_intent.keywords:', ei.keywords);
        }
      } else if (block.type === 'text') {
        console.log('Text:', block.text);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testIntentExtraction();