// @level infrastructure
// Roadkeeper — the stamp's disk work: structure.json read through the one guarded read (disk-reads.mjs), and stamped from
// the disk's facts (disk-facts.mjs) into the text to write in its place. Writes nothing.

import { grouped, structureModel } from "./structure-model.mjs";
import { stampData } from "./staleness-digest.mjs";
import { diskFacts } from "./disk-facts.mjs";
import { readStructureFiles } from "./disk-reads.mjs";

const isGraph = (data) => data !== null && typeof data === "object" && Array.isArray(data.modules);

// structure.json's data, an object with modules, stamped in place from the disk under the rules text `md`: { text,
// files, digest }, the text to write, the files stamped and the digest; or { refused }, the structure report's
// disk-unread lines, cut as the check cuts a group, and then the data is untouched.
export function stampedText(root, data, md) {
  const sm = structureModel(md, JSON.stringify(data));
  const stamped = stampData(data, sm, diskFacts(root, sm));
  if (stamped.refused) return { refused: grouped(stamped.refused) };
  return { text: JSON.stringify(data, null, 1) + "\n", files: stamped.files, digest: data.digest };
}

// structure.json at `root` stamped from the disk: { text, files, digest }, as stampedText gives them; or { refused, why },
// the lines that refused it, or why none was read.
export function stampFile(root) {
  const read = readStructureFiles(root);
  if (read.why) return { refused: [], why: read.why };
  let data = null;
  try { data = read.js ? JSON.parse(read.js) : null; } catch { data = null; }
  if (!isGraph(data)) return { refused: [], why: "docs/roadkeeper/structure.json is missing, a link, over the cap or not an object with modules" };
  const stamped = stampedText(root, data, read.md || "");
  return stamped.refused ? { refused: stamped.refused, why: null } : stamped;
}
