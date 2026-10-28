# Versions

How milestones fill, open, order and take their numbers, and how one is released.

## Milestones

A milestone is titled `vX.Y.Z — <what it can do>`.

- **The cap:** at most five slices. Counted: the slices really done and to be done, open or closed as completed; de-mock debt counts; a spec and its slice issue are one. Not counted: folds, tickets, `Real use of #N`, `waiting-on-you`, and slices closed undone.
- **WSJF** orders the milestones and the slices in each: (importance + risk) ÷ cost, each scored 1–3, the scores shown in the proposal. The walking skeleton is always first. A milestone moves only when this order says so.
  - Importance: a broken promise first; a new promise and polish alike, raised by the issues and metric readings pointing at it.
  - Risk: it tests an open assumption.
  - Cost: its size.
- **Renaming:** a milestone is renamed when, after moves and folds, its name no longer says what its slices make possible together.

## Placement

- **A bug** joins the current milestone; when it is full, the first open milestone with room; else a new milestone opens at once for it (the tracker doc's **Create a milestone**).
- **Candidates** wait for the re-plan.
- **A new milestone** goes where WSJF puts it, never before the current one.
- **An issue the human starts out of order** joins the current milestone. When that is full, the current milestone's unstarted slice with the lowest WSJF moves to the next open milestone.

## The re-plan

At a milestone's close, read every open milestone and every candidate together: fold, merge, place, order, rename, renumber. A candidate waits past it only with a reason written on it. Between re-plans an open milestone keeps its scope.

## Numbers

Each slice carries a bump; a milestone takes its slices' largest.

- **X:** the user must act to keep working (move a file, change a command they type), or the human names a new era at a re-plan. Label `major`; the slice's grill writes an ADR, and a new era's re-plan writes one for it.
- **Y:** a new promise: a line the promises gain, a listed command's usage included. Label `enhancement`.
- **Z:** a fix (`bug`), internal work (`internal`), or an enhancement that adds no promise (`polish`).

The bump is guessed when the issue opens and settled in the slice's grill, against the promises users rely on: the one-pager's lines; for Roadkeeper, the README's "What you can rely on".

- **Before the launch:** `v0.Y.Z`, a breaking slice raising Y; the launch is `v1.0.0`.
- An open milestone's number is a forecast until the release's tag fixes it.

This is SemVer narrowed on purpose: X only when the user must act, not for every change that might break someone. And widened: internal work and polish are Z.

## The forecast

`node ${CLAUDE_PLUGIN_ROOT}/scripts/version-forecast.mjs [<milestone number> ...] [--apply]`, in the project's root, at each placement and each re-plan.

- It prints each open milestone's slices counted, room, bump and forecast title, then the slices with none of `major`, `internal`, `bug`, `polish`, `enhancement`.
- The milestone numbers are the open milestones' new order; without them, the order of their titles' versions.
- `--apply` renames the milestones whose titles change. Apply the renames and say them; the order itself takes the human's word.

## Release

When a milestone closes after v1; v1's is genesis's release gate:

1. call the Skill tool with `launch`;
2. update the README: its "What it does now", the list of what the product can do, where the release adds or changes something; the product's screenshots, light and dark, retaken if the screen changed; the product's social card, where it has one, remade when the line or the logo it shows changes, and uploaded again by the human; its hook lines (Try it, What you can rely on), checked against `ARCHITECTURE.md`; and its "Where it is going", where it has one, to the open milestones' titles, written with the human;
3. write the number into the product's manifest (Roadkeeper: `plugin.json`; a web project: `package.json`) and commit it with the README;
4. tag that commit `vX.Y.Z`;
5. a project with a public copy publishes it with the command its `CODING_STANDARDS.md` names;
6. write the release: what the product can do now, and the launch checklist under it; on the public copy where there is one.
