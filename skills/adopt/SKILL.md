---
name: adopt
description: "Bring an existing project — code, docs, notes — under Roadkeeper: one question about the new direction, an evidence-graded inventory, a tour for the human to correct, then the full Genesis with the inventory as input."
disable-model-invocation: true
---

Existing material is input to decisions, never a decision already made.

## 1. One question

Ask the human: **what is the new direction, and what changes?** The answer names the *changing assumptions*, the axis every inventory verdict is argued on. Write it as the adoption's ADR.

Done when the direction and the list of what changes are written down.

## 2. Inventory

Hand the direction to the **inventory** agent.

Done when `docs/roadkeeper/inventory.md` exists and every verdict cites its evidence.

## 3. Tour

Walk the human through the inventory, module by module, and take their corrections. Then:

- Write `CODING_STANDARDS.md` at the root from genesis's `references/coding-standards.md`, filled with what the codebase already does; say which lines it has nothing for, and why. Where the codebase differs from `${CLAUDE_PLUGIN_ROOT}/ROADKEEPER_STANDARDS.md` on purpose, write a line under `## Departures` with the human's reason; a plain breach goes into the inventory as a keep-but-fix.
- Draft `docs/roadkeeper/dependency-rules.md` from the modules found, a level proposed for each and corrected by the human (`${CLAUDE_PLUGIN_ROOT}/skills/slice/references/structure.md`, "Adopting").
- Set up Roadkeeper's tools from `${CLAUDE_PLUGIN_ROOT}/skills/slice/references/project-tools.md`, filled with what the codebase already runs.

Done when the human has said the inventory is right.

## 4. Hand over to genesis

Genesis is user-invoked and adopt cannot start it. Close with one message: the adoption ADR, the corrected inventory, the open questions carried forward, and the next command, `/roadkeeper:genesis`.

Adopt is done when the corrected inventory exists and the human has the command to start genesis.
