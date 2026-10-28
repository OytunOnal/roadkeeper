#!/usr/bin/env node
// @level main
// Roadkeeper — git alone (PreToolUse hook on Bash and PowerShell).
//
// In a linked worktree, refuses (exit 2, one line on stderr in fixed words; the command is never quoted) a command line
// of more than one simple command, one of them git: joined by `&&`, `||`, `;`, `&` or `|`, inside `$( )`, backticks, a
// subshell, a loop or a condition. A simple command is git when its first word, past environment assignments and the
// shell keywords a command follows (`do`, `then`, `if`, …), is named `git` or `git.exe`, whatever its path.
// A linked worktree: from the command's folder (`readShellCall`'s `cwd`) up to the first `.git`, at most 64 levels,
// that `.git` a plain file. A folder there is a main checkout and a link is neither: both pass, as does a folder with no
// `.git` within reach. Only the entry's type is looked at, never its content; no git runs.
// Acts only in a Roadkeeper project, found from the command's folder by `projectRecordsOrNull` (_hook.mjs); elsewhere
// it lets every command pass, saying nothing.
// Lets pass: a lone git command, whatever its options and redirections (a redirection is not a command); a chain with
// no git; any tool but Bash and PowerShell. How a command is read, and what that reading leaves outside (and so lets
// pass), is `shellCommands` in scripts/_shell.mjs.
// Reads its call through `readShellCall` (_hook.mjs), which bounds the input. It never runs the command, writes
// nothing and opens no network. An error checking `.git` or reading the command lets it pass, said on stderr.

import { lstatSync } from "node:fs";
import { join } from "node:path";
import { GIT, programName, programWords, shellCommands } from "./_shell.mjs";
import { hookMessage, letPass, projectRecordsOrNull, readShellCall, upwards } from "./_hook.mjs";

// the refusal: fixed words, never the command
const SAY = hookMessage("git-alone", "run each git command as a call of its own, with nothing chained to it; "
  + "for a long message, `git commit -F <file>`");
const LEVELS = 64; // folders walked up from the command's own: deeper than a project's tree, and a bound on the walk
const NOT_FOUND = new Set(["ENOENT", "ENOTDIR"]); // lstat's codes for no `.git` in a folder: the walk goes on up

const isGit = (words) => GIT.test(programName(programWords(words)[0]));

// The folder's own `.git`, by lstat so a link is seen as one; null when there is none.
function gitEntry(dir) {
  try { return lstatSync(join(dir, ".git")); } catch (e) { if (NOT_FOUND.has(e.code)) return null; throw e; }
}

// Whether the folder is in a linked worktree: the first `.git` above it is a plain file.
function inWorktree(cwd) {
  const st = upwards(cwd, gitEntry, LEVELS);
  return st !== null && st.isFile();
}

function main() {
  const call = readShellCall("git-alone");
  if (!call) return 0;
  const { tool, command, cwd } = call;
  try { if (!inWorktree(cwd)) return 0; } catch (e) { return letPass("git-alone", `checking .git failed (${e.code || e.name})`); }
  if (!projectRecordsOrNull(cwd)) return 0;
  let segs;
  try { segs = shellCommands(command, { powershell: tool === "PowerShell" }); } catch (e) { return letPass("git-alone", `the command could not be read (${e.name})`); }
  if (segs.length > 1 && segs.some((s) => isGit(s.words))) { process.stderr.write(SAY + "\n"); return 2; }
  return 0;
}

process.exitCode = main();
