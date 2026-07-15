import { describe, it, expect } from 'vitest';
import {
  getFacetConfig,
  getFilterField,
  FILTER_FIELD_MAP,
} from '@/lib/search/facet-config';

describe('promo_code facet config', () => {
  it('exposes promo_code as a flat "Promozione" facet', () => {
    const cfg = getFacetConfig('promo_code');
    expect(cfg).toBeDefined();
    expect(cfg?.type).toBe('flat');
    expect(cfg?.label).toBe('Promozione');
  });

  it('maps promo_code filter to the real Solr field', () => {
    expect(getFilterField('promo_code')).toBe('promo_code');
  });

  it('fixes the stale promo_codes mapping to the singular Solr field', () => {
    expect(FILTER_FIELD_MAP['promo_codes']).toBe('promo_code');
    expect(getFilterField('promo_codes')).toBe('promo_code');
  });
});
