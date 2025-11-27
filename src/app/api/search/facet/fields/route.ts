/**
 * GET /api/search/facet/fields
 * Discover available facet fields including dynamic attribute fields
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSolrConfig, isSolrEnabled, FACET_FIELDS_CONFIG } from '@/lib/search/facet-config';

interface FieldInfo {
  name: string;
  type: 'static' | 'attribute' | 'dynamic';
  label: string;
  facet_type?: string;
  value_type?: 'string' | 'float' | 'boolean';
  docs_count?: number;
}

export async function GET(request: NextRequest) {
  try {
    // Check if Solr is enabled
    if (!isSolrEnabled()) {
      return NextResponse.json(
        {
          error: 'Faceting is not available',
          details: {
            code: 'SOLR_DISABLED',
            message: 'Solr search is not enabled. Set SOLR_ENABLED=true to enable.',
          },
        },
        { status: 503 }
      );
    }

    const config = getSolrConfig();
    const solrUrl = `${config.url}/${config.core}`;

    // Get all fields from Solr using Luke handler (without show=schema to get indexed fields)
    const lukeResponse = await fetch(`${solrUrl}/admin/luke?wt=json`);
    if (!lukeResponse.ok) {
      throw new Error(`Failed to fetch Solr schema: ${lukeResponse.statusText}`);
    }

    const lukeData = await lukeResponse.json();
    const fields = lukeData.fields || {};

    // Categorize fields
    const staticFields: FieldInfo[] = [];
    const attributeFields: FieldInfo[] = [];
    const dynamicFields: FieldInfo[] = [];

    for (const [fieldName, fieldData] of Object.entries(fields as Record<string, any>)) {
      // Skip internal fields
      if (fieldName.startsWith('_')) continue;

      // Check if it's a configured static facet field
      if (FACET_FIELDS_CONFIG[fieldName]) {
        staticFields.push({
          name: fieldName,
          type: 'static',
          label: FACET_FIELDS_CONFIG[fieldName].label,
          facet_type: FACET_FIELDS_CONFIG[fieldName].type,
          docs_count: fieldData.docs,
        });
      }
      // Check if it's a dynamic attribute field (attribute_*_s, attribute_*_f, attribute_*_b pattern)
      else if (fieldName.startsWith('attribute_') && /_(s|f|b)$/.test(fieldName)) {
        // Extract attribute key and type from field name: attribute_colore_s -> colore, string
        const suffix = fieldName.slice(-1); // Get last character (s, f, b)
        const attrKey = fieldName.slice(10, -2); // Remove 'attribute_' prefix and '_X' suffix
        const attrLabel = attrKey
          .replace(/_/g, ' ')
          .replace(/-/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        const valueType = suffix === 's' ? 'string' : suffix === 'f' ? 'float' : 'boolean';

        attributeFields.push({
          name: fieldName,
          type: 'attribute',
          label: attrLabel,
          facet_type: valueType === 'float' ? 'range' : 'flat',
          value_type: valueType,
          docs_count: fieldData.docs,
        });
      }
      // Other dynamic fields that might be useful for faceting
      else if (
        fieldName.endsWith('_s') ||
        fieldName.endsWith('_ss') ||
        fieldName.endsWith('_b')
      ) {
        // Skip text fields and JSON fields
        if (fieldName.includes('_text_') || fieldName.endsWith('_json')) continue;

        dynamicFields.push({
          name: fieldName,
          type: 'dynamic',
          label: fieldName,
          docs_count: fieldData.docs,
        });
      }
    }

    // Sort by docs count (most used first)
    attributeFields.sort((a, b) => (b.docs_count || 0) - (a.docs_count || 0));

    return NextResponse.json({
      success: true,
      data: {
        static_fields: staticFields,
        attribute_fields: attributeFields,
        dynamic_fields: dynamicFields,
        total_attribute_fields: attributeFields.length,
      },
    });
  } catch (error) {
    console.error('Facet fields discovery error:', error);

    return NextResponse.json(
      {
        error: 'Failed to discover facet fields',
        details: {
          code: 'DISCOVERY_ERROR',
          message: (error as Error).message,
        },
      },
      { status: 500 }
    );
  }
}
