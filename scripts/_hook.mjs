// @level infrastructure
// Roadkeeper — what the hooks share: the hook's input, the shell command a PreToolUse hook judges, the repository it
// runs in, and The Road drawn on the default branch.

import { execFileSync } from "node:child_process";
import { existsSync, readSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { recordsDir } from "./_files.mjs";
import { git } from "./_git.mjs";

const CAP = 1024 * 1024; // bytes of stdin a hook reads; past it a PreToolUse hook lets the command through, said

// JSON that is an object: not null, not an array, not a plain value.
const isJsonObject = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);

// stdin's text, or null past CAP bytes.
export function readCapped() {
  const chunks = [];
  let size = 0;
  const buf = Buffer.alloc(65536);
  for (;;) {
    let n = 0;
    try { n = readSync(0, buf, 0, buf.length, null); } catch (e) { if (e.code === "EAGAIN") continue; if (e.code === "EOF") break; throw e; }
    if (!n) break;
    size += n;
    if (size > CAP) return null;
    chunks.push(Buffer.from(buf.subarray(0, n)));
  }
  return Buffer.concat(chunks).toString("utf8");
}

// A line the hook says to the session, starting with the plugin's and the hook's names: `roadkeeper <hook>: <words>`.
export function hookMessage(hook, words) {
  return `roadkeeper ${hook}: ${words}`;
}

// Says on stderr, in fixed words, why the hook lets the command pass; 0, the exit code that lets it.
export function letPass(hook, why) {
  process.stderr.write(hookMessage(hook, `${why}; let pass`) + "\n");
  return 0;
}

// The Bash or PowerShell call a PreToolUse hook judges, read from stdin: { tool, command, input, cwd }, cwd the
// command's folder: the input's `cwd` when a non-empty string, else the hook's own. null lets the call pass: silently
// for any other tool; said on stderr when the input cannot be read — stdin unreadable or over the cap, not JSON, not
// the hook's shape, no command string.
export function readShellCall(hook) {
  const pass = (why) => { letPass(hook, why); return null; };
  let raw;
  try { raw = readCapped(); } catch (e) { return pass(`stdin unreadable (${e.code || "error"})`); }
  if (raw === null) return pass(`input over ${CAP / (1024 * 1024)} MB, not read`);
  let input;
  try { input = JSON.parse(raw); } catch { return pass("input is not JSON, not read"); }
  if (!isJsonObject(input)) return pass("input is not the hook's shape");
  const tool = input.tool_name;
  if (tool !== "Bash" && tool !== "PowerShell") return null;
  const command = input.tool_input && typeof input.tool_input === "object" ? input.tool_input.command : undefined;
  if (typeof command !== "string") return pass("no command in the input");
  const cwd = typeof input.cwd === "string" && input.cwd ? input.cwd : process.cwd();
  return { tool, command, input, cwd };
}

// The hook's JSON from stdin, always an object: input that is unreadable, over the cap, not JSON, or JSON that is not
// an object, reads as {}.
export function readInput() {
  let raw;
  try { raw = readCapped(); } catch { return {}; }
  try { const v = JSON.parse(raw || "{}"); return isJsonObject(v) ? v : {}; } catch { return {}; }
}

// whether a directory is a git directory, read from the filesystem, never from git's words
const gitDirHere = (dir) => existsSync(join(dir, "HEAD")) && existsSync(join(dir, "objects")) && existsSync(join(dir, "refs"));

// The first answer `ask` gives, asked of the folder and then each one above it, at most `levels` folders; null when it
// gives none.
export function upwards(dir, ask, levels = Infinity) {
  let cur = resolve(dir);
  for (let k = 0; k < levels; k++) {
    const answer = ask(cur);
    if (answer) return answer;
    const up = dirname(cur);
    if (up === cur) return null;
    cur = up;
  }
  return null;
}

const directoryExists = (cwd) => Boolean(cwd) && existsSync(cwd);

// The work tree's root read from the filesystem, git never asked: the nearest folder at or above the directory holding
// `.git`; "" when there is none, or the directory is inside a git directory.
export function treeRoot(cwd) {
  if (!directoryExists(cwd) || upwards(cwd, gitDirHere)) return "";
  return upwards(cwd, (d) => (existsSync(join(d, ".git")) ? d : null)) || "";
}

// The docs/roadkeeper folder of the work tree holding the directory (treeRoot, then recordsDir), or null: the hooks act
// only where there is one.
export function projectRecordsOrNull(cwd) {
  const root = treeRoot(cwd);
  return root ? recordsDir(root) : null;
}

// The work tree's root; "" when there is none to watch, as for treeRoot; null when git could not answer.
export function repoRoot(cwd) {
  if (!directoryExists(cwd)) return "";
  try { return git(["rev-parse", "--show-toplevel"], cwd); }
  catch { return treeRoot(cwd) ? null : ""; }
}

// The branch checked out (null when detached) and home, the default one: what origin/HEAD names, else main, else master.
export function branches(root) {
  const ask = (args) => { try { return git(args, root); } catch { return null; } };
  const current = ask(["symbolic-ref", "--short", "HEAD"]);
  const origin = ask(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
  const fallback = ask(["rev-parse", "--verify", "--quiet", "refs/heads/main"]) !== null || current === "main" ? "main" : "master";
  return { current, home: origin ? origin.replace(/^origin\//, "") : fallback };
}

// Draws The Road in the project's root with the drawing script at `road`, on the default branch only: a page drawn on a
// feature branch would travel in its pull request. Returns "drawn", "not-home" (not on the default branch) or "failed";
// the drawing script's output is dropped, since it carries the page's path and gh's words.
export function drawRoadAtHome(root, road, { offline, timeout }) {
  const { current, home } = branches(root);
  if (current !== home) return "not-home";
  try {
    execFileSync(process.execPath, [road, ...(offline ? ["--offline"] : [])], { cwd: root, timeout, stdio: "ignore", windowsHide: true });
    return "drawn";
  } catch {
    return "failed";
  }
}
