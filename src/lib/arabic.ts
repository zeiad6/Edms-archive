/**
 * Arabic text processing for search: normalization, stopword removal, and
 * light stemming. Improves recall for Arabic queries — e.g. "المستندات"
 * matches "مستند", "مستندات", "المستندات" via the shared stem "مستند".
 */

/** Arabic diacritics (tashkeel) and tatweel — removed before matching. */
const TASHKEEL = /[\u064B-\u0652\u0670\u0640]/g;

/** Normalize alef variants, teh marbuta, alef maqsura, and hamza carriers. */
export function normalizeArabic(input: string): string {
  return input
    .replace(TASHKEEL, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي");
}

/** Common Arabic function words — dropped from search queries. */
const ARABIC_STOPWORDS = new Set([
  "من", "في", "عن", "على", "الى", "حتى", "ثم", "او", "و", "ف", "ب", "ك", "ل",
  "ال", "ان", "ان", "قد", "كان", "هذا", "هذه", "ذلك", "تلك", "التي", "الذي",
  "الذين", "هو", "هي", "هم", "هن", "كانت", "مع", "عند", "بين", "خلال", "حول",
  "بعد", "قبل", "فوق", "تحت", "كل", "بعض", "اي", "ما", "ماذا", "كيف", "لماذا",
  "حيث", "اذا", "لكن", "بل", "ايضا", "نعم", "هناك", "هنا", "الان", "امام",
  "خلف", "داخل", "خارج", "اثناء", "غير", "او", "الي", "علي", "انتم", "نحن",
]);

/** Light Arabic stemmer: strips common prefixes and suffixes (longest first).
 * A prefix is only removed when the remainder is still a valid Arabic word
 * (≥ 3 letters) — otherwise "بحث" would lose its leading "ب". */
export function lightStemArabic(input: string): string {
  let w = input;
  const prefixMatch = /^(وال|فال|بال|كال|ال|و|ف|ب|ك|ل)/.exec(w);
  if (prefixMatch) {
    const rest = w.slice(prefixMatch[0].length);
    if (rest.length >= 3) w = rest;
  }
  w = w.replace(/(كما|هما|تان|تين|ون|ات|ان|ين|ها|ه|ة|ي|ا)$/, "");
  return w;
}

/**
 * Tokenize an Arabic query into search stems: split on whitespace, normalize,
 * drop stopwords and negation terms, then light-stem each remaining word.
 */
export function tokenizeArabicQuery(query: string): string[] {
  return query
    .split(/\s+/)
    .map((t) => normalizeArabic(t.trim()))
    .filter((t) => t.length > 1 && !t.startsWith("-") && !ARABIC_STOPWORDS.has(t))
    .map((t) => lightStemArabic(t))
    .filter((t) => t.length > 1);
}

/** Normalize a negation term (after the leading "-" is stripped). */
export function normalizeArabicTerm(term: string): string {
  return lightStemArabic(normalizeArabic(term));
}