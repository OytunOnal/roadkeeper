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
//   `$( )`, backticks, a subshell or a process substitution, in Bash and PowerShell alike; a chain that sleeps (`sleep`,
//   `Start-Sleep`) is a wait polling a run, and its refusal names the run's notice; a `sleep` behind `timeout` or `busybox`,
//   whose program is not looked past, gets the chain's words. Claude Code runs this hook on the
//   Monitor tool's commands too, handed over as Bash calls.
// A command's forms are judged before the chain, so a chain holding one says that form. Its program is found past
// assignments, shell keywords and the programs that run the next word (`command`, `env`, …), whatever its path or `.exe`;
// the interpreters are python, python3, python3.N, py and node.
// Lets pass: one command, whatever its options and redirections (`git show <rev>:<path> > <file>`, `git show <commit>
// --output=<file>`, `python x.py <<EOF`, a heredoc feeding no interpreter's program); any tool but Bash and PowerShell.
// How a command is read, and what that reading leaves outside (and so lets pass), is `shellCommands` in scripts/_shell.mjs;
// each command's options are read by scripts/_shell-block-reading.mjs, and judged by scripts/_judge-command-line.mjs.
// Acts only in a Roadkeeper project, through `runShellHook` (_hook.mjs), which reads and bounds the input. It never runs
// the command, runs no program, writes nothing and opens no network. A command it cannot read lets it pass, said on stderr.

import { runShellHook } from "./_hook.mjs";
import { judgeCommandLine } from "./_judge-command-line.mjs";
import { readShellBlockCommand } from "./_shell-block-reading.mjs";

process.exitCode = await runShellHook("shell-block", ({ commands }) => judgeCommandLine(commands.map(readShellBlockCommand)));
