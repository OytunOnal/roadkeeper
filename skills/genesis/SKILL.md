---
name: genesis
description: "Take an idea to a launched v1: scale, brainstorm, design, plan, slice by slice, release gate. Roadkeeper's run-once mode; hands over to steward at v1."
disable-model-invocation: true
---

You take an idea in the current repo to a launched v1. Each stage calls a skill; you keep the order and the checkpoints.

A project that already has code, docs or notes starts with `adopt`, not here. If `docs/roadkeeper/inventory.md` exists, read it and the adoption ADR before stage 1, and carry it:

- **Brainstorm:** start from what the code already proves and what the new direction leaves untested; research weighs the project's own modules the way it weighs competitors.
- **Design:** the existing UI may be one of the variants; the human still picks.

The issue tracker should have been provided to you. If not, tell the user to run `/setup-matt-pocock-skills`.

- **ADR:** a decision that is hard to reverse goes to `docs/adr/`, in the `domain-modeling` format.
- **waiting-on-you:** written as `road` says.
- Every stage ends by calling `road`.

## Stages

### 1. Scale

1. Ask four questions: is it hard to reverse? will anyone else use it? does it touch money or personal data? should it be alive in six months?
2. Recommend **Sketch**, **Build** or **Product**; the human decides.
3. Write the level and why as an ADR.
4. Sketch ends here: call `prototype`. Upgrading later re-enters at stage 2.

### 2. Brainstorm

Call `brainstorm` on the idea. It writes `docs/roadkeeper/one-pager.md` and `docs/roadkeeper/assumptions.md`. A stop ends genesis.

### 3. Design

1. Build 2–3 divergent HTML/CSS mockups of the core screen in `docs/roadkeeper/design/`, against the one-pager's Register.
2. Call `design-critique` across them.
3. The human picks; write it as an ADR.
4. Extract the winner into `tokens.css`, and rewire the winner to render from it.
5. Keep the product's name a working name until the release gate: one token, one constant.
6. When a second screen exists, draw the site map in `docs/roadkeeper/design/site-map.md`.

### 4. Plan

1. Add Roadkeeper's labels: `active`, `mock-green`, `real-green`, `waiting-on-you`, `major`, `internal`, `polish`.
2. Group the slices into milestones and order them by `${CLAUDE_PLUGIN_ROOT}/skills/steward/references/versions.md`.
3. Open one issue per slice on its milestone (`road`, An issue's title, Summary and bet), labelled `enhancement` or `bug`, and `major`, `internal` or `polish` where that file's Numbers say.
4. The walking skeleton is the thinnest end-to-end path, deployed to its launch shape, with the design wired in, the structure declared (`${CLAUDE_PLUGIN_ROOT}/skills/slice/references/structure.md`), Roadkeeper's tools set up (`${CLAUDE_PLUGIN_ROOT}/skills/slice/references/project-tools.md`) and the non-negotiables as symptom checks.
5. Write `CODING_STANDARDS.md` at the root from `references/coding-standards.md`. Walk `${CLAUDE_PLUGIN_ROOT}/ROADKEEPER_STANDARDS.md` with the human, section by section: each default the human changes becomes a line under `## Departures`, with the human's reason. Call the Skill tool with `setup-pre-commit`.
6. With stored data, write the durability decision as an ADR.
7. At Product level, write `docs/roadkeeper/threats.md` from `references/threat-model.md`.
8. Bind each line of `docs/roadkeeper/assumptions.md` to the slice issue that tests it, or defer it with a reason.
9. After an adoption, turn each keep-but-fix, port and rebuild verdict of `docs/roadkeeper/inventory.md` into an issue, then delete the inventory; git keeps it.

Done when every slice is on a milestone, in that file's order.

### 5. Slice loop

For each slice, in milestone order, call the Skill tool with `slice`.

### 6. Release gate

Before anything reaches real users:

1. **Name.** Run `references/naming-loop.md`.
2. **Licence.** For code, for data, and for anything derived from a source with its own terms; say what each obliges a reuser to do. Write it as an ADR.
3. **Launch.** Call the Skill tool with `launch`, its first launch included. Call `devils-advocate` on the launch checklist's declined items and their reasons; the human approves.
4. **Release.** Run `${CLAUDE_PLUGIN_ROOT}/skills/steward/references/versions.md`, Release, steps 2–6.

## Done

- The v1 milestone is closed, every slice `real-green`.
- Product critique's blockers are cleared.

From then on, feedback enters through `steward`.
