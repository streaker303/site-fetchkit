const DEFAULT_BLOCK_TAGS = [
  "address",
  "article",
  "aside",
  "blockquote",
  "br",
  "dd",
  "div",
  "dl",
  "dt",
  "figcaption",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul",
];

const ENTITY_MAP = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
};

function decodeEntity(entity) {
  if (entity.startsWith("#x")) {
    return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
  }
  if (entity.startsWith("#")) {
    return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
  }
  return ENTITY_MAP[entity] ?? `&${entity};`;
}

/**
 * Convert HTML into readable plain text for site scripts and adapters.
 *
 * This utility is intentionally small and dependency-free. It removes script,
 * style, and noscript content, keeps block-level breaks as newlines, decodes
 * common HTML entities, and collapses excessive blank lines.
 *
 * @param {string} html HTML content to normalize.
 * @param {object} [options] Formatting options.
 * @param {string[]} [options.blockTags] Tag names that should produce line breaks.
 * @returns {string} Plain text extracted from the HTML string.
 */
export function htmlToText(html, options = {}) {
  const blockTags = options.blockTags || DEFAULT_BLOCK_TAGS;
  const blockPattern = blockTags.join("|");

  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(new RegExp(`</?(${blockPattern})(\\s[^>]*)?>`, "gi"), "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&([a-zA-Z]+|#[0-9]+|#x[0-9a-fA-F]+);/g, (_, entity) => {
      try {
        return decodeEntity(entity);
      } catch {
        return `&${entity};`;
      }
    })
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
