// @level presentation
// Roadkeeper — the structure command's closing lines for the graph it wrote (dependency-graph.mjs): what it holds, and
// the Python imports found nowhere. Pure.

import { plural } from "../../_text.mjs";
import { printable } from "./printable.mjs";

// the count of Python imports found nowhere names this many: enough to see which source root is missed
const NAMED_NOWHERE = 5;

// The structure command's closing line for a written graph, stamped `files` files.
export const graphLine = (data, files) =>
  `${data.modules.length} modules, ${Object.keys(data.levels).length} files with a level, ${data.edges.length} edges; ${files} files, digest ${data.digest.slice(0, 12)}`;

// The structure command's line counting the Python imports found nowhere, naming the first NAMED_NOWHERE; null for none.
export function foundNowhereLine(names) {
  if (!names.length) return null;
  const more = names.length > NAMED_NOWHERE ? `, and ${names.length - NAMED_NOWHERE} more` : "";
  const named = names.slice(0, NAMED_NOWHERE).map((n) => printable(n)).join(", ");
  return `${plural(names.length, "Python import")} found in no search place and not in the standard library: ${named}${more}`;
}
