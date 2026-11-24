// @level domain
// Roadkeeper — the structure check's module records: each module's files, the ones reached from outside, its entry
// skips and whether it is shallow, from structureModel's output and the check's ruled edges (rulings.mjs); and the code
// files of a list (codeFiles), as the check and the Architecture tab count them. A record in words is
// module-count-words.mjs's. Pure.

import { underPath } from "./path-match.mjs";
import { SOURCE } from "./source-paths.mjs";

// a list's code files (SOURCE), a stylesheet or a data file left out; null when the list is missing or empty, as for a
// module whose files the stamp did not list
export const codeFiles = (files) => (files && files.length ? files.filter((f) => SOURCE.test(f)) : null);

// Each module's record, for every module, uncapped (the page cuts its own fold; the stamp's open lines count what they
// do not show): its code files (SOURCE), a stylesheet or a data file the stamp lists left out; the ones an edge from
// outside it and its nested modules reaches (outside every module counts); and its entry skips as the edges' rulings
// count them, a file reached around an entry both uncovered and under an exception counted once, as uncovered (so
// `exceptedPast` holds only the files no uncovered reach also took). Where the stamp listed the module's files only its code files count as reached or past its interface, so
// a graph cannot report more than the module holds; `shallow`, whether its one listed code file, tests aside, is its
// entry and no module nests in it; `noEntry`, whether it has no one entry (several root files); and `pastCountedAt`, its
// own files reached around its entry by reaches counted at an outer module (countedAt).
export function moduleRecords(sm, edges, isTest) {
  const parents = new Set(sm.modules.map((m) => m.parent));
  const shallow = (m) => {
    const own = (codeFiles(m.files) || []).filter((f) => !isTest(f));
    return own.length === 1 && own[0] === m.entry && !parents.has(m.path);
  };
  const reached = new Map();
  for (const e of sm.edges) {
    if (e.fromModule && underPath(e.fromModule, e.toModule)) continue;
    if (!reached.has(e.toModule)) reached.set(e.toModule, new Set());
    reached.get(e.toModule).add(e.to);
  }
  const skips = entrySkips(edges), out = new Map();
  for (const m of sm.modules) {
    const sk = skips.get(m.path) || noSkips();
    const code = codeFiles(m.files), listed = code ? new Set(code) : null;
    const held = (s) => (listed ? [...s].filter((f) => listed.has(f)).length : s.size);
    out.set(m.path, {
      total: code ? code.length : null, reached: held(reached.get(m.path) || new Set()),
      pastInterface: held(sk.past), innerPast: [...sk.inner].sort(), exceptedPast: [...sk.excepted].filter((f) => !sk.past.has(f) && !sk.inner.has(f)).length, testsPast: sk.tests.size,
      shallow: shallow(m), noEntry: !m.entry, pastCountedAt: countedAt(sk.counted, m.entry, held),
    });
  }
  return out;
}

// a nested module's own files reached around its entry, the reach counted at an outer module: [outer module, how many]
// for each outer module, its entry left out, the files held as the record holds them
const countedAt = (counted, entry, held) =>
  [...counted].map(([outer, files]) => [outer, held(new Set([...files].filter((f) => f !== entry)))]).filter(([, n]) => n > 0);

const noSkips = () => ({ past: new Set(), inner: new Set(), excepted: new Set(), tests: new Set(), counted: new Map() });

// A module's entry-skipping edges as the check rules them, each counted at the outermost module it reaches past
// the entry of: the files of its own a violation reaches past an entry, apart the files of its inner modules, the ones an
// exception not yet due covers, and the ones a test reaches past the interface. An inner module's file is kept at the
// inner module too (`counted`), by the outer module it is counted at.
function entrySkips(checked) {
  const out = new Map();
  const at = (p) => { if (!out.has(p)) out.set(p, noSkips()); return out.get(p); };
  for (const e of checked.values()) {
    if (e.rulings.has("test-past-entry")) at(e.skipped).tests.add(e.to);
    if (!e.rulings.has("past-entry")) continue;
    const sk = at(e.skipped);
    if (e.rulings.has("excepted")) sk.excepted.add(e.to);
    else if (e.toModule === e.skipped) sk.past.add(e.to);
    else {
      sk.inner.add(e.to);
      const counted = at(e.toModule).counted;
      if (!counted.has(e.skipped)) counted.set(e.skipped, new Set());
      counted.get(e.skipped).add(e.to);
    }
  }
  return out;
}
