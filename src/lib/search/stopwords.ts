/**
 * Stopwords by language — common articles, prepositions, conjunctions, and
 * function words that Solr's text analyzers remove at index time.
 *
 * Because Solr removes these during indexing, requiring them in a query
 * (AND logic) causes zero results.  We filter them client-side from ALL
 * positions.  If all terms are stopwords, the original array is returned.
 *
 * Sources: standard Lucene / Solr stopword files (lang/stopwords_*.txt).
 * Only articles, prepositions, conjunctions, pronouns, and the most
 * common auxiliaries are included — rare verb conjugations are omitted
 * since they almost never appear in product searches.
 */

const STOPWORDS: Record<string, Set<string>> = {
  // ── Italian ──────────────────────────────────────────────────────
  it: new Set([
    // articles
    'il', 'lo', 'la', 'i', 'gli', 'le', 'l', 'un', 'una', 'uno',
    // prepositions & contracted forms
    'a', 'ad', 'al', 'alla', 'alle', 'allo', 'agli', 'ai',
    'da', 'dal', 'dalla', 'dalle', 'dallo', 'dagli', 'dai',
    'di', 'del', 'della', 'delle', 'dello', 'degli', 'dei',
    'in', 'nel', 'nella', 'nelle', 'nello', 'negli', 'nei',
    'su', 'sul', 'sulla', 'sulle', 'sullo', 'sugli', 'sui',
    'con', 'col', 'per', 'tra', 'fra',
    // conjunctions & misc
    'e', 'ed', 'o', 'ma', 'che', 'se', 'come', 'non', 'ne', 'ci',
    // pronouns
    'io', 'tu', 'lui', 'lei', 'noi', 'voi', 'loro',
    'mi', 'ti', 'si', 'vi', 'li', 'ce', 'me',
    // demonstratives
    'questo', 'questa', 'questi', 'queste',
    'quello', 'quella', 'quelli', 'quelle',
    // common auxiliaries
    'è', 'sono', 'ha', 'ho', 'hai', 'hanno',
  ]),

  // ── English ──────────────────────────────────────────────────────
  en: new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by',
    'for', 'from', 'had', 'has', 'have', 'he', 'her', 'his',
    'if', 'in', 'into', 'is', 'it', 'its',
    'no', 'not', 'of', 'on', 'or', 'our',
    'she', 'so', 'such', 'than', 'that', 'the', 'their', 'them',
    'then', 'there', 'these', 'they', 'this', 'to',
    'was', 'we', 'were', 'what', 'which', 'who', 'will', 'with',
    'you', 'your',
  ]),

  // ── German ───────────────────────────────────────────────────────
  de: new Set([
    // articles
    'der', 'die', 'das', 'den', 'dem', 'des',
    'ein', 'eine', 'einem', 'einen', 'einer', 'eines',
    // prepositions
    'an', 'am', 'auf', 'aus', 'bei', 'bis', 'durch',
    'für', 'gegen', 'hinter', 'in', 'im', 'ins',
    'mit', 'nach', 'neben', 'ohne', 'seit',
    'über', 'um', 'unter', 'von', 'vom', 'vor',
    'während', 'wegen', 'zu', 'zum', 'zur', 'zwischen',
    // conjunctions & misc
    'und', 'oder', 'aber', 'als', 'auch', 'da', 'dass',
    'denn', 'doch', 'es', 'ich', 'ist', 'nicht', 'noch',
    'nur', 'ob', 'so', 'sich', 'sie', 'sind', 'was',
    'wenn', 'wie', 'wir',
  ]),

  // ── French ───────────────────────────────────────────────────────
  fr: new Set([
    // articles
    'le', 'la', 'les', 'l', 'un', 'une', 'des', 'du', 'de',
    // prepositions
    'à', 'au', 'aux', 'avec', 'chez', 'dans', 'en', 'entre',
    'par', 'pour', 'sans', 'sous', 'sur', 'vers',
    // conjunctions & misc
    'et', 'ou', 'mais', 'ni', 'car', 'que', 'qui', 'dont',
    'ce', 'ces', 'est', 'il', 'ils', 'elle', 'elles',
    'je', 'tu', 'nous', 'vous', 'on', 'ne', 'pas', 'se',
    'son', 'sa', 'ses', 'leur', 'leurs',
  ]),

  // ── Spanish ──────────────────────────────────────────────────────
  es: new Set([
    // articles
    'el', 'la', 'las', 'lo', 'los', 'un', 'una', 'unas', 'unos',
    // prepositions
    'a', 'al', 'ante', 'con', 'contra', 'de', 'del', 'desde',
    'en', 'entre', 'hacia', 'hasta', 'para', 'por',
    'sin', 'sobre', 'tras',
    // conjunctions & misc
    'y', 'e', 'o', 'u', 'ni', 'que', 'pero', 'como',
    'es', 'no', 'se', 'su', 'sus',
    'me', 'te', 'le', 'nos', 'os', 'les',
  ]),

  // ── Portuguese ───────────────────────────────────────────────────
  pt: new Set([
    // articles
    'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
    // prepositions & contractions
    'ao', 'aos', 'da', 'das', 'de', 'do', 'dos',
    'em', 'na', 'nas', 'no', 'nos', 'num', 'numa',
    'com', 'para', 'por', 'pelo', 'pela', 'pelos', 'pelas',
    'entre', 'sem', 'sob', 'sobre',
    // conjunctions & misc
    'e', 'ou', 'mas', 'que', 'se', 'como',
    'eu', 'tu', 'ele', 'ela', 'nós', 'eles', 'elas',
    'é', 'são', 'não', 'mais',
  ]),

  // ── Dutch ────────────────────────────────────────────────────────
  nl: new Set([
    // articles
    'de', 'het', 'een',
    // prepositions
    'aan', 'bij', 'door', 'in', 'met', 'na', 'naar',
    'om', 'op', 'over', 'te', 'tot', 'uit', 'van', 'voor',
    // conjunctions & misc
    'en', 'of', 'maar', 'dat', 'die', 'dit', 'er',
    'hij', 'zij', 'ze', 'het', 'ik', 'je', 'we', 'wij',
    'is', 'zijn', 'was', 'niet', 'ook', 'al', 'als',
    'dan', 'nog', 'wel', 'geen', 'meer',
  ]),

  // ── Russian ──────────────────────────────────────────────────────
  ru: new Set([
    'а', 'без', 'в', 'во', 'для', 'до', 'за', 'и', 'из',
    'к', 'ко', 'на', 'не', 'но', 'о', 'об', 'от',
    'по', 'при', 'с', 'со', 'у', 'что',
    'как', 'или', 'это', 'все', 'он', 'она', 'они',
    'мы', 'вы', 'я', 'его', 'её', 'их',
    'был', 'была', 'были', 'будет', 'есть',
    'так', 'уже', 'да', 'нет', 'ни', 'же', 'бы',
  ]),

  // ── Arabic ───────────────────────────────────────────────────────
  ar: new Set([
    'في', 'من', 'على', 'إلى', 'عن', 'مع', 'هذا', 'هذه',
    'ذلك', 'تلك', 'التي', 'الذي', 'التى', 'الذين',
    'هو', 'هي', 'هم', 'هن', 'أنا', 'نحن', 'أنت',
    'ال', 'و', 'أو', 'ثم', 'لكن', 'بل',
    'لا', 'لم', 'لن', 'قد', 'ما', 'إن', 'أن',
    'كان', 'كانت', 'يكون', 'بعد', 'قبل', 'بين',
    'كل', 'غير', 'حتى', 'عند', 'أي',
  ]),

  // ── Japanese ─────────────────────────────────────────────────────
  // Japanese stopwords are mainly handled by Solr's part-of-speech filter.
  // Only the most common particles are listed here as a safety net.
  ja: new Set([
    'の', 'に', 'は', 'を', 'た', 'が', 'で', 'て', 'と', 'し',
    'れ', 'さ', 'ある', 'いる', 'も', 'する', 'から', 'な', 'こと',
    'として', 'い', 'や', 'れる', 'など', 'なっ', 'ない', 'この',
    'ため', 'その', 'あっ', 'よう', 'また', 'もの', 'という',
    'あり', 'まで', 'られ', 'なる', 'へ', 'か', 'だ', 'これ',
    'によって', 'により', 'おり', 'より', 'による', 'ず', 'なり',
    'られる', 'において', 'に対して', 'ほか', 'ながら', 'うち',
    'そして', 'とともに', 'ただし', 'かつて', 'それぞれ',
    'または', 'お', 'ほど', 'ものの', 'に対する',
  ]),

  // ── Thai ─────────────────────────────────────────────────────────
  th: new Set([
    'การ', 'และ', 'ใน', 'ที่', 'จะ', 'ของ', 'ได้', 'มี',
    'ไม่', 'ให้', 'เป็น', 'กับ', 'แต่', 'หรือ', 'จาก',
    'โดย', 'ว่า', 'แล้ว', 'นี้', 'ก็', 'อยู่', 'ไป',
    'มา', 'ขึ้น', 'คือ', 'เมื่อ', 'ถ้า', 'ซึ่ง', 'อัน',
  ]),

  // ── Hindi ────────────────────────────────────────────────────────
  hi: new Set([
    'का', 'के', 'की', 'को', 'में', 'है', 'हैं', 'से',
    'पर', 'ने', 'यह', 'वह', 'और', 'या', 'एक',
    'नहीं', 'भी', 'तो', 'कि', 'जो', 'इस', 'उस',
    'अपने', 'लिए', 'कर', 'था', 'थी', 'थे', 'हो',
    'सब', 'कुछ', 'जब', 'तक', 'साथ', 'अब', 'वे',
  ]),
};

/**
 * Filter stopwords from search terms.
 * - Stopwords are removed because Solr strips them at index time,
 *   so requiring them in a query (AND logic) causes zero results.
 * - ALL positions are filtered, including the last term.
 * - If filtering would remove ALL terms, returns the original array.
 */
export function filterSearchStopwords(terms: string[], lang: string): string[] {
  if (terms.length <= 1) return terms;

  const stopwords = STOPWORDS[lang];
  if (!stopwords) return terms;

  const filtered = terms.filter((term) => !stopwords.has(term));

  // Safety: never return empty — fall back to original if everything was filtered
  return filtered.length > 0 ? filtered : terms;
}
