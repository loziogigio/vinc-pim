import { describe, it, expect } from 'vitest';
import { buildSearchQuery } from '@/lib/search/query-builder';
import type { SearchRequest } from '@/lib/types/search';

function fq(filters: SearchRequest['filters']): string[] {
  const q = buildSearchQuery({ lang: 'it', include_faceting: false, filters });
  return (q.filter as string[]) ?? [];
}

function clause(filters: SearchRequest['filters'], field: string): string {
  return fq(filters).find((c) => c.startsWith(`${field}:`)) ?? '';
}

// Regression: the b2b storefront sends multi-select facet values as a single
// comma-joined string over the POST/proxy path (e.g.
// filters.promo_code = "26-FUORI TUTTO,26-SUMMER"). Before the fix this was
// emitted as one quoted phrase (`promo_code:"26-FUORI TUTTO,26-SUMMER"`) which
// matches no product, so multi-select returned zero results. Assertions are
// structural (the value builder escapes hyphens and only quotes values that
// contain spaces) — what matters is that the string splits into an OR.
describe('buildFilterClause: comma-joined multi-select strings', () => {
  it('splits a comma-joined promo_code string into an OR of both codes', () => {
    const c = clause({ promo_code: '26-FUORI TUTTO,26-SUMMER' }, 'promo_code');
    expect(c).toContain(' OR ');
    expect(c).toContain('FUORI TUTTO'); // space-containing code preserved
    expect(c).toContain('SUMMER');
    // never the un-split single phrase that matches nothing
    expect(c).not.toContain('TUTTO,26');
  });

  it('trims whitespace around comma-separated values', () => {
    const c = clause({ promo_code: '26-SUMMER , 26-VOLPE' }, 'promo_code');
    expect(c).toContain(' OR ');
    expect(c).toContain('SUMMER');
    expect(c).toContain('VOLPE');
    expect(c).not.toContain(' , ');
  });

  it('splits comma-joined values without spaces (e.g. brand ids)', () => {
    expect(clause({ brand_id: '12,34' }, 'brand_id')).toBe('brand_id:(12 OR 34)');
  });

  it('leaves a single space-containing value as one quoted clause', () => {
    const c = clause({ promo_code: '26-FUORI TUTTO' }, 'promo_code');
    expect(c).not.toContain(' OR ');
    expect(c).toContain('FUORI TUTTO');
    expect(c.startsWith('promo_code:"')).toBe(true);
  });

  it('a single value with a trailing comma collapses to one clause', () => {
    const c = clause({ promo_code: '26-SUMMER,' }, 'promo_code');
    expect(c).not.toContain(' OR ');
    expect(c).toContain('SUMMER');
  });

  it('still accepts array-form multi-select (GET path) unchanged', () => {
    const c = clause({ promo_code: ['26-FUORI TUTTO', '26-SUMMER'] }, 'promo_code');
    expect(c).toContain(' OR ');
    expect(c).toContain('FUORI TUTTO');
    expect(c).toContain('SUMMER');
  });
});
