// @level infrastructure
// Roadkeeper — the check at write: a file just written judged by its project's `lintFile`, run from the root of the worktree
// holding it (command-run.mjs), the main checkout's install linked in when a linked worktree has none and pins what
// the main checkout pins (worktree.mjs), else the linter not run and that said; `{file}`, in any of its arguments, the
// file's path from that root. The stack's adapter reads the breaches from the run's output, its
// unused names left to the commit; each becomes a line built here, never the linter's message:
// `src/route.ts:88 max-lines-per-function 52 > 40`, a rule with no numbers `refused`, a rule id of an unknown shape
// `rule`. Judges nothing: a file outside the session's project, the clone holding the folder the caller names, its
// linked worktrees included (a repository nested in it or elsewhere is a stranger's, whose `lintFile` never runs); a
// file in no git worktree or no Roadkeeper project, a commands file missing or malformed or with no `lintFile`, or one with
// no `{file}`, a file git ignores, a path from the root starting with `-`.

import { dirname } from "node:path";
import { pathFrom } from "../../_files.mjs";
import { git } from "../../_git.mjs";
import { controlsReplaced, cutAt, plural } from "../../_text.mjs";
import { adapterOf } from "../adapters/adapters.mjs";
import { commandEnv, runCommandWithin } from "./command-run.mjs";
import { readCommands } from "./commands-file.mjs";
import { sameClone, worktreeInstall, worktreeRoot } from "./worktree.mjs";

const FILE = "{file}";             // lintFile's text the written file's path takes the place of
const LINT_TIMEOUT = 75 * 1000;    // milliseconds the linter may take: under the hook's 90 s, so the hook ends it
const LINES_SHOWN = 20;            // breaches said one by one; the rest counted
const PATH_SHOWN = 300;            // characters of the file's path shown
const RULE_SHOWN = 100;            // characters of a rule id shown; a longer one reads as of an unknown shape
const RULE_ID = /^(?:@[\w.-]+\/)?[A-Za-z][\w.-]*(?:\/[A-Za-z][\w.-]*)*$/; // `max-params`, `roadkeeper/named-condition`, `@scope/rule`

// The written file's path from the root of the worktree holding it, with `/`: { root, path }, or null outside one.
function placed(file) {
  const root = worktreeRoot(dirname(file));
  const path = root && pathFrom(root, file);
  return path ? { root, path } : null;
}

// whether git ignores the path at the root: run output and scratch, not the project's code
function ignored(root, path) {
  try { git(["check-ignore", "-q", "--", path], root); return true; } catch { return false; }
}

const isNumbers = (n) => Array.isArray(n) && n.length === 2 && n.every((x) => Number.isSafeInteger(x) && x >= 0);
const isRuleId = (rule) => typeof rule === "string" && rule.length <= RULE_SHOWN && RULE_ID.test(rule);

// A breach's line, built from its numbers and fixed words alone.
function breachLine(path, { line, rule, numbers }) {
  const at = Number.isSafeInteger(line) && line > 0 ? line : 1;
  const id = isRuleId(rule) ? rule : "rule";
  return `${path}:${at} ${id} ${isNumbers(numbers) ? `${numbers[0]} > ${numbers[1]}` : "refused"}`;
}

// The lint run's breaches for the written file: { breaches }, null when its output could not be read; or { said },
// the line saying why the main checkout's install is not linked, the linter not run. `run`: { root, path, commands }.
async function linted({ root, path, commands }) {
  const adapter = adapterOf(commands.stack);
  const { said } = worktreeInstall(root, commands.install);
  if (said) return { said };
  const argv = commands.lintFile.map((a) => a.replaceAll(FILE, path));
  const ran = await runCommandWithin(argv, { cwd: root, env: commandEnv(root), timeout: LINT_TIMEOUT });
  return { breaches: adapter.breaches({ file: path, output: ran.tail, passed: ran.passed }) };
}

// The judgement of the file just written at `file`, an absolute path, in the session whose project holds the folder
// `project`: a promise of { lines }, the refusal's lines, none when it passes or is not judged; { unread: true } when
// the linter's output could not be read; or { said }, the line saying to install in the worktree (worktree.mjs).
export async function writtenFileBreaches(file, project) {
  const at = placed(file);
  const ours = at && !at.path.startsWith("-") && sameClone(at.root, project);
  if (!ours) return { lines: [] };
  const { commands } = readCommands(at.root);
  const judged = commands?.lintFile?.some((a) => a.includes(FILE)) && !ignored(at.root, at.path);
  if (!judged) return { lines: [] };
  const { breaches, said } = await linted({ ...at, commands });
  if (said) return { said };
  if (!breaches) return { unread: true };
  const path = cutAt(controlsReplaced(at.path), PATH_SHOWN);
  const lines = breaches.slice(0, LINES_SHOWN).map((b) => breachLine(path, b));
  const more = breaches.length - lines.length;
  return { lines: more > 0 ? [...lines, `and ${plural(more, "breach", "breaches")} more`] : lines };
}
