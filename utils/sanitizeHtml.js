const sanitizeHtml = require("sanitize-html");

// Allowlist covers every rich-content requirement for FAQ answers (headings,
// paragraphs, bold/italic/underline, lists, links, images, tables,
// blockquotes, horizontal dividers) while stripping scripts, event handlers,
// and javascript: URLs regardless of what the admin editor sends.
const ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "br", "hr",
  "b", "strong", "i", "em", "u",
  "ul", "ol", "li",
  "a", "img",
  "table", "thead", "tbody", "tr", "td", "th",
  "blockquote", "span", "div",
];

const ALLOWED_ATTRIBUTES = {
  a: ["href", "target", "rel"],
  img: ["src", "alt", "width", "height"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan"],
  table: ["border"],
};

function sanitizeFaqAnswer(html) {
  if (!html) return html;
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "data"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  });
}

// The allowlist above is content-type agnostic — it was written for FAQ
// answers but describes "rich text an admin may author" in general. Exported
// under a neutral name too so Service Detail bodies can reuse the exact same
// rules without reading as if they were FAQ answers. Same function, one
// allowlist to maintain.
const sanitizeRichText = sanitizeFaqAnswer;

module.exports = { sanitizeFaqAnswer, sanitizeRichText };
