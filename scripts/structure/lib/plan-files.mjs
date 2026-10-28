// @level infrastructure
// Roadkeeper — the plan command's disk work: the spec and the base structure.json at the paths given, each a plain file
// under its cap, and the structure files through the one guarded read (disk-reads.mjs). Writes nothing.

import { resolve } from "node:path";
import { readPlainFile } from "../../_files.mjs";
import { STRUCTURE_CAP } from "./structure-model.mjs";
import { SPEC_CAP } from "./slice-plan.mjs";
import { readStructureFiles } from "./disk-reads.mjs";

// The plan's files, each the text read or null: the spec and the base at the paths given from the root, the base null
// when no path is given; the structure files at theirs, both null when docs/roadkeeper is no plain folder.
export function planFiles(root, specPath, basePath) {
  const { md, js } = readStructureFiles(root);
  return {
    spec: readPlainFile(resolve(root, specPath), SPEC_CAP), md, js,
    base: basePath == null ? null : readPlainFile(resolve(root, basePath), STRUCTURE_CAP),
  };
}
