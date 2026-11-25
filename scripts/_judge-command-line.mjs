// @level domain
// Roadkeeper — the Shell block's forbidden forms (skills/slice/references/briefing.md, Every brief): a command line's
// simple commands, each as scripts/_shell-block-reading.mjs reads it, judged in fixed words naming the form that works.

const SCRIPT_FILE_REMEDY = "write the script to a file, then run the file"; // the form that works for an interpreter's program
const ONE_COMMAND = "run each command as a call of its own, with nothing chained to it (`&&`, `||`, `;`, `&`, `|`, " // a chain's refusal
  + "`$( )`, backticks, a subshell)";
const NOTICE_WAIT_REMEDY ="wait for a background run's notice: end your turn, then read the run's output file once when " // a chain that sleeps: a poll
  + "the notice comes; a loop or `sleep` polls it";
const GIT_COMMIT_HINT = "; for a long message, `git commit -F <file>`"; // said when a chained command is git
const SED_IN_PLACE = "sed -i rewrites a file in place; edit the file with Edit, or write a script file"; // sed -i's refusal
const SHOW_TO_OUTPUT = "git show <rev>:<path> with --output leaves that file empty and prints the file here; " // its refusal
  + "write it in Bash with `git show <rev>:<path> > <file>`"; // PowerShell's `>` re-encodes the file

// One simple command judged: the refusal of its form, or null when it is none of them. `command`: { name, source,
// stdinIsHeredoc, rewritesInPlace, showsFileToOutput }, `source` where an interpreter's program comes from ("inline",
// "stdin" or null).
function judgeCommand({ name, source, stdinIsHeredoc, rewritesInPlace, showsFileToOutput }) {
  if (source === "inline") return `${name} is given its program inline; ${SCRIPT_FILE_REMEDY}`;
  if (source && stdinIsHeredoc) return `${name} reads its program from a heredoc or here-string; ${SCRIPT_FILE_REMEDY}`;
  if (rewritesInPlace) return SED_IN_PLACE;
  if (showsFileToOutput) return SHOW_TO_OUTPUT;
  return null;
}

// A command line judged, its simple commands each read: its first command's refusal, else the chain's, a chain that
// sleeps refused as a wait; null when it is one command of no such form.
export function judgeCommandLine(commands) {
  for (const one of commands) {
    const refusal = judgeCommand(one);
    if (refusal) return refusal;
  }
  if (commands.length < 2) return null;
  if (commands.some((one) => one.isSleep)) return NOTICE_WAIT_REMEDY;
  return commands.some((one) => one.isGit) ? ONE_COMMAND + GIT_COMMIT_HINT : ONE_COMMAND;
}
