import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Mongo pool: brands/categories/... collections return empty; the
// pimproducts aggregation returns the distinct promo_code → label pairs that
// loadPromoLabels expects to surface for facet enrichment.
const aggregate = vi.fn();
vi.mock('@/lib/db/connection', () => ({
  getPooledConnection: async () => ({
    db: {
      collection: (name: string) => ({
        find: () => ({ toArray: async () => [] }),
        aggregate: (...args: any[]) =>
          name === 'pimproducts'
            ? { toArray: async () => aggregate(...args) }
            : { toArray: async () => [] },
      }),
    },
  }),
}));

import { enrichFacetResults } from '@/lib/search/response-transformer';

beforeEach(() => {
  aggregate.mockReset();
  aggregate.mockResolvedValue([
    { _id: '26-SUMMER', label: { it: 'ESTATE 2026' } },
    { _id: '26-VOLPE', label: { it: 'VOLPE', en: 'FOX' } },
  ]);
});

describe('enrichFacetResults: promo_code buckets get server-side labels', () => {
  const facets = {
    promo_code: [
      { value: '26-SUMMER', count: 12 },
      { value: '26-VOLPE', count: 3 },
      { value: '26-UNKNOWN', count: 1 },
    ],
  } as any;

  it('attaches the campaign label to each known promo_code bucket', async () => {
    const out = await enrichFacetResults(facets, 'it', 'vinc-bellieforti-com', 'b2b');
    const byValue = Object.fromEntries(
      out.promo_code.map((v: any) => [v.value, v]),
    );
    expect(byValue['26-SUMMER'].label).toBe('ESTATE 2026');
    expect(byValue['26-VOLPE'].label).toBe('VOLPE');
    // entity is shipped too, so the b2b transformer can read entity.label per lang
    expect(byValue['26-SUMMER'].entity?.label).toEqual({ it: 'ESTATE 2026' });
  });

  it('resolves the requested language', async () => {
    const out = await enrichFacetResults(facets, 'en', 'vinc-bellieforti-com', 'b2b');
    const volpe = out.promo_code.find((v: any) => v.value === '26-VOLPE');
    expect(volpe.label).toBe('FOX');
  });

  it('leaves an unknown code untouched (no label invented)', async () => {
    const out = await enrichFacetResults(facets, 'it', 'vinc-bellieforti-com', 'b2b');
    const unknown = out.promo_code.find((v: any) => v.value === '26-UNKNOWN');
    expect(unknown.label).toBeUndefined();
    expect(unknown.entity).toBeUndefined();
  });

  it('aggregates only the live SCD-2 version via the isCurrent flag', async () => {
    // Distinct tenantDb → cache miss, so loadPromoLabels actually calls aggregate
    // (the module-level promo cache is keyed by tenantDb and persists across tests).
    await enrichFacetResults(facets, 'it', 'vinc-iscurrent-probe', 'b2b');
    const pipeline = aggregate.mock.calls[0]?.[0] ?? [];
    const match = pipeline.find((s: any) => s?.$match)?.$match ?? {};
    // Mongo uses camelCase `isCurrent`; the snake_case `is_current` (the Solr
    // field name) matches nothing and yields an empty label map.
    expect(match).toHaveProperty('isCurrent', true);
    expect(match).not.toHaveProperty('is_current');
  });
});
