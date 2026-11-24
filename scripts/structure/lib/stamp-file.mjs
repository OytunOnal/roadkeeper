// @level application
// Roadkeeper — the stamp's use case: structure.json read, and stamped from the disk's facts into the text to write in its
// place. What it calls is handed in by the module's entry, as one object `adapters`: { structureFiles(), the structure
// files through the one guarded read (disk-reads.mjs); facts(sm), the disk's facts about the model's modules
// (disk-facts.mjs); refusedLines(sm, facts), the structure report's disk-unread lines, cut as the check cuts a group
// (report-lines.mjs) }. Writes nothing.

import { parseJsonText } from "./parse-json-text.mjs";
import { structureModel } from "./structure-model.mjs";
import { stampData } from "./staleness-digest.mjs";

const isGraph = (data) => data !== null && typeof data === "object" && Array.isArray(data.modules);

// structure.json's data, an object with modules, stamped in place from the disk under the rules text `md`: { text,
// files, digest }, the text to write, the files stamped and the digest; or { refused }, the lines refusing it, and then
// the data is untouched.
export function stampedText(data, md, adapters) {
  const sm = structureModel(md, JSON.stringify(data));
  const facts = adapters.facts(sm);
  const stamped = stampData(data, sm, facts);
  if (stamped.refused) return { refused: adapters.refusedLines(sm, facts) };
  return { text: JSON.stringify(data, null, 1) + "\n", files: stamped.files, digest: data.digest };
}

// structure.json stamped from the disk: { text, files, digest }, as stampedText gives them; or { refused, why }, the
// lines that refused it, or why none was read.
export function stampFile(adapters) {
  const read = adapters.structureFiles();
  if (read.why) return { refused: [], why: read.why };
  const data = read.js ? parseJsonText(read.js) : null;
  if (!isGraph(data)) return { refused: [], why: "docs/roadkeeper/structure.json is missing, a link, over the cap or not an object with modules" };
  const stamped = stampedText(data, read.md || "", adapters);
  return stamped.refused ? { refused: stamped.refused, why: null } : stamped;
}
