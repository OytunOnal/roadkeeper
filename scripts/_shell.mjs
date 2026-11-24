// @level kernel
// Roadkeeper — a shell command line read as its simple commands, each split into its words: what the hooks that judge a
// command share.

// A program word's name, its path taken off.
export const programName = (word) => (word ?? "").split(/[\\/]/).pop();

// A command's words after its program: { options, positional }; each option [name, value], its value attached or, for a
// name in `valued`, the next word; every word after `--` positional.
export function splitWords(words, valued) {
  const options = [];
  const positional = [];
  for (let k = 0; k < words.length; k++) {
    const word = words[k];
    if (word === "--") { positional.push(...words.slice(k + 1)); break; }
    if (!word.startsWith("-") || word === "-") { positional.push(word); continue; }
    const [name, ...value] = word.split("=");
    if (valued.has(name) && !value.length) options.push([name, words[++k] ?? ""]);
    else options.push([name, value.join("=")]);
  }
  return { options, positional };
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
export function shellCommands(commandLine, { powershell = false } = {}) {
  return new CommandLineReader(commandLine, powershell).commands();
}

// a simple command not yet read: its words, and whether its stdin is a heredoc or fed by a pipe from one
const newSimpleCommand = (fed = false) => ({ words: [], heredoc: false, fed });
// a character a redirection's operator runs on with: `>>`, `>|`, `<>`
const isRedirectMark = (char) => char === ">" || char === "|" || char === "<";

// One pass over a command line: where it is (`position`), the commands done, the heredocs whose body starts at the next
// newline ({ delimiter, tabs }), and the frames open, innermost last: { kind: "command", closer, simpleCommand, word,
// has, skip } or { kind: "quoted" }, a double-quoted run.
class CommandLineReader {
  constructor(text, powershell) {
    this.text = text;
    this.end = text.length;
    this.powershell = powershell;
    this.position = 0;
    this.done = [];
    this.pending = [];
    this.stack = [];
    this.openCommandFrame(null);
  }

  // the line's simple commands, read to its end, every frame still open closed
  commands() {
    while (this.position < this.end) {
      const top = this.stack[this.stack.length - 1];
      const char = this.text[this.position];
      if (top.kind === "quoted") this.readQuoted(char);
      else this.readUnquoted(top, char);
    }
    while (this.stack.length) {
      const frame = this.stack.pop();
      if (frame.kind === "command") this.endSimpleCommand(frame, false);
    }
    return this.done;
  }

  openCommandFrame(closer) {
    this.stack.push({ kind: "command", closer, simpleCommand: newSimpleCommand(), word: "", has: false, skip: false });
  }

  innermostCommandFrame() {
    for (let k = this.stack.length - 1; k >= 0; k--) if (this.stack[k].kind === "command") return this.stack[k];
    return null;
  }

  endWord(frame) {
    if (frame.has) { if (frame.skip) frame.skip = false; else frame.simpleCommand.words.push(frame.word); }
    frame.word = ""; frame.has = false;
  }

  endSimpleCommand(frame, pipe) {
    this.endWord(frame);
    const ended = frame.simpleCommand;
    if (ended.words.length) this.done.push(ended);
    frame.simpleCommand = newSimpleCommand(pipe && (ended.heredoc || ended.fed));
    frame.skip = false;
  }

  lineEnd(from) {
    const newline = this.text.indexOf("\n", from);
    return newline < 0 ? this.end : newline;
  }

  // the heredoc bodies waiting, read past, after a newline at position-1
  readPastBodies() {
    while (this.pending.length) {
      const { delimiter, tabs } = this.pending.shift();
      while (this.position < this.end) {
        const lineEnd = this.lineEnd(this.position);
        let line = this.text.slice(this.position, lineEnd).replace(/\r$/, "");
        if (tabs) line = line.replace(/^\t+/, "");
        this.position = lineEnd + 1;
        if (line === delimiter) break;
      }
    }
  }

  // one step inside double quotes: the closing quote, an escape, or a command substitution opening
  readQuoted(char) {
    const frame = this.innermostCommandFrame(), next = this.text[this.position + 1];
    if (char === '"') { this.stack.pop(); this.position++; return; }
    if (this.powershell && char === "`") { frame.word += next ?? ""; this.position += 2; return; }
    if (!this.powershell && char === "\\") {
      const [added, taken] = quotedBackslash(next);
      frame.word += added; this.position += taken; return;
    }
    if (char === "$" && next === "(") { this.openCommandFrame(")"); this.position += 2; return; }
    if (!this.powershell && char === "`") { this.openCommandFrame("`"); this.position++; return; }
    frame.word += char; this.position++;
  }

  // one step in command frame `frame`, outside quotes
  readUnquoted(frame, char) {
    const next = this.text[this.position + 1];
    const isSpace = char === " " || char === "\t" || char === "\r";
    const isRedirection = char === "<" || char === ">" || char === "&";
    if (frame.closer && char === frame.closer) { this.endSimpleCommand(frame, false); this.stack.pop(); this.position++; return; }
    if (char === "\n") { this.endSimpleCommand(frame, false); this.position++; if (this.pending.length) this.readPastBodies(); return; }
    if (isSpace) { this.endWord(frame); this.position++; return; }
    if (char === (this.powershell ? "`" : "\\")) { frame.word += next ?? ""; frame.has = true; this.position += 2; return; }
    if (char === "'") { this.readSingleQuoted(frame); return; }
    if (char === '"') { this.stack.push({ kind: "quoted" }); frame.has = true; this.position++; return; }
    if (this.opensHereString(char)) { this.skipHereString(frame); return; }
    if (!this.powershell && char === "`") { this.openCommandFrame("`"); frame.has = true; this.position++; return; }
    if (char === "(") { this.endWord(frame); this.openCommandFrame(")"); this.position++; return; }
    if (char === ")" || char === ";") { this.endSimpleCommand(frame, false); this.position++; return; }
    if (char === "|") { const two = next === "|"; this.endSimpleCommand(frame, !two); this.position += two ? 2 : 1; return; }
    if (char === "&" && next !== ">") { this.endSimpleCommand(frame, false); this.position += next === "&" ? 2 : 1; return; }
    if (isRedirection) { this.readRedirection(frame, char); return; }
    frame.word += char; frame.has = true; this.position++;
  }

  // a single-quoted run added to the word as it stands, to its closing quote or the line's end
  readSingleQuoted(frame) {
    const close = this.text.indexOf("'", this.position + 1);
    frame.word += this.text.slice(this.position + 1, close < 0 ? this.end : close); frame.has = true;
    this.position = close < 0 ? this.end : close + 1;
  }

  // whether a PowerShell here-string opens at `char`: `@'` or `@"` with nothing after it on its line
  opensHereString(char) {
    const quote = this.text[this.position + 1];
    const restOfLine = this.text.slice(this.position + 2, this.lineEnd(this.position + 2));
    return this.powershell && char === "@" && (quote === "'" || quote === '"') && /^[ \t]*\r?$/.test(restOfLine);
  }

  // a PowerShell here-string read past: its body runs to a line opening with the quote and `@`
  skipHereString(frame) {
    const close = this.text[this.position + 1] + "@";
    this.position = this.lineEnd(this.position + 2) + 1;
    while (this.position < this.end) {
      const lineEnd = this.lineEnd(this.position), closes = this.text.startsWith(close, this.position);
      this.position = closes ? this.position + 2 : lineEnd + 1;
      if (closes) break;
    }
    frame.has = true; frame.word += "@here"; frame.simpleCommand.heredoc = true;
  }

  // a redirection at `char` (`<`, `>` or `&`): a here-string, a heredoc, a process substitution, or an operator whose
  // target is no word
  readRedirection(frame, char) {
    if (frame.has && /^\d+$/.test(frame.word)) { frame.word = ""; frame.has = false; } // an fd number is no word
    else this.endWord(frame);
    if (this.text.startsWith("<<<", this.position)) { frame.simpleCommand.heredoc = true; frame.skip = true; this.position += 3; return; }
    if (this.text.startsWith("<<", this.position)) {
      this.position += 2;
      this.pending.push(this.readHeredocDelimiter());
      frame.simpleCommand.heredoc = true;
      return;
    }
    const opensProcess = (char === "<" || char === ">") && this.text[this.position + 1] === "(";
    if (opensProcess) { this.openCommandFrame(")"); frame.has = true; frame.word += "<proc>"; this.position += 2; return; }
    this.position++;
    while (isRedirectMark(this.text[this.position])) this.position++;
    if (this.text[this.position] === "&") {
      this.position++;
      while (/[0-9-]/.test(this.text[this.position] ?? "")) this.position++;
      return;
    }
    frame.skip = true;
  }

  // a heredoc's delimiter after `<<`, its quotes and escapes taken off: { delimiter, tabs }, tabs for `<<-`
  readHeredocDelimiter() {
    const tabs = this.text[this.position] === "-";
    if (tabs) this.position++;
    while (this.text[this.position] === " " || this.text[this.position] === "\t") this.position++;
    let delimiter = "";
    while (this.position < this.end && !/[\s;&|<>()]/.test(this.text[this.position])) {
      const char = this.text[this.position];
      if (char === "'" || char === '"') {
        const close = this.text.indexOf(char, this.position + 1);
        delimiter += this.text.slice(this.position + 1, close < 0 ? this.end : close);
        this.position = close < 0 ? this.end : close + 1;
      } else if (char === "\\") { delimiter += this.text[this.position + 1] ?? ""; this.position += 2; } else { delimiter += char; this.position++; }
    }
    return { delimiter, tabs };
  }
}
