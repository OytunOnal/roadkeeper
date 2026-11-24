// @level infrastructure
// Roadkeeper — what programs' options mean on a shell command line: a simple command's program found past the
// programs that run the words after them, and git's options before its command.

import { programName } from "./_shell.mjs";

const KEYWORDS = new Set(["if", "then", "elif", "else", "while", "until", "do", "{", "!", "time"]); // words a command follows
// programs that run the words after them as a command, each with its options whose value is the next word
const WRAPPERS = new Map([
  ["env", new Set(["-u", "--unset", "-C", "--chdir", "-S", "--split-string"])],
  ["sudo", new Set(["-u", "--user", "-g", "--group", "-D", "--chdir", "-p", "--prompt"])],
  ["exec", new Set(["-a"])], ["command", new Set()], ["nohup", new Set()], ["&", new Set()],
]);
const ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=/; // `NAME=value` before a command

// The index of the first word from `k` on that is no option of a wrapper whose valued options are `valued`.
function pastOptions(words, k, valued) {
  const isOption = (word) => word !== undefined && word.startsWith("-") && word !== "-";
  let at = k;
  while (isOption(words[at])) {
    if (words[at] === "--") return at + 1;
    at += valued.has(words[at]) ? 2 : 1;
  }
  return at;
}

// A simple command's words from its program on: past the environment assignments and the shell keywords before it, and
// the programs that run the words after them (`env -i`, `command`, …) and their options.
export function programWords(words) {
  let k = 0;
  while (k < words.length) {
    const word = words[k];
    if (KEYWORDS.has(word) || ASSIGN.test(word)) { k++; continue; }
    if (!WRAPPERS.has(word)) break;
    k = pastOptions(words, k + 1, WRAPPERS.get(word));
  }
  return words.slice(k);
}

// The `NAME=value` words before a simple command's program, wrappers and theirs included, each [name, value].
export function prefixAssignments(words) {
  const prefix = words.slice(0, words.length - programWords(words).length);
  return prefix.filter((w) => ASSIGN.test(w)).map((w) => [w.slice(0, w.indexOf("=")), w.slice(w.indexOf("=") + 1)]);
}

// A simple command's program read once: { name, args }, `name` its program's name (programName) past what
// programWords skips, `args` the words after it.
export function readProgram(words) {
  const [program, ...args] = programWords(words);
  return { name: programName(program), args };
}

export const GIT = /^git(?:\.exe)?$/i; // git's name as a shell runs it, `.exe` and any case as Windows takes it
const GIT_VALUED = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--config-env", "--super-prefix"]); // git's options before its command whose value is the next word
const GIT_ALIAS_SETTING = /^alias\./i; // a git setting naming an alias

// A git command line's words after git: { at, place, alias, command, rest }: the -C folders in order; `place`, its
// --git-dir and --work-tree; whether a -c or --config-env setting names an alias; git's command and its words.
export function gitCommand(words) {
  const at = [];
  const place = {};
  let alias = false;
  let k = 0;
  for (; k < words.length && words[k].startsWith("-"); k++) {
    const [name, ...attached] = words[k].split("=");
    let value = attached.join("=");
    if (!attached.length && GIT_VALUED.has(name)) value = words[++k] ?? "";
    if (name === "-C") at.push(value);
    if (name === "--git-dir") place.gitDir = value;
    if (name === "--work-tree") place.workTree = value;
    if (name === "-c" || name === "--config-env") alias ||= GIT_ALIAS_SETTING.test(value);
  }
  return { at, place, alias, command: words[k], rest: words.slice(k + 1) };
}
