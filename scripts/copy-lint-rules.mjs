#!/usr/bin/env node
// @level main
// Roadkeeper — the plugin's lint rules copied into a project: `node <roadkeeper>/scripts/copy-lint-rules.mjs [--root <path>]`.
//
// Acts on the root of the worktree holding --root's folder, resolved against the working directory, else the directory
// it is run in (scripts/_root-option.mjs). Writes scripts/lint/'s files, the shape preset and Roadkeeper's rules, into
// roadkeeper-lint/ at that root, the folder emptied first, so the copy matches the plugin's whole; the project's ESLint config
// loads roadkeeper-lint/lint.mjs, and the green refuses a copy that differs (scripts/project-tools/).
//
// Exits 0 copied, 2 refused with nothing written: a usage error, no git repository, no Roadkeeper docs folder, roadkeeper-lint a
// link or not a folder.

import { rootOption } from "./_root-option.mjs";
import { copyLintRules } from "./project-tools/project-tools.mjs";

const { root, rest, refused } = rootOption(process.argv.slice(2));
if (refused || rest.length) {
  process.stdout.write("usage: copy-lint-rules.mjs [--root <path>]\n");
  process.exit(2);
}
process.exitCode = copyLintRules(root, (line) => { process.stdout.write(line + "\n"); });
