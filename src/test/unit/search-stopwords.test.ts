import { describe, it, expect } from 'vitest';
import { filterSearchStopwords } from '@/lib/search/stopwords';

describe('unit: filterSearchStopwords', () => {
  // ── Core behavior ────────────────────────────────────────────

  it('should remove Italian stopwords from non-last positions', () => {
    // "macchina per caffè" → "per" is in the middle → remove it
    const result = filterSearchStopwords(['macchina', 'per', 'caffè'], 'it');
    expect(result).toEqual(['macchina', 'caffè']);
  });

  it('should keep stopword when it is the last term', () => {
    // "macchina per" → "per" is last → keep it (user may still be typing)
    const result = filterSearchStopwords(['macchina', 'per'], 'it');
    expect(result).toEqual(['macchina', 'per']);
  });

  it('should remove multiple stopwords from middle positions', () => {
    // "tavolo da pranzo per la cucina" → remove "da", "per", "la"
    const result = filterSearchStopwords(
      ['tavolo', 'da', 'pranzo', 'per', 'la', 'cucina'],
      'it'
    );
    expect(result).toEqual(['tavolo', 'pranzo', 'cucina']);
  });

  it('should not filter single-term queries', () => {
    const result = filterSearchStopwords(['per'], 'it');
    expect(result).toEqual(['per']);
  });

  it('should return original terms when no stopwords present', () => {
    const result = filterSearchStopwords(['macchina', 'caffè'], 'it');
    expect(result).toEqual(['macchina', 'caffè']);
  });

  it('should return original terms for unknown language', () => {
    const result = filterSearchStopwords(['macchina', 'per', 'caffè'], 'xx');
    expect(result).toEqual(['macchina', 'per', 'caffè']);
  });

  it('should not return empty array when all non-last terms are stopwords', () => {
    // "il la caffè" → "il" and "la" are stopwords, but result should still have at least "caffè"
    const result = filterSearchStopwords(['il', 'la', 'caffè'], 'it');
    expect(result).toEqual(['caffè']);
    expect(result.length).toBeGreaterThan(0);
  });

  // ── English ──────────────────────────────────────────────────

  it('should remove English stopwords from non-last positions', () => {
    const result = filterSearchStopwords(['machine', 'for', 'coffee'], 'en');
    expect(result).toEqual(['machine', 'coffee']);
  });

  it('should keep English stopword as last term', () => {
    const result = filterSearchStopwords(['coffee', 'for'], 'en');
    expect(result).toEqual(['coffee', 'for']);
  });

  // ── German ───────────────────────────────────────────────────

  it('should remove German stopwords from non-last positions', () => {
    const result = filterSearchStopwords(['tisch', 'für', 'küche'], 'de');
    expect(result).toEqual(['tisch', 'küche']);
  });

  // ── French ───────────────────────────────────────────────────

  it('should remove French stopwords from non-last positions', () => {
    const result = filterSearchStopwords(['machine', 'pour', 'café'], 'fr');
    expect(result).toEqual(['machine', 'café']);
  });

  // ── Spanish ──────────────────────────────────────────────────

  it('should remove Spanish stopwords from non-last positions', () => {
    const result = filterSearchStopwords(['mesa', 'para', 'cocina'], 'es');
    expect(result).toEqual(['mesa', 'cocina']);
  });

  // ── Portuguese ───────────────────────────────────────────────

  it('should remove Portuguese stopwords from non-last positions', () => {
    const result = filterSearchStopwords(['mesa', 'para', 'cozinha'], 'pt');
    expect(result).toEqual(['mesa', 'cozinha']);
  });

  // ── Dutch ────────────────────────────────────────────────────

  it('should remove Dutch stopwords from non-last positions', () => {
    const result = filterSearchStopwords(['tafel', 'voor', 'keuken'], 'nl');
    expect(result).toEqual(['tafel', 'keuken']);
  });

  // ── Russian ──────────────────────────────────────────────────

  it('should remove Russian stopwords from non-last positions', () => {
    const result = filterSearchStopwords(['стол', 'для', 'кухни'], 'ru');
    expect(result).toEqual(['стол', 'кухни']);
  });

  // ── Arabic ───────────────────────────────────────────────────

  it('should remove Arabic stopwords from non-last positions', () => {
    const result = filterSearchStopwords(['طاولة', 'في', 'المطبخ'], 'ar');
    expect(result).toEqual(['طاولة', 'المطبخ']);
  });

  // ── Japanese ─────────────────────────────────────────────────

  it('should remove Japanese stopwords from non-last positions', () => {
    const result = filterSearchStopwords(['コーヒー', 'の', 'マシン'], 'ja');
    expect(result).toEqual(['コーヒー', 'マシン']);
  });

  // ── Thai ─────────────────────────────────────────────────────

  it('should remove Thai stopwords from non-last positions', () => {
    const result = filterSearchStopwords(['โต๊ะ', 'ใน', 'ครัว'], 'th');
    expect(result).toEqual(['โต๊ะ', 'ครัว']);
  });

  // ── Hindi ────────────────────────────────────────────────────

  it('should remove Hindi stopwords from non-last positions', () => {
    const result = filterSearchStopwords(['मेज', 'के', 'लिए'], 'hi');
    expect(result).toEqual(['मेज', 'लिए']);
  });
});
