// @level domain
// Roadkeeper — a reach (GLOSSARY.md), the lines of the project's code a run reached, and what a run lost against
// another: a Reach, a Map of a file's path from the root to the Set of its line numbers reached. V8's ranges are read
// into lines by v8-reached-lines.mjs; a reach is said by format-reach.mjs.

// A reach: a Map of a file's path from the root to the Set of its line numbers reached, `add` joining lines into it.
export class Reach extends Map {
  // `lines` (any iterable of line numbers) joined to the file's at `path`: this reach.
  add(path, lines) {
    const held = this.get(path) ?? new Set();
    for (const n of lines) held.add(n);
    return this.set(path, held);
  }
}

// The reaches joined: each file's lines reached by any of them.
export function joinReaches(reaches) {
  const joined = new Reach();
  for (const reach of reaches) for (const [path, lines] of reach) joined.add(path, lines);
  return joined;
}

// The lines `whole` reached that `left` did not, kept to those `within` holds when it is given: a reach.
export function linesLost(whole, left, within = null) {
  const lost = new Reach();
  for (const [path, lines] of whole) {
    const kept = left.get(path) ?? new Set();
    const gone = [...lines].filter((n) => !kept.has(n) && (!within || within.get(path)?.has(n)));
    if (gone.length) lost.add(path, gone);
  }
  return lost;
}
