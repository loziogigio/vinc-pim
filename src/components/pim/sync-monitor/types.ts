export interface ChannelGap {
  channel: string;
  published: number;
  indexed: number;
  missing: number;
  stale: number;
  in_sync: boolean;
}

export interface ScanResponse {
  success: boolean;
  solr_available: boolean;
  scanned_at?: string;
  channels: ChannelGap[];
  totals: ChannelGap;
}

export interface GapDetailRow {
  entity_code: string;
  sku?: string;
  name?: Record<string, string> | string;
  status?: string;
  source_job_id?: string;
  solr_indexed_at?: string | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type GapType = "missing" | "stale";
