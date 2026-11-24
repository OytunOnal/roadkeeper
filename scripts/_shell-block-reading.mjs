// @level infrastructure
// Roadkeeper — a simple command read for the Shell block's forms (scripts/_judge-command-line.mjs): what node's,
// python's, sed's and git's options say of it. The interpreters are python, python3, python3.N, py and node.

import { GIT, gitCommand, readProgram } from "./_program-options.mjs";
import { splitWords } from "./_shell.mjs";

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

// One simple command ({ words, heredoc, fed }, shellCommands') read for the Shell block's forms: { name, source,
// stdinIsHeredoc, rewritesInPlace, showsFileToOutput, isGit }.
export function readShellBlockCommand({ words, heredoc, fed }) {
  const program = readProgram(words);
  const isGit = GIT.test(program.name);
  return {
    name: program.name,
    source: findProgramSource(program),
    stdinIsHeredoc: heredoc || fed,
    rewritesInPlace: SED.test(program.name) && rewritesInPlace(program.args),
    showsFileToOutput: isGit && showsFileToOutput(program.args),
    isGit,
  };
}
