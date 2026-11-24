// @level presentation
// Roadkeeper — a reach (GLOSSARY.md, reached-lines.mjs's Reach) as the cards page says it: each file's lines, runs of
// consecutive numbers joined.

// A number list's runs of consecutive numbers, ascending: "2-3, 6".
function formatRanges(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const runs = [];
  for (const n of sorted) {
    const last = runs.at(-1);
    if (last && n === last[1] + 1) last[1] = n;
    else runs.push([n, n]);
  }
  return runs.map(([from, to]) => (from === to ? `${from}` : `${from}-${to}`)).join(", ");
}

// A reach as the page says it, files in path order: "src/math.mjs: lines 2-3; src/cli.mjs: line 1"; "" for none.
export const formatReach = (reach) => [...reach]
  .sort(([a], [b]) => (a < b ? -1 : Number(a > b)))
  .map(([path, lines]) => `${path}: ${lines.size === 1 ? "line" : "lines"} ${formatRanges(lines)}`)
  .join("; ");
