// @level domain
// Roadkeeper — a shell command line read as its simple commands: what the hooks that judge a command share.

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

// A program word's name, its path taken off.
export const programName = (word) => (word ?? "").split(/[\\/]/).pop();

// A simple command's program read once: { name, args }, `name` its program's name (programName) past what
// programWords skips, `args` the words after it.
export function readProgram(words) {
  const [program, ...args] = programWords(words);
  return { name: programName(program), args };
}

// A command's words after its program: { options, positional }; each option [name, value], its value attached or, for a
// name in `valued`, the next word; every word after `--` positional.
export function splitWords(words, valued) {
  const options = [];
  const positional = [];
  for (let k = 0; k < words.length; k++) {
    const w = words[k];
    if (w === "--") { positional.push(...words.slice(k + 1)); break; }
    if (!w.startsWith("-") || w === "-") { positional.push(w); continue; }
    const [name, ...value] = w.split("=");
    if (valued.has(name) && !value.length) options.push([name, words[++k] ?? ""]);
    else options.push([name, value.join("=")]);
  }
  return { options, positional };
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

const QUOTED_ESCAPES = new Set(["$", "`", '"', "\\"]); // what a backslash escapes inside bash's double quotes

// A backslash inside bash's double quotes, `next` the character after it: [the text it adds to the word, the
// characters it takes]. It escapes `$`, a backtick, `"` and `\`, joins a line to the next, and before anything else is
// kept: `"C:\dir"` is C:\dir.
function quotedBackslash(next) {
  if (next === "\n") return ["", 2];
  return QUOTED_ESCAPES.has(next) ? [next, 2] : ["\\", 1];
}

// A shell command line's simple commands, each { words, heredoc, fed }: heredoc when its own stdin is a heredoc or
// here-string, fed when a pipe's left side's was. powershell: PowerShell's escape (backtick) and here-strings (`@'…'@`,
// `@"…"@`) in place of bash's backslash and backticks.
// Read as commands: the words between `;`, `&`, `&&`, `|`, `||` and newlines, each word with its quotes and escapes
// taken off (inside bash's double quotes a backslash escapes only what bash's does, `quotedBackslash`; PowerShell's
// backslash is a plain character everywhere); a command substitution `$(…)`, a backtick, a subshell and a process substitution `<(…)` as commands of
// their own, inside double quotes too. Redirections and their targets are no words; a here-string's operand is none.
// Outside: a heredoc's or here-string's body and quoted text (never read as commands; a process substitution stands
// as the word `<proc>`, a PowerShell here-string as `@here`). It reads the command as a shell's words, not as the shell
// does: no variable, alias or `eval` is expanded; a program reached through another program (`bash -c "…"`, `sh <<EOF`
// whose body runs one) is a word or a body, not a command; a `<<` inside arithmetic or a `case` pattern's `)` is
// misread. Bounds: one pass over the command; it runs nothing and opens no file.
export function shellCommands(src, { powershell = false } = {}) {
  const done = [];
  const pending = []; // heredocs whose body starts at the next newline: { delim, tabs }
  const stack = []; // frames: { kind: "cmd", closer, seg, word, has, skip } or { kind: "dq" }
  const newSeg = (fed = false) => ({ words: [], heredoc: false, fed });
  const pushCmd = (closer) => stack.push({ kind: "cmd", closer, seg: newSeg(), word: "", has: false, skip: false });
  pushCmd(null);
  const cmd = () => { for (let k = stack.length - 1; k >= 0; k--) if (stack[k].kind === "cmd") return stack[k]; return null; };
  const endWord = (f) => {
    if (f.has) { if (f.skip) f.skip = false; else f.seg.words.push(f.word); }
    f.word = ""; f.has = false;
  };
  const endSeg = (f, pipe) => {
    endWord(f);
    const s = f.seg;
    if (s.words.length) done.push(s);
    f.seg = newSeg(pipe && (s.heredoc || s.fed));
    f.skip = false;
  };
  let i = 0;
  const n = src.length;
  const lineEnd = (k) => { const e = src.indexOf("\n", k); return e < 0 ? n : e; };
  const bodies = () => { // consume heredoc bodies after a newline at i-1
    while (pending.length) {
      const { delim, tabs } = pending.shift();
      while (i < n) {
        const e = lineEnd(i);
        let line = src.slice(i, e).replace(/\r$/, "");
        if (tabs) line = line.replace(/^\t+/, "");
        i = e + 1;
        if (line === delim) break;
      }
    }
  };
  while (i < n) {
    const top = stack[stack.length - 1];
    const c = src[i];
    if (top.kind === "dq") {
      const f = cmd();
      if (c === '"') { stack.pop(); i++; continue; }
      if (powershell && c === "`") { f.word += src[i + 1] ?? ""; i += 2; continue; }
      if (!powershell && c === "\\") { const [text, taken] = quotedBackslash(src[i + 1]); f.word += text; i += taken; continue; }
      if (c === "$" && src[i + 1] === "(") { pushCmd(")"); i += 2; continue; }
      if (!powershell && c === "`") { pushCmd("`"); i++; continue; }
      f.word += c; i++; continue;
    }
    const f = top;
    if (f.closer && c === f.closer) { endSeg(f, false); stack.pop(); i++; continue; }
    if (c === "\n") {
      endSeg(f, false); i++;
      if (pending.length) bodies();
      continue;
    }
    if (c === " " || c === "\t" || c === "\r") { endWord(f); i++; continue; }
    if ((powershell && c === "`") || (!powershell && c === "\\")) { f.word += src[i + 1] ?? ""; f.has = true; i += 2; continue; }
    if (c === "'") {
      const e = src.indexOf("'", i + 1);
      f.word += src.slice(i + 1, e < 0 ? n : e); f.has = true; i = e < 0 ? n : e + 1; continue;
    }
    if (c === '"') { stack.push({ kind: "dq" }); f.has = true; i++; continue; }
    if (powershell && c === "@" && (src[i + 1] === "'" || src[i + 1] === '"') && /^[ \t]*\r?$/.test(src.slice(i + 2, lineEnd(i + 2)))) {
      // a PowerShell here-string: its body runs to a line opening with the quote and `@`
      const close = src[i + 1] + "@";
      i = lineEnd(i + 2) + 1;
      while (i < n) { const e = lineEnd(i); const at = src.startsWith(close, i); i = at ? i + 2 : e + 1; if (at) break; }
      f.has = true; f.word += "@here"; f.seg.heredoc = true; continue;
    }
    if (!powershell && c === "`") { pushCmd("`"); f.has = true; i++; continue; }
    if (c === "(") { endWord(f); pushCmd(")"); i++; continue; }
    if (c === ")") { endSeg(f, false); i++; continue; }
    if (c === ";") { endSeg(f, false); i++; continue; }
    if (c === "|") { const two = src[i + 1] === "|"; endSeg(f, !two); i += two ? 2 : 1; continue; }
    if (c === "&" && src[i + 1] !== ">") { endSeg(f, false); i += src[i + 1] === "&" ? 2 : 1; continue; }
    if (c === "<" || c === ">" || c === "&") {
      if (f.has && /^\d+$/.test(f.word)) { f.word = ""; f.has = false; } // an fd number is no word
      else endWord(f);
      if (src.startsWith("<<<", i)) { f.seg.heredoc = true; f.skip = true; i += 3; continue; }
      if (src.startsWith("<<", i)) {
        i += 2;
        const tabs = src[i] === "-";
        if (tabs) i++;
        while (src[i] === " " || src[i] === "\t") i++;
        let delim = "";
        while (i < n && !/[\s;&|<>()]/.test(src[i])) {
          const q = src[i];
          if (q === "'" || q === '"') { const e = src.indexOf(q, i + 1); delim += src.slice(i + 1, e < 0 ? n : e); i = e < 0 ? n : e + 1; }
          else if (q === "\\") { delim += src[i + 1] ?? ""; i += 2; }
          else { delim += q; i++; }
        }
        pending.push({ delim, tabs });
        f.seg.heredoc = true;
        continue;
      }
      if ((c === "<" || c === ">") && src[i + 1] === "(") { pushCmd(")"); f.has = true; f.word += "<proc>"; i += 2; continue; }
      i++;
      while (src[i] === ">" || src[i] === "|" || src[i] === "<") i++;
      if (src[i] === "&") { i++; while (/[0-9-]/.test(src[i] ?? "")) i++; continue; }
      f.skip = true; continue;
    }
    f.word += c; f.has = true; i++;
  }
  while (stack.length) { const t = stack.pop(); if (t.kind === "cmd") endSeg(t, false); }
  return done;
}
