#!/usr/bin/env node
// @level main
// Roadkeeper — the Shell block (PreToolUse hook on Bash and PowerShell, scripts/hooks.json): refuses the shell forms the
// Shell block every brief opens with rules out (skills/slice/references/briefing.md, Every brief), each in fixed words
// naming the form that works (exit 2, one line on stderr; the command is never quoted):
// - an interpreter given its program inline: node's `-e`, `-p`, `--eval`, `--print`; python's `-c`, alone or in a cluster;
// - an interpreter reading its program from stdin that is a heredoc or here-string, or a pipe whose left side holds one,
//   a PowerShell here-string (`@'…'@`, `@"…"@`) among them;
// - `sed` rewriting a file in place: `-i` alone or in a cluster of short options, `--in-place`, with or without a suffix;
// - `git show <rev>:<path>` with `--output`, which leaves that file empty and prints the file into the call's result;
// - a chain: more than one simple command in one call, joined by `&&`, `||`, `;`, `&`, `|` or a newline, or inside
//   `$( )`, backticks, a subshell or a process substitution, in Bash and PowerShell alike.
// A command's forms are judged before the chain, so a chain holding one says that form. Its program is found past
// assignments, shell keywords and the programs that run the next word (`command`, `env`, …), whatever its path or `.exe`;
// the interpreters are python, python3, python3.N, py and node.
// Lets pass: one command, whatever its options and redirections (`git show <rev>:<path> > <file>`, `git show <commit>
// --output=<file>`, `python x.py <<EOF`, a heredoc feeding no interpreter's program); any tool but Bash and PowerShell.
// How a command is read, and what that reading leaves outside (and so lets pass), is `shellCommands` in scripts/_shell.mjs.
// Acts only in a Roadkeeper project, through `runShellHook` (_hook.mjs), which reads and bounds the input. It never runs
// the command, runs no program, writes nothing and opens no network. A command it cannot read lets it pass, said on stderr.

import { GIT, gitCommand, readProgram, splitWords } from "./_shell.mjs";
import { runShellHook } from "./_hook.mjs";

const SCRIPT_FILE_REMEDY = "write the script to a file, then run the file"; // the form that works for an interpreter's program
const ONE_COMMAND = "run each command as a call of its own, with nothing chained to it (`&&`, `||`, `;`, `&`, `|`, " // a chain's refusal
  + "`$( )`, backticks, a subshell)";
const GIT_COMMIT_HINT = "; for a long message, `git commit -F <file>`"; // said when a chained command is git
const SED_IN_PLACE = "sed -i rewrites a file in place; edit the file with Edit, or write a script file"; // sed -i's refusal
const SHOW_TO_OUTPUT = "git show <rev>:<path> with --output leaves that file empty and prints the file here; " // its refusal
  + "write it in Bash with `git show <rev>:<path> > <file>`"; // PowerShell's `>` re-encodes the file
const INTERPRETER = /^(?:python(?:\d+(?:\.\d+)*)?|py|node)(?:\.exe)?$/i; // the interpreters a project's helpers run
const SED = /^sed(?:\.exe)?$/i; // sed's name as a shell runs it
const NODE_VALUED = new Set(["-r", "--require", "--import", "--loader", "--experimental-loader", "--input-type", "--env-file", "-C", "--conditions", "--title"]); // node options whose value is the next word
const NODE_PROGRAM = /^(?:--eval|--print)(?:=|$)|^-[ep]/; // node options that carry the program (`-e`, `-p`, `-pe`, `--eval=…`)
const SED_VALUED = new Set(["-e", "-f", "-l", "--expression", "--file", "--line-length"]); // sed options whose value is the next word
const SED_SHORT_IN_PLACE = /^-[^-efl]*i/; // `i` in a cluster of sed's short options, before one that takes the rest as its value

// What a python option says of the program: "inline" (`c`), "module" (`m`), "valued" (its value is the next word), or null.
function readPythonOption(word) {
  if (word === "--check-hash-based-pycs") return "valued";
  if (word.startsWith("--")) return null;
  for (let j = 1; j < word.length; j++) {
    if (word[j] === "c") return "inline";
    if (word[j] === "m") return "module";
    if (word[j] === "W" || word[j] === "X") return j === word.length - 1 ? "valued" : null; // the rest, or the next word, is its value
  }
  return null;
}

// What a node option says of the program: "inline", "valued", or null.
function readNodeOption(word) {
  if (NODE_PROGRAM.test(word)) return "inline";
  return NODE_VALUED.has(word) ? "valued" : null;
}

// Where an interpreter's program comes from (`program`, readProgram's): "inline" or "stdin"; null when it runs no
// interpreter, or a script or module.
function findProgramSource({ name, args }) {
  if (!INTERPRETER.test(name)) return null;
  const readOption = /^node/i.test(name) ? readNodeOption : readPythonOption;
  for (let a = 0; a < args.length; a++) {
    const word = args[a];
    if (word === "-") return "stdin";
    if (word === "--") return a + 1 < args.length ? null : "stdin";
    if (!word.startsWith("-")) return null; // a script
    const meaning = readOption(word);
    if (meaning === "inline") return "inline";
    if (meaning === "module") return null;
    if (meaning === "valued") a++;
  }
  return "stdin";
}

// Whether sed's words rewrite a file in place.
const rewritesInPlace = (args) => splitWords(args, SED_VALUED).options
  .some(([name]) => name === "--in-place" || SED_SHORT_IN_PLACE.test(name));

// Whether git's words show a file at a revision (`<rev>:<path>`) with `--output`. Its walk stops at `--`: a path after
// it, a drive's colon and all, is no revision.
function showsFileToOutput(args) {
  const { command, rest } = gitCommand(args);
  if (command !== "show") return false;
  let hasOutput = false;
  let namesFileAtRevision = false;
  for (let k = 0; k < rest.length && rest[k] !== "--"; k++) {
    const word = rest[k];
    if (word === "--output") { hasOutput = true; k++; } // its value, a path, is no revision
    else if (word.startsWith("--output=")) hasOutput = true;
    else if (!word.startsWith("-") && word.includes(":")) namesFileAtRevision = true;
  }
  return hasOutput && namesFileAtRevision;
}

// One simple command judged: the refusal of its form, or null when it is none of them.
function judgeCommand({ words, heredoc, fed }) {
  const program = readProgram(words);
  const source = findProgramSource(program);
  if (source === "inline") return `${program.name} is given its program inline; ${SCRIPT_FILE_REMEDY}`;
  const stdinIsHeredoc = heredoc || fed;
  if (source && stdinIsHeredoc) return `${program.name} reads its program from a heredoc or here-string; ${SCRIPT_FILE_REMEDY}`;
  if (SED.test(program.name) && rewritesInPlace(program.args)) return SED_IN_PLACE;
  if (GIT.test(program.name) && showsFileToOutput(program.args)) return SHOW_TO_OUTPUT;
  return null;
}

const isGit = (words) => GIT.test(readProgram(words).name);

// A command line judged: its first command's refusal, else the chain's; null when it is one command of no such form.
function judgeCommandLine({ commands }) {
  for (const one of commands) {
    const refusal = judgeCommand(one);
    if (refusal) return refusal;
  }
  if (commands.length < 2) return null;
  return commands.some((one) => isGit(one.words)) ? ONE_COMMAND + GIT_COMMIT_HINT : ONE_COMMAND;
}

process.exitCode = await runShellHook("shell-block", judgeCommandLine);
