// @level application
// Roadkeeper — the structure digest's use case: which files it reads, how they group into modules, the facts the structure
// report reads, and the stamp written from them. The walk, the reads and the hashing are disk-facts.mjs's.
//
// A file belongs to the deepest module above it; outside every module only a source file (SOURCE) that no `## Tests`
// pattern names is read. What `## Ignore` names is taken out and counted.

import { SOURCE, globMatch, pathAndParents, structurePath } from "./structure-model.mjs";
import { rulings, testOf } from "./rulings.mjs";

// What a digest of these modules reads: { walked, the folders to walk, outer modules first so a nested one already read
// is passed over; reads(rel), whether a file met is read: a module's, or under the `loose` option a source file no
// module holds and no test pattern names; ignored(rel), whether ## Ignore takes it out; grouped(sorted), the files read
// by module, in declaration order, and the rest as `loose` }.
export function stalenessDigest(modulePaths, { ignore = [], tests = [], loose = false } = {}) {
  const mods = [...new Set(modulePaths)], modSet = new Set(mods);
  const deepest = (f) => { for (const p of pathAndParents(f)) if (modSet.has(p)) return p; return null; };
  const isTest = testOf(tests);
  return {
    walked: [...mods].sort(),
    reads: (rel) => deepest(rel) !== null || (loose && SOURCE.test(rel) && !isTest(rel)),
    // the patterns as structureModel read them: it keeps at most MAX_IGNORE
    ignored: (rel) => ignore.some((p) => globMatch(p, rel)),
    grouped: (sorted) => {
      const files = new Map(mods.map((m) => [m, []])), outside = [];
      for (const p of sorted) {
        const m = deepest(p);
        if (m) files.get(m).push(p); else outside.push(p);
      }
      return { files, loose: outside };
    },
  };
}

// The root files the walk did not read — ignored, absent, or under a skipped folder — in declaration order, each with
// why, in the words the check and the stamp print: the check reads them as unread and the stamp refuses them, so an
// interface is never out of the digest. `d` is a digest that passed its bounds.
export function rootFilesOffWalk(sm, d) {
  const read = new Set();
  for (const list of d.files.values()) for (const f of list) read.add(f);
  return sm.modules.flatMap((m) => m.rootFiles).filter((f) => !read.has(f))
    .map((file) => ({ file, why: d.ignored.has(file) ? "matches ## Ignore" : "is not on disk under its module, outside a skipped folder" }));
}

// The disk's facts about the model's modules, from a digest `d` of them, a plain object the structure report reads
// (the rulings' `facts`):
// - files: each module's files on disk, by its path, sorted; empty past a bound;
// - loose: the source files on disk no module holds and no test pattern names, sorted; empty past a bound;
// - digest, over: the digest, or null and the bound passed;
// - missing: the declared modules with no plain folder;
// - offWalk: the root files the walk did not read, each with why (none past a bound);
// - ignored: the files ## Ignore took out.
export function factsOf(sm, d) {
  return {
    files: Object.assign(Object.create(null), Object.fromEntries(d.files)), loose: d.loose, digest: d.digest, over: d.over, missing: d.missing,
    offWalk: d.digest ? rootFilesOffWalk(sm, d) : [], ignored: [...d.ignored],
  };
}

// structure.json's data, an object with modules, stamped in place from the model `sm` read from it and the disk's
// `facts`: each module's `files` and the files no module holds (`loose`), and the `digest` of their contents. Returns
// { files: the count stamped } or { refused: the structure report's disk-unread lines }, and then the data is
// untouched. A stale or hard line never refuses: the stamp fixes staleness, the check judges the rules.
export function stampData(data, sm, facts) {
  const { diskUnread } = rulings(sm, facts);
  if (diskUnread.length) return { refused: diskUnread };
  for (const mod of data.modules) {
    const p = mod ? structurePath(mod.path).path : null;
    if (p && Object.hasOwn(facts.files, p)) mod.files = facts.files[p];
  }
  data.loose = facts.loose;
  data.digest = facts.digest;
  return { files: Object.values(facts.files).reduce((n, l) => n + l.length, facts.loose.length) };
}
