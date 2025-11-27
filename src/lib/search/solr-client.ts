/**
 * Solr HTTP Client
 * Handles communication with Solr search engine
 */

import { getSolrConfig } from './facet-config';
import { SolrSearchResponse } from '@/lib/types/search';

export class SolrClient {
  private baseUrl: string;
  private core: string;

  constructor(url?: string, core?: string) {
    const config = getSolrConfig();
    this.baseUrl = url || config.url;
    this.core = core || config.core;
  }

  /**
   * Get the select endpoint URL
   */
  private getSelectUrl(): string {
    return `${this.baseUrl}/${this.core}/select`;
  }

  /**
   * Execute a search query using JSON request API
   */
  async search(query: SolrJsonQuery): Promise<SolrSearchResponse> {
    const url = this.getSelectUrl();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(query),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new SolrError(
          `Solr query failed: ${response.status}`,
          response.status,
          errorText
        );
      }

      const data = await response.json();
      return data as SolrSearchResponse;
    } catch (error) {
      if (error instanceof SolrError) {
        throw error;
      }
      throw new SolrError(
        `Solr connection failed: ${(error as Error).message}`,
        0,
        (error as Error).message
      );
    }
  }

  /**
   * Execute a search query using query parameters (legacy)
   */
  async searchParams(params: Record<string, string | string[]>): Promise<SolrSearchResponse> {
    const url = new URL(this.getSelectUrl());

    // Add wt=json for JSON response
    url.searchParams.set('wt', 'json');

    // Add all parameters
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, v));
      } else {
        url.searchParams.set(key, value);
      }
    }

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new SolrError(
          `Solr query failed: ${response.status}`,
          response.status,
          errorText
        );
      }

      const data = await response.json();
      return data as SolrSearchResponse;
    } catch (error) {
      if (error instanceof SolrError) {
        throw error;
      }
      throw new SolrError(
        `Solr connection failed: ${(error as Error).message}`,
        0,
        (error as Error).message
      );
    }
  }

  /**
   * Test connection to Solr
   */
  async ping(): Promise<boolean> {
    try {
      const pingUrl = `${this.baseUrl}/${this.core}/admin/ping`;
      const response = await fetch(pingUrl);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get core status
   */
  async getStatus(): Promise<SolrCoreStatus | null> {
    try {
      const statusUrl = `${this.baseUrl}/admin/cores?action=STATUS&core=${this.core}&wt=json`;
      const response = await fetch(statusUrl);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.status?.[this.core] || null;
    } catch {
      return null;
    }
  }
}

// ============================================
// SOLR JSON QUERY TYPES
// ============================================

export interface SolrJsonQuery {
  query: string;
  filter?: string[];
  sort?: string;
  offset?: number;
  limit?: number;
  fields?: string | string[];
  facet?: SolrJsonFacet;
  params?: Record<string, any>;
}

export interface SolrJsonFacet {
  [field: string]: SolrJsonFacetField | number;
}

export interface SolrJsonFacetField {
  type: 'terms' | 'range' | 'query';
  field: string;
  limit?: number;
  mincount?: number;
  sort?: 'count' | 'index';
  // For range facets
  start?: number;
  end?: number;
  gap?: number;
  // For nested facets
  facet?: SolrJsonFacet;
}

// ============================================
// ERROR HANDLING
// ============================================

export class SolrError extends Error {
  public readonly statusCode: number;
  public readonly details: string;

  constructor(message: string, statusCode: number, details: string) {
    super(message);
    this.name = 'SolrError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

// ============================================
// TYPES
// ============================================

export interface SolrCoreStatus {
  name: string;
  instanceDir: string;
  dataDir: string;
  config: string;
  schema: string;
  startTime: string;
  uptime: number;
  index: {
    numDocs: number;
    maxDoc: number;
    deletedDocs: number;
    indexHeapUsageBytes: number;
    version: number;
    segmentCount: number;
    current: boolean;
    hasDeletions: boolean;
    directory: string;
    segmentsFile: string;
    segmentsFileSizeInBytes: number;
    userData: Record<string, string>;
    sizeInBytes: number;
    size: string;
  };
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let solrClientInstance: SolrClient | null = null;

/**
 * Get singleton Solr client instance
 */
export function getSolrClient(): SolrClient {
  if (!solrClientInstance) {
    solrClientInstance = new SolrClient();
  }
  return solrClientInstance;
}
