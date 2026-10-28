// @level main
// Roadkeeper — no heredoc interpreter (PreToolUse hook on Bash and PowerShell, scripts/hooks.json).
//
// Acts only in a Roadkeeper project, found from the command's folder by `projectRecordsOrNull` (_hook.mjs); elsewhere
// it lets every command pass, saying nothing.
// Blocks (exit 2, one line on stderr) a shell command in which python, python3, python3.N, py or node, with or without
// a path or `.exe`, gets no program from its arguments — no script, no `-c`/`-m` (python), no `-e`/`-p`/`--eval`/
// `--print` (node); a bare `-` or nothing — while its stdin is a heredoc (`<<`, `<<-`), a here-string (`<<<`), or a
// pipe whose left side holds one, a PowerShell here-string (`@'…'@`, `@"…"@`) among them: `python - <<'EOF'`,
// `node --input-type=module <<EOF`, `cat <<EOF | python3`, `@'…'@ | python -`.
// Lets pass: a program given any other way (`python -c`, `python x.py <<EOF` feeding data to a script, `node -e`, a
// process substitution `<(…)` given as the script); a heredoc that feeds no interpreter (`cat <<EOF > x.py`, a commit
// message); stdin from a file or a plain pipe (`python < x.py`, `echo … | python`); any tool but Bash and PowerShell.
// How a command is read, and what that reading leaves outside (and so lets pass), is `shellCommands` in
// scripts/_shell.mjs.
// Reads its call through `readShellCall` (_hook.mjs), which bounds the input. It never runs the command and opens no
// network. It reads no file, only looks at entries: `.git`, a git directory's `HEAD`, `objects` and `refs`
// (`treeRoot`), and docs/roadkeeper/. A command it cannot read lets it pass, said on stderr.

import { programName, programWords, shellCommands } from "./_shell.mjs";
import { hookMessage, letPass, projectRecordsOrNull, readShellCall } from "./_hook.mjs";

const SAY = "write the script to a file, then run the file."; // the remedy, said in one line
const INTERP = /^(?:python(?:\d+(?:\.\d+)*)?|py|node)(?:\.exe)?$/i; // the interpreters a project's helpers run
const NODE_ARG = new Set(["-r", "--require", "--import", "--loader", "--experimental-loader", "--input-type", "--env-file", "-C", "--conditions", "--title"]); // node options whose value is the next word
const NODE_PROGRAM = /^(?:--eval|--print)(?:=|$)|^-[ep]/; // node options that carry the program (`-e`, `-p`, `-pe`, `--eval=…`)

// The interpreter's name when this simple command runs one whose program comes from stdin, else null.
function stdinProgram(words) {
  const [program, ...args] = programWords(words, { wrappers: true });
  const name = programName(program);
  if (!INTERP.test(name)) return null;
  const node = /^node/i.test(name);
  for (let a = 0; a < args.length; a++) {
    const w = args[a];
    if (w === "-") return name;
    if (w === "--") return a + 1 < args.length ? null : name;
    if (!w.startsWith("-")) return null; // a script
    if (node) {
      if (NODE_PROGRAM.test(w)) return null;
      if (NODE_ARG.has(w)) a++;
      continue;
    }
    if (w === "--check-hash-based-pycs") { a++; continue; }
    if (w.startsWith("--")) continue;
    for (let j = 1; j < w.length; j++) {
      if (w[j] === "c" || w[j] === "m") return null; // the program in an argument
      if (w[j] === "W" || w[j] === "X") { if (j === w.length - 1) a++; break; } // the rest, or the next word, is its value
    }
  }
  return name;
}

function main() {
  const call = readShellCall("no-heredoc");
  if (!call) return 0;
  if (!projectRecordsOrNull(call.cwd)) return 0;
  let segs;
  try { segs = shellCommands(call.command, { powershell: call.tool === "PowerShell" }); } catch (e) { return letPass("no-heredoc", `the command could not be read (${e.name})`); }
  for (const s of segs) {
    if (!(s.heredoc || s.fed)) continue;
    const name = stdinProgram(s.words);
    if (name) { process.stderr.write(hookMessage("no-heredoc", `${name} reads its program from a heredoc or here-string; ${SAY}`) + "\n"); return 2; }
  }
  return 0;
}

process.exitCode = main();
