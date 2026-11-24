#!/usr/bin/env node
// @level main
// Roadkeeper — the merge guard (PreToolUse hook on Bash and PowerShell, scripts/hooks.json): nothing lands on the default
// branch, nor as a tag, that is not green.
//
// Among a command line's simple commands (`shellCommands`, scripts/_shell.mjs), each read past the programs that run
// the next word (`command`, `env`, …), catches `gh pr merge`, a `gh api` call on a pull request's merge path that is no
// GET, and a `git push` landing on the default branch (what origin/HEAD names, else main, else master) or a tag: a
// destination git expands there (`heads/<branch>`, `tags/<tag>`) too. Refuses (exit 2, one line on stderr: fixed words,
// the commit's hash and the green's command) when a commit that lands is not green: its tree holds no green stamp and,
// where the commands file names no docTests, differs from every stamped tree in a file its readByNothing leaves out
// (scripts/project-tools/, `landingRefusal`). Refuses, in fixed words, a git command given an alias on its command
// line (`-c alias.…`, `--config-env alias.…`, a GIT_CONFIG_* assignment), which can run a push under another name.
// What lands: for `gh pr merge [<pr>] [-R <repo>]` and `gh api …/pulls/<pr>/merge`, the pull request's head, which
// `gh pr view --json headRefOid` says; for `git push`, each refspec's source whose destination is the default branch or
// a tag (`tag <name>` too), with no refspec the current branch where it pushes to the default one, `--all`'s default
// branch, `--tags`' and `--mirror`'s tags. The repository is the one git acts on: under `-C`, `--git-dir`,
// `--work-tree`, and a GIT_DIR or GIT_WORK_TREE assignment before it.
// Passes: a commit the remote's default branch already holds, as its remote-tracking ref says; a push of any other
// branch; a deletion; `--dry-run`; `gh pr merge --disable-auto`. Passes, saying nothing, where the command's repository
// holds no Roadkeeper docs folder or no commands file; a commands file it cannot read refuses, naming why. Not read, and so
// passed: a push or merge inside an evaluated string (`eval`, `bash -c`, `sh -c`, `Invoke-Expression`), a variable or
// a script; the guard catches a session's mistake, not a session hiding a push (docs/roadkeeper/threats.md, row 12).
// The commands are read, and git and gh asked, by scripts/_landing-commands.mjs; the landing rule is
// scripts/_judge-landing.mjs's.
// Only reads: its call through `runShellHook` (_hook.mjs), which bounds the input; git and gh, each an argument list
// found on the PATH's absolute folders. Runs no green and writes nothing. A command it cannot read lets it pass, said on
// stderr.

import { resolve } from "node:path";
import { branches, runShellHook } from "./_hook.mjs";
import { currentBranch, landedCommits, landingCommand, placeOf } from "./_landing-commands.mjs";
import { judgeLanding } from "./_judge-landing.mjs";

// One landing command judged from the folder `cwd`: its refusal, or null when it passes.
function judged(tools, found, cwd) {
  const place = placeOf((found.at ?? []).reduce((dir, to) => resolve(dir, to), cwd), found.place);
  const { root } = place;
  const rules = root ? tools.landingRules(root) : null;
  const remote = found.push?.remote ?? "origin";
  const landed = () => {
    const { home } = branches(root);
    const branch = { current: currentBranch(place.repo), home, remoteRef: tools.remoteHome(root, remote, home) };
    return { ...landedCommits(place, found, branch), home };
  };
  return judgeLanding({ rules, alias: found.alias }, landed,
    ({ commits, home }) => tools.landingRefusal(root, { remote, home, commits, patterns: rules.patterns }));
}

// The refusal of the first landing command among a command line's that is not green; null when every one passes.
async function judgeLandings({ commands, cwd }) {
  const found = commands.map((s) => landingCommand(s.words)).filter(Boolean);
  if (!found.length) return null;
  const tools = await import("./project-tools/project-tools.mjs"); // loaded only for a landing: every other call stays fast
  for (const one of found) {
    const refusal = judged(tools, one, cwd);
    if (refusal) return refusal;
  }
  return null;
}

process.exitCode = await runShellHook("merge-guard", judgeLandings, { scopesItself: true });
