// @level main
// Roadkeeper — a slice's plan, its one interface: the spec's `## Structure` section drawn on the project's structure, and
// what was built checked against it. It wires the plan's disk reads (lib/plan-files.mjs), its reading and check
// (lib/slice-plan.mjs) and its drawing (lib/slice-plan-drawing.mjs); everything under lib/ is private.
//
// What it reads, under the project root: the spec and the base structure.json at the paths given, and
// docs/roadkeeper/dependency-rules.md and structure.json. Writes nothing.

import { planFiles } from "./lib/plan-files.mjs";
import { planCheckLines } from "./lib/slice-plan.mjs";
import { planDrawLines } from "./lib/slice-plan-drawing.mjs";

// The plan in the spec at `specPath`, drawn as mermaid on the structure at `root`: { lines, failed }.
export const planDraw = (root, specPath) => planDrawLines(planFiles(root, specPath, null));

// What was built at `root` against the plan in the spec at `specPath`, from the base structure.json at `basePath`, or
// null when the slice adds structure.json: { lines, failed }.
export const planCheck = (root, specPath, basePath) => planCheckLines(planFiles(root, specPath, basePath), { noBase: basePath === null });
