---
name: slice
description: "Take one slice, an issue on a milestone, from spec to real-green, and close the milestone when its last slice lands."
---

A slice is an issue on a milestone. You keep the order and the checkpoints; the build is Pocock's.

The issue tracker should have been provided to you. If not, tell the user to run `/setup-matt-pocock-skills`.

- **User-invoked skills** (`/grill-with-docs`, `/to-spec`, `/to-tickets`, `/implement-spec`, `/implement`, `/roadkeeper:retro-spec`): ask the human to run it, and continue when it ends.
- **Subagents:** every subagent launched in a slice, `/implement-spec`'s included, is briefed by `references/briefing.md`.
- **Ideas:** an idea voiced mid-slice goes to `idea`.
- **Structured project:** one with `docs/roadkeeper/dependency-rules.md`.
- **Board labels:** one per issue; each replaces the last. Label and close in separate calls.
- **Folding:** a new issue that shares files or a concern with an open slice folds into it: its body goes under the slice's `## Folds in`, its comments follow, and it closes as `duplicate`, "Folded into #N". Issues that would share a slice fold into one before a milestone takes them.
- **New rule:** where a coding rule is written. In Roadkeeper's repository (its root holds `ROADKEEPER_STANDARDS.md`), a general rule, one holding in any stack and product and naming no one project's path or tool, goes into that root `ROADKEEPER_STANDARDS.md`; Roadkeeper's own goes into its `CODING_STANDARDS.md`. In any other project, a rule goes into that project's `CODING_STANDARDS.md`, never the installed plugin; when it reads general, tell the human so in one line.
- **Cleanup:** once a branch lands in its base (a merger's merge, a fix round's push, the PR's merge), the session removes the worktrees that made or merged it, a merger's own included (first the link a tool made in one to the main checkout's install, so that install stays whole), then deletes, locally and on origin, the landed branch and every branch those worktrees held or started on, the Agent tool's `worktree-agent-*` included, each proven in its base. It deletes them by name, so a worktree `/implement-spec` already removed still loses its branches. The base stays; after a fix round's push, the PR's branch stays until the PR merges. A branch not in its base stays with its worktree; the human hears which and why in one line, and rules.

## Steps

A slice that fits a single ticket, with no new screen, skips steps 1–6: commit The Road's drawn page (`road`, The page); on a branch of its own, the human runs `/implement` on the issue, and the session builds under `references/briefing.md`'s Builders, as an implementer does; call the Skill tool with `pr`, then continue from step 7.

0. **Start.** Close the previous slice and its retro. Give the human `/compact next: #N; keep <what the next slice needs>`, ready to paste. Then mark the issue `active`; one with no milestone is placed first (`${CLAUDE_PLUGIN_ROOT}/skills/steward/references/versions.md`, Placement).
1. **Spec.** The human runs `/grill-with-docs` on the slice until dry, its bump and a `major` slice's ADR included (`${CLAUDE_PLUGIN_ROOT}/skills/steward/references/versions.md`, Numbers); what is left goes to Out of Scope or an issue with no milestone (`road`, An issue's title, Summary and bet). Then the human runs `/to-spec`. Once it publishes, and before step 4's approval, read the spec against the rules of `${CLAUDE_PLUGIN_ROOT}/ROADKEEPER_STANDARDS.md` and the project's `CODING_STANDARDS.md`, and bring the human any rule it breaks. Read its title and its Problem Statement's first sentence against the rule (`road`, An issue's title, Summary and bet), and bring the human each breach with a plain rewording. Close the slice issue with "specced in #N", and move its milestone, its kind and bump labels, and its `active` to the spec.
2. **Structure.** In a structured project, add a `## Structure` section to the spec issue (`references/structure.md`, Planning a slice).
3. **Mock.** A slice with a new screen brings a mock inside `tokens.css`, placed on the site map with its exits. Call `product-critique` on it; each finding is applied, or brought to step 4's approval.
4. **Approve.** The human approves the spec, with its structure drawing in a structured project, and the mock.
5. **Tickets.** The human runs `/to-tickets`. Each ticket carries, under "Decisions from #N this ticket carries", every spec decision it rests on.
6. **Build.** Commit The Road's drawn page (`road`, The page). The human runs `/implement-spec`: integration branch, tickets, PR. Its own code review is the one step 7 runs, not a second one; its fixes are step 8's. An implementer's report naming a choice its brief did not settle goes to the human in one line before its merger starts, so they rule on it before a review finds it and a fix round redoes it. A structured project with no structure command yet sets it up in this build (`references/structure-command.md`).
7. **Review.** On the PR's branch, start together:
   - call the Skill tool with `code-review`, the branch against the default branch; its Standards brief lists `${CLAUDE_PLUGIN_ROOT}/ROADKEEPER_STANDARDS.md` among the standards sources, since `code-review` searches only the project's repository;
   - the security review: a subagent applying Claude Code's `security-review` method to the branch's diff against the default branch (`references/briefing.md`, Reviews, **Security**);
   - in a structured project, run `node ${CLAUDE_PLUGIN_ROOT}/scripts/structure-check.mjs` in the PR's tree, or with `--root <tree>` from elsewhere, and the plan check against the spec (`references/structure.md`, Planning a slice, steps 1 and 4).

   Post their findings as one PR comment.
8. **Fix.** One fix round, once every review of step 7 is in. Bring the human only the findings that need their ruling, each said as what they would see; the rest go in one line of planned fixes. For each finding brought, the human decides: fix it now, later as an issue (`road`, An issue's title, Summary and bet), or never. A *never* is written down: an accepted row in `threats.md`, or an exception with its version in `dependency-rules.md`. A security finding of a kind neither `${CLAUDE_PLUGIN_ROOT}/ROADKEEPER_STANDARDS.md` nor `CODING_STANDARDS.md` names yet adds a line to the `## Security` of the file **New rule** names. The fixes go to one implementer subagent; in a slice the session built under `/implement`, the session makes them, under `references/briefing.md`'s Builders. The round is done when every finding brought has the human's ruling and the fixes are pushed to the PR's branch.
9. **Merge.**
   - **Look:** give the human the PR's changes page (`https://github.com/<owner>/<repo>/pull/<N>/changes`) and what it changes that can be seen: a page served on localhost from the PR's worktree, drawn by its own code, stopped after the look; new words, quoted. With nothing to see, the checks you ran. The human rules on each finding as in step 8.
   - **Green:** the green on the PR's head (`references/briefing.md`, Green), and the PR's latest CI run where the project has CI. A red goes to a fix agent (the session itself in a slice it built under `/implement`), or to the human when only they can rule.
   - **Merge:** once green and, where there was a look, the human says it looks right. Any fix repeats the look and the green on the new head.

   The PR closes the spec, or the slice issue, and its tickets. Open the merged spec's real-use issue, or the slice issue's, on the milestone, labelled `mock-green`, carrying step 10's steps. Each mock the build leaves adds a de-mock issue to the current milestone. Both follow the rule (`road`, An issue's title, Summary and bet). Then:
   - update `docs/roadkeeper/ARCHITECTURE.md` (`references/architecture.md`);
   - in a structured project, rerun the structure command so `structure.json` matches the code.
10. **Real use.**
    - **You:** run what shipped yourself (Roadkeeper's: `claude -p` in a subshell, `(cd <worktree> && claude -p …)`), and say what you checked.
    - **The human:** what the look could not show and only they can do (`road`, Waiting on you, rules 1 and 2). None: no human step.
    - **No live instance:** draw the case from a copied snapshot of its data, on a scratch page under `.run/`.
    - **Later use:** when real use comes only with a later event (another slice, a milestone's close, another project's session), the real-use issue stays `mock-green` and names that event in its body's last paragraph, `**Waits on:** <the event>`, one short line kept current; once only the human's step is left, the line goes and `waiting-on-you` joins `mock-green`; the retro waits for it.
    - **Done:** it works, by your runs or the human's word: `real-green` on the real-use issue and on the spec, or the slice issue; the real-use issue closes with one line of what was tried. The human runs `/roadkeeper:retro-spec`.

## When the milestone's last slice lands

1. Call `product-critique` on the whole product; its "When this runs" says when the walk is isolated. A blocker holds the close until it is fixed as a slice of this milestone, or the human ships it, with its reason in the release's notes. Every other finding, and a shipped blocker, is placed by the re-plan.
2. **Architecture.**
   - In a structured project, run `node ${CLAUDE_PLUGIN_ROOT}/scripts/structure-check.mjs --stamping <the milestone's version>` (`references/structure.md`, "At a milestone").
   - Spawn `architecture-reader`, with the check's output when there is one. It writes an HTML report and opens it.
   - The human picks which cards become issues (`road`, An issue's title, Summary and bet), with no milestone, each carrying its proposed fix, folded where they fit. A candidate that moves a module to another level, or adds or removes a level, needs an ADR before it joins a milestone.
3. Close the milestone (the tracker doc's **Close a milestone**).
4. **Release and re-plan** (`${CLAUDE_PLUGIN_ROOT}/skills/steward/references/versions.md`): its Release, then its re-plan.

## End

End a slice, and a milestone's close, by calling `road`.
