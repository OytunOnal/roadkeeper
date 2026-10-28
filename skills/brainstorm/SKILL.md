---
name: brainstorm
description: "Turn a raw idea into a one-pager: diverge, converge on market research, grill the chosen direction."
---

# Brainstorm

Take the idea genesis passes through four phases. **Be honest, not supportive.**

## Phase 1: Understand & Expand (Divergent)

1. **Restate the idea** as a crisp "How Might We" problem statement. This forces clarity on what's actually being solved.

2. **Ask 3-5 sharpening questions.** Focus on:
   - Who is this for, specifically?
   - What does success look like?
   - What are the real constraints (time, tech, resources)?
   - What's been tried before?
   - Why now?

3. **Scan the landscape.** Call `market-research` once on the problem space: who solves it today, with what, and where they stop. Ground the variations in what it finds.

4. **Generate 5-8 idea variations** through the lenses: inversion, constraint removal, audience shift, combination, simplification, 10x version, expert lens. `frameworks.md` in this skill directory has more.

**If running inside a codebase:** Use `Glob`, `Grep`, and `Read` to scan for relevant context — existing architecture, patterns, constraints, prior art. Ground your variations in what actually exists. Reference specific files and patterns when relevant.

Done when the problem statement is written, who it is for, success and the constraints are answered, and 5-8 variations are on the table.

## Phase 2: Evaluate & Converge

After the user reacts to the variations:

1. **Cluster** the ideas that resonated into 2-3 distinct directions. Each direction should feel meaningfully different, not just variations on a theme.

2. **Stress-test** each direction on user value, feasibility and differentiation: `refinement-criteria.md` in this skill directory.

3. **Name each direction's assumptions** as must, should or might be true (`refinement-criteria.md`, Assumption audit).

4. **Research** the assumptions: call `market-research` on the ones research can test. Put each capability it proposes to the user as `now`, `later` or `never`. When research refutes every direction or opens one not yet on the table, go back to Phase 1.

Done when 2-3 directions stand, each with its must-be-trues and a research verdict.

## Phase 3: Grill

Once the user picks a direction, call the Skill tool with `grilling` on it until **dry**: a round that changes nothing.

Beyond Phase 1's questions, each of these is grilled or deferred with a reason: who pays, and how much · audience size · how they find it · the deadliest assumption · what it will not do · data, legal and source-terms constraints · the planned waves. Every answer that rests on a belief adds a line to `docs/roadkeeper/assumptions.md`.

An assumption research can test now goes to `market-research`, and its finding seeds the next round; one only a build can test waits for the plan. When a finding refutes the direction's deadliest assumption, go back to Phase 2.

Done when dry, and each item above is grilled or deferred.

## Phase 4: Sharpen & Ship

Write the one-pager:

```markdown
# [Idea Name]

[One sentence: what the product is, and for whom; The Road shows it under its title]

## Problem Statement
[One-sentence "How Might We" framing]

## Personas
- **[Persona]:** [one of the people the product is for: who they are, what they come to do; `product-critique` walks each one]

## Recommended Direction
[The chosen direction and why — 2-3 paragraphs max]

## Key Assumptions to Validate
- [ ] [Assumption 1 — how to test it]
- [ ] [Assumption 2 — how to test it]
- [ ] [Assumption 3 — how to test it]

## MVP Scope
[The minimum version that tests the core assumption. What's in, what's out.]

## Not Doing (and Why)
- [Thing 1] — [reason]
- [Thing 2] — [reason]
- [Thing 3] — [reason]

## Open Questions
- [Question that needs answering before building]

## Register
[The voice the product carries, and the neighbourhood it must not be mistaken for]

## Non-negotiables
- [A promise the product cannot exist without — each becomes a symptom check in slice 1]

## Viability
[Product level only (the scale ADR from genesis stage 1): audience size · the money decision · success metrics, each with its source · 6–12 month goals]
```

Save it to `docs/roadkeeper/one-pager.md`. Then:

1. Call `devils-advocate` on the one-pager, Viability included.
2. The user decides: **continue** (approves the one-pager), **pivot** (back to Phase 1 or Phase 2), or **stop**.

Done when every devils-advocate finding is fixed or accepted, and the user has decided.

<!-- Adapted from addyosmani/agent-skills skills/idea-refine at 1401c8b (MIT, (c) 2025 Addy Osmani). -->
