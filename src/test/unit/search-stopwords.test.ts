import { describe, it, expect } from 'vitest';
import { filterSearchStopwords } from '@/lib/search/stopwords';

describe('unit: filterSearchStopwords', () => {
  // ── Core behavior ────────────────────────────────────────────

  it('should remove Italian stopwords from middle positions', () => {
    // "macchina per caffè" → "per" removed
    const result = filterSearchStopwords(['macchina', 'per', 'caffè'], 'it');
    expect(result).toEqual(['macchina', 'caffè']);
  });

  it('should remove stopword even when it is the last term', () => {
    // "macchina per" → "per" is a stopword → remove it
    // (phrase boost uses rawTerms separately for ranking)
    const result = filterSearchStopwords(['macchina', 'per'], 'it');
    expect(result).toEqual(['macchina']);
  });

  it('should remove stopword from last position: "contro lama per"', () => {
    // Real-world case: "Contro lama per" should match "Contro lama per troncarami"
    const result = filterSearchStopwords(['contro', 'lama', 'per'], 'it');
    expect(result).toEqual(['contro', 'lama']);
  });

  it('should remove multiple stopwords from all positions', () => {
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
    // "il la caffè" → "il" and "la" are stopwords, "caffè" kept
    const result = filterSearchStopwords(['il', 'la', 'caffè'], 'it');
    expect(result).toEqual(['caffè']);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should return original when ALL terms are stopwords', () => {
    // "il la per" → all stopwords → fallback to original
    const result = filterSearchStopwords(['il', 'la', 'per'], 'it');
    expect(result).toEqual(['il', 'la', 'per']);
  });

  // ── English ──────────────────────────────────────────────────

  it('should remove English stopwords from all positions', () => {
    const result = filterSearchStopwords(['machine', 'for', 'coffee'], 'en');
    expect(result).toEqual(['machine', 'coffee']);
  });

  it('should remove English stopword as last term', () => {
    const result = filterSearchStopwords(['coffee', 'for'], 'en');
    expect(result).toEqual(['coffee']);
  });

  // ── German ───────────────────────────────────────────────────

  it('should remove German stopwords from all positions', () => {
    const result = filterSearchStopwords(['tisch', 'für', 'küche'], 'de');
    expect(result).toEqual(['tisch', 'küche']);
  });

  // ── French ───────────────────────────────────────────────────

  it('should remove French stopwords from all positions', () => {
    const result = filterSearchStopwords(['machine', 'pour', 'café'], 'fr');
    expect(result).toEqual(['machine', 'café']);
  });

  // ── Spanish ──────────────────────────────────────────────────

  it('should remove Spanish stopwords from all positions', () => {
    const result = filterSearchStopwords(['mesa', 'para', 'cocina'], 'es');
    expect(result).toEqual(['mesa', 'cocina']);
  });

  // ── Portuguese ───────────────────────────────────────────────

  it('should remove Portuguese stopwords from all positions', () => {
    const result = filterSearchStopwords(['mesa', 'para', 'cozinha'], 'pt');
    expect(result).toEqual(['mesa', 'cozinha']);
  });

  // ── Dutch ────────────────────────────────────────────────────

  it('should remove Dutch stopwords from all positions', () => {
    const result = filterSearchStopwords(['tafel', 'voor', 'keuken'], 'nl');
    expect(result).toEqual(['tafel', 'keuken']);
  });

  // ── Russian ──────────────────────────────────────────────────

  it('should remove Russian stopwords from all positions', () => {
    const result = filterSearchStopwords(['стол', 'для', 'кухни'], 'ru');
    expect(result).toEqual(['стол', 'кухни']);
  });

  // ── Arabic ───────────────────────────────────────────────────

  it('should remove Arabic stopwords from all positions', () => {
    const result = filterSearchStopwords(['طاولة', 'في', 'المطبخ'], 'ar');
    expect(result).toEqual(['طاولة', 'المطبخ']);
  });

  // ── Japanese ─────────────────────────────────────────────────

  it('should remove Japanese stopwords from all positions', () => {
    const result = filterSearchStopwords(['コーヒー', 'の', 'マシン'], 'ja');
    expect(result).toEqual(['コーヒー', 'マシン']);
  });

  // ── Thai ─────────────────────────────────────────────────────

  it('should remove Thai stopwords from all positions', () => {
    const result = filterSearchStopwords(['โต๊ะ', 'ใน', 'ครัว'], 'th');
    expect(result).toEqual(['โต๊ะ', 'ครัว']);
  });

  // ── Hindi ────────────────────────────────────────────────────

  it('should remove Hindi stopwords from all positions', () => {
    const result = filterSearchStopwords(['मेज', 'के', 'लिए'], 'hi');
    expect(result).toEqual(['मेज']);
  });
});
