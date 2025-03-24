/**
 * HTML entity decoder utilities using functional programming principles
 */

// Map of common HTML entities
const entities: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&ndash;': '–',
  '&mdash;': '—',
  '&lsquo;': `'`,
  '&rsquo;': `'`,
  '&ldquo;': `"`,
  '&rdquo;': `"`,
  '&hellip;': '…',
  '&copy;': '©',
  '&reg;': '®',
  '&trade;': '™',
};

/**
 * Replaces named HTML entities with their character equivalents
 * @param text - Input text with HTML entities
 * @returns Text with named entities replaced
 */
const replaceNamedEntities = (text: string): string => 
  Object.entries(entities).reduce(
    (result, [entity, char]) => result.replace(new RegExp(entity, 'g'), char),
    text
  );

/**
 * Replaces decimal numeric HTML entities (&#39;) with their character equivalents
 * @param text - Input text with decimal HTML entities
 * @returns Text with decimal entities replaced
 */
const replaceDecimalEntities = (text: string): string =>
  text.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));

/**
 * Replaces hexadecimal numeric HTML entities (&#x27;) with their character equivalents
 * @param text - Input text with hexadecimal HTML entities
 * @returns Text with hexadecimal entities replaced
 */
const replaceHexEntities = (text: string): string =>
  text.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

/**
 * Composes multiple functions into a single function
 * @param fns - Functions to compose (applied right to left)
 * @returns Composed function
 */
const compose = <T>(...fns: Array<(arg: T) => T>) => 
  (initial: T): T => fns.reduceRight((result, fn) => fn(result), initial);

/**
 * Recursively decodes HTML entities until no more entities are found
 * @param text - Input text with HTML entities
 * @returns Fully decoded text
 */
const recursiveDecode = (text: string): string => {
  const decoded = compose(
    replaceHexEntities,
    replaceDecimalEntities,
    replaceNamedEntities
  )(text);
  
  return decoded.includes('&') ? recursiveDecode(decoded) : decoded;
};

/**
 * Decodes HTML entities in a string
 * @param text - The text containing HTML entities
 * @returns The decoded text
 */
export const decodeHtmlEntities = (text: string): string => {
  if (!text) return '';
  return recursiveDecode(text);
}; 