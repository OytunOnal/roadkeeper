# Briefing subagents

What a slice's subagents are told: implementers, the merger, the code-review axes, the security review, `product-critique-agent`, `architecture-reader`, and `analyst` at the slice's retro.

- A brief points to the spec, tickets, commits and this file. It copies only what this file says to paste.

## Every brief

- **First:** every brief opens with this block, pasted whole:

  > **Shell**
  > - The shell starts where you work. No `cd`.
  > - One command per call. `&&`, `;`, `|` and `$( )` are chains.
  > - Literal arguments. No `$variable`, glob or loop: use Glob, Grep or a script file.
  > - A file you write yourself is written with Write or Edit, or as a script file. No heredoc.

- **Issues:** the brief pastes the tracker's read command (the tracker doc's **Read an issue**). One call per issue.
- **Writing:** what the agent writes is plain and short, each thing once.
- **Scratch:** one folder the brief names, `.run/<role>-<ticket>/`. Make it first, write only there, delete it after the report.
- **Keep changes:** discard nothing (no `git checkout --`, restore or stash).
- **Plugin path:** the brief writes out the plugin's folder for `${CLAUDE_PLUGIN_ROOT}`; a Bash call has none.

## Green

The plugin's green, `node ${CLAUDE_PLUGIN_ROOT}/scripts/green.mjs`: the project's commands file's steps and the structure check, then the tested tree stamped; a stamped tree runs nothing.

- **The session's:** run once, before the merge, in the worktree holding the PR's head. A red one goes to a fix agent (the session itself in a slice it built under `/implement`), then runs again.
- **Builders, fix rounds and mergers** run the suites their change touches (Builders, **Build**), never the green.
- **Plainly:** a green or a suite runs in the foreground, with no redirect, wrapper or capture, its output read from the result; nothing is edited until it ends.
- **Report:** the output's last lines, and the exit code where the output does not end on it.

## Red-before and same-cases

The plugin's, run in the worktree; `--help` for the rest.

- **Red-before:** `node ${CLAUDE_PLUGIN_ROOT}/scripts/red-before.mjs <commit> <test file> ...` runs today's named test files on the commit's code and prints each case with its outcome.
- **Same-cases:** `node ${CLAUDE_PLUGIN_ROOT}/scripts/same-cases.mjs <commit> [test file ...]` runs them on the commit and on the working tree, and says same outcomes or each case whose outcome changed.

## Builders

An implementer subagent, a fix round, or the session building a slice under `/implement` or fixing it.

- **Launched at once:** each builder brief, fix rounds too, launches as soon as it is written; the human gets a short summary of it as it starts. Merger briefs get none.
- **Start:** fetch, then reset your own branch onto origin's tip of the integration branch (the PR's branch in a fix round): the branch your worktree was given, or the branch of its own that the session building a slice under `/implement`, or fixing it, works on. Check out no other branch.
- **Push:** `git push origin HEAD:<branch>` to the branch the brief names (the session building a slice under `/implement`, or fixing it: its own branch); no force push. A brief that names none: push nothing.
- **Build:** with the `tdd` skill. Run the suites your change touches, those reading the files you edit: by case id while you work, whole at the end.
- **Red first:** quote each case's line from red-before on the base.
  - Green there: report it as a guard, and keep it.
  - Red only because its file or the entry it calls is missing, or because the base refuses its input for another reason: not red; report it apart, with the reason the base gave.
- **Move:** a move, a refactor or a suite split is its own commit, proven by same-cases on the base (code) or by a diff whose lines only move (text), naming the test files that read what moved; every test only when the move crosses modules. A ticket that also changes behaviour, rewords what moved, or adds a rule commits that after the move. A split's cases keep their ids, each unique across its files.
- **Moved case:** what a case moved to another suite asserted that the new suite cannot see stays asserted where it was.
- **Commits:** a move carries the path fixes and debt rows that keep it green.
- **Finish:** merge the base's tip into the branch with `--no-commit`. In a structured project, when the merge changes `docs/roadkeeper/structure.json`, rerun the structure command `CODING_STANDARDS.md` names, a conflict there included, and add its output. Then commit the merge.
- **Report:** branch, commits, the suites' last lines, each choice the brief left open (one line each), what it could not do.

### Merger

- Open origin's tip of the integration branch detached. Never check the name out.
- Read the implementer's commits (Reviews, **Diff**) against Builders, **Commits**; a break is reported, not merged.
- Merge one implementer's branch as Builders' **Finish** says. Keep both sides' intent through a conflict.
- Run the suites the merge touches, whole; push to the integration branch by name; report like an implementer.
- Close the ticket it merged (the tracker doc's **Close**) with "Merged into <branch> at <sha>".

## Reviews

- **Spec axis gets:**
  - the builders' reports, whole;
  - red-before's command.
- **Spec axis starts** like a builder (Builders, **Start**), and pushes nothing.
- **Spec axis runs:** what the slice ships, on this repository, and checks one number of its output by hand. Suites only through red-before, or one case at a time by its id.
- **Shaped:** each new rule the slice ships is run where it fires. The Spec axis sets up the shape in its own review worktree (a second root file, a one-file module, a linked folder), one at a time, each from a worktree with no changes; runs the rule; reads its output against the spec; puts the shape back before the next. A shape for a tool builders run (red-before, same-cases, the green, a hook) is laid in a scratch project, a repository made for the shape inside the review worktree, and runs from that project's main checkout and from a linked worktree of it under its `.claude/worktrees/`. A rule that reads committed files gets its shape committed there, the commit taken back after. A linked folder points only to a folder made for it inside the worktree; it is removed as the link alone, by Bash `rm <link>` without `-r`; links the tools laid are left alone. Every brief's **Keep changes** and **Scratch** yield to these shapes. The report names each shape and what the rule printed on it; the shapes come from the spec's rules.
- **Report lines:** each "not used" or "could not" in a builder's report is a finding to rule on.
- **Changed values:** follow each changed name, path, constant or format to every reader, found with the Grep tool. Name the one missed.
- **Moved text:** for a ticket that moves or merges prose, the Spec axis places every source line, section by section, old line → new line or none; a moved line is placed by the diff, a changed one by hand (**Diff**); each none is a finding.
- **Writer's lines:** a reader of another program's output is read against every form that program's source prints; the review lists them and names any left to the reader's fallback.
- **Client behaviour:** test it as a user reaches it: a real keypress, a real control. A handler called from script is reported as scripted.
- **Diff:** `--stat` first, then the diff written with `--color=always --color-moved=dimmed-zebra` into the scratch folder (`--output=`) and read in parts: a dim or bold line moved, a red or green one changed, found with the Grep tool and `^\x1b\[(31|32)m`. The same for one commit's `git show`, a merge commit's with `--diff-merges=first-parent`. A file at a revision: `git show <rev>:<path> > <scratch file>`, in Bash; `--output=` leaves that file empty.
- **Commits:** the Standards axis checks them against Builders.
- **Security:** the bar is `${CLAUDE_PLUGIN_ROOT}/ROADKEEPER_STANDARDS.md`'s and `CODING_STANDARDS.md`'s `## Security`, and the accepted rows of `docs/roadkeeper/threats.md`. The axis reads the branch's diff against the default branch as **Diff** says and applies `security-review`'s method to it: the skill itself reads the session's own checkout, so from a review worktree it sees no diff.
