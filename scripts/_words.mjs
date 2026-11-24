// @level presentation
// Roadkeeper — the words the pages share for a person to read: text escaped for a page, a count as a page says it.

import { plural } from "./_text.mjs";

export const escapeHtml = (text) => String(text == null ? "" : text)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// A count as a page says it, never a bare 0: `zero` at 0; else the number, with plural's noun when `one` is given. The
// Architecture tab embeds it beside plural.
export function countInWords(n, zero, one) {
  if (!n) return zero;
  return one ? plural(n, one) : String(n);
}
