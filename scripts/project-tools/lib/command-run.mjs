// @level infrastructure
// Roadkeeper — one command of a commands file run: an argument list, never through a shell, its program a bare name found
// on the PATH's absolute folders alone (scripts/_git.mjs, findProgram), never in the project's folder. On Windows, npm
// and npx run as node on npm's own scripts beside the node.exe found, and a program found only as a `.cmd` or `.bat`
// is refused: cmd.exe would read its arguments. Its output, both
// streams as they come, is kept to the last TAIL_CHARACTERS, or OUTPUT_CAP for a run read whole; the environment it
// gets drops the variables that point git at a repository. A run is ended at its bound, a step's growing with the files
// the index tracks, a test run's with its test files, and one ended so says it took longer than its bound.

import { spawn } from "node:child_process";
import { lstatSync } from "node:fs";
import { dirname, join } from "node:path";
import { findLocalGitVariables, findProgram, trackedFiles } from "../../_git.mjs";
import { controlsReplaced, cutAt } from "../../_text.mjs";
import { limitFor, ranOut } from "../../_time-limit.mjs";

const TAIL_CHARACTERS = 64 * 1024;   // output kept from a run: its last lines are what a red step shows
const OUTPUT_CAP = 16 * 1024 * 1024; // output kept from a test run read whole: a suite's case lines and their details
const NAME_SHOWN = 100;              // characters of a refused program's name shown
const COMMAND_TIMEOUT = 60 * 60 * 1000; // milliseconds a command may take before its allowance: far above a full test run's 500 s
// milliseconds each test file of a run adds to its bound: three times the slowest test file measured alone, 112.5 s
const TEST_RUN_PER_FILE = 340 * 1000;
// milliseconds each file the index tracks adds to a step's bound: three times the slowest step measured, the check at
// 8.7 ms a tracked file
const STEP_PER_FILE = 27;

// A test run's bound for `count` test files: COMMAND_TIMEOUT and TEST_RUN_PER_FILE a file.
export const testRunLimit = (count) => limitFor({ floor: COMMAND_TIMEOUT, perFile: TEST_RUN_PER_FILE }, count);

// A step's bound in the worktree at `root`: COMMAND_TIMEOUT and STEP_PER_FILE a file its index tracks.
export const stepLimit = (root) => limitFor({ floor: COMMAND_TIMEOUT, perFile: STEP_PER_FILE }, trackedFiles(root));

// This process's environment for the commands run at `root`, without the variables git lists as pointing it at a
// repository (`git rev-parse --local-env-vars`): a git hook hands its run a GIT_DIR, which would steer a test's git.
export function commandEnv(root) {
  let local = [];
  try { local = findLocalGitVariables(root); } catch { /* git asked nothing: none dropped */ }
  const dropped = new Set(local.map((k) => k.toUpperCase()));
  return Object.assign(Object.create(null), Object.fromEntries(Object.entries(process.env).filter(([k]) => !dropped.has(k.toUpperCase()))));
}

// a program's name with no folder in it: only such a name is looked for on the PATH
const isBareName = (name) => !/[\\/:]/.test(name) && name !== "." && name !== "..";

// npm's own programs, whose Windows `.cmd` shims run node on these scripts in npm's folder beside node.exe
const NPM_SCRIPTS = new Map([["npm", "npm-cli.js"], ["npx", "npx-cli.js"]]);

// On Windows, npm or npx as node on its script beside the node.exe the PATH holds: { program, args }, or null.
function npmOnWindows(name, args) {
  const node = process.platform === "win32" && NPM_SCRIPTS.has(name) ? findProgram("node") : null;
  if (!node) return null;
  const script = join(dirname(node), "node_modules", "npm", "bin", NPM_SCRIPTS.get(name));
  try { if (!lstatSync(script).isFile()) return null; } catch { return null; }
  return { program: node, args: [script, ...args] };
}

// whether Windows holds the program on the PATH's absolute folders only as a batch file, which runs through cmd.exe
const batchOnly = (name) => process.platform === "win32" && Boolean(findProgram(name, ".cmd") || findProgram(name, ".bat"));

// The program `argv` names and its arguments, { program, args }, or { why } it is not run.
function resolved(argv) {
  const [name, ...args] = argv;
  if (!isBareName(name)) return { why: "its program is not a bare name" };
  const npm = npmOnWindows(name, args);
  if (npm) return npm;
  const program = findProgram(name);
  if (program) return { program, args };
  if (batchOnly(name)) return { why: `its program ${cutAt(controlsReplaced(name), NAME_SHOWN)} is found only as a .cmd or .bat, which runs through a shell` };
  return { why: "its program is not on the PATH's absolute folders" };
}

// A promise of the command `argv`'s run in `cwd` under `env`, a step, ended at stepLimit: { passed, why, tail, seconds }.
// `why` says how a run that did not pass ended, in fixed words, numbers and the program's name; `tail` is the end of
// its output.
export const runCommand = (argv, cwd, env) => runKeeping(argv, { cwd, env, kept: TAIL_CHARACTERS, timeout: stepLimit(cwd) });

// The run read whole, up to OUTPUT_CAP characters, ended after `timeout` milliseconds: a test run's (testRunLimit), whose
// cases an adapter reads from it, or a hook's, which must end before Claude Code ends the hook.
export const runCommandWithin = (argv, { cwd, env, timeout }) => runKeeping(argv, { cwd, env, kept: OUTPUT_CAP, timeout });

// A sink keeping the last `kept` characters of what it is handed: { add, text }.
function outputKept(kept) {
  const chunks = [];
  let length = 0;
  const add = (chunk) => {
    chunks.push(chunk);
    length += chunk.length;
    while (chunks.length > 1 && length - chunks[0].length >= kept) length -= chunks.shift().length;
  };
  return { add, text: () => chunks.join("").slice(-kept) };
}

// How a run that did not pass ended: its bound when it ran out, else the signal that stopped it, else its exit code.
function endedHow({ outOfTime, timeout }, code, signal) {
  if (outOfTime) return ranOut(timeout);
  return signal ? `stopped by ${signal}` : `exit ${code}`;
}

// The run, ended after `timeout` milliseconds, its output's last `kept` characters as its tail.
function runKeeping(argv, { cwd, env, kept, timeout }) {
  const { program, args, why } = resolved(argv);
  if (!program) return Promise.resolve({ passed: false, why, tail: "", seconds: 0 });
  const start = Date.now();
  return new Promise((done) => {
    const output = outputKept(kept);
    const child = spawn(program, args, { cwd, env, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const clock = { outOfTime: false, timeout };
    const timer = setTimeout(() => { clock.outOfTime = true; child.kill(); }, timeout);
    child.stdout.setEncoding("utf8").on("data", output.add);
    child.stderr.setEncoding("utf8").on("data", output.add);
    const end = (passed, why) => { clearTimeout(timer); done({ passed, why, tail: output.text(), seconds: (Date.now() - start) / 1000 }); };
    child.on("error", () => end(false, "its program could not start"));
    child.on("close", (code, signal) => end(code === 0, code === 0 ? "" : endedHow(clock, code, signal)));
  });
}
