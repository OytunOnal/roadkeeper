#!/usr/bin/env node
// @level main
// Roadkeeper — a slice's planned structure, run on a project's tree:
//   structure-plan.mjs [--root <path>] draw <spec>               the plan drawn on the current structure, as mermaid
//   structure-plan.mjs [--root <path>] check <spec> <base.json>  what was built against the plan; `--no-base` when
//                                                                the slice adds structure.json
// The tree is the one --root names, resolved against the working directory, else the directory it is run in; a --root
// with no value, given twice or naming no directory is a usage error (scripts/_root-option.mjs). <spec> holds the spec
// issue's body with its `## Structure` section; <base.json> is structure.json at the slice's base; both resolve against
// the working directory, as the usage says.
//
// Prints the structure module's answer (scripts/structure/, `planDraw` and `planCheck`), which reads the spec, the base
// and docs/roadkeeper/dependency-rules.md and structure.json; asks git nothing, runs no command, writes nothing. `check`
// exits 1 on any line but a seam's, 0 when the plan is as built. `draw` exits 1 when a line was unread, so a broken plan
// is not approved as drawn. Names print through `printable`.

import { resolve } from "node:path";
import { rootOption } from "./_root-option.mjs";
import { planCheck, planDraw } from "./structure/structure.mjs";

// what a usage error prints, alone
const USAGE = "usage: structure-plan.mjs [--root <path>] draw <spec> | check <spec> <base structure.json | --no-base>"
  + " — <spec> and <base structure.json> resolve against the working directory";
const say = (lines, code) => { process.stdout.write(lines.join("\n") + "\n"); process.exit(code); };

const { root, rest, refused } = rootOption(process.argv.slice(2));
const [mode, specPath, basePath] = rest;
const usable = !refused && Boolean(specPath) && (mode === "draw" || (mode === "check" && Boolean(basePath)));
if (!usable) say([USAGE], 2);
// a path the caller gives resolves against the working directory, or is absolute — a reviewer writes the base into its
// scratch
const spec = resolve(specPath);
const answer = mode === "draw" ? planDraw(root, spec) : planCheck(root, spec, basePath === "--no-base" ? null : resolve(basePath));
say(answer.lines, answer.failed ? 1 : 0);
