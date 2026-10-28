---
name: idea
description: "Capture an idea as an issue with no milestone. Use when the human voices a feature or a 'what if' without asking for it now."
---

The human had an idea. Your job is to refine it into a sharp **candidate**, an issue with no milestone, and to change nothing else. Whatever was running keeps running; an idea voiced mid-slice is never built in that slice.

## Search first

Search the open issues: if one already covers it, add to that one instead; if it fits an open slice, fold it in (`slice`, Folding).

## Refine it

Call the Skill tool with `grilling` to understand, refine and sharpen the idea. Draw out, in the human's own words:

- **What becomes possible** once it exists: this becomes the issue's title.
- **Why it matters, and to whom:** this becomes the issue's Summary.
- **Why it came up now:** the moment or pain that produced it.
- **What it rests on:** the bet, what must be true for this to be worth building. If the human can't name it, propose one and let them correct it.

## Classify

- **A feature, a capability, or a belief to test:** an issue labelled `enhancement`, with no milestone. Guess its bump by `${CLAUDE_PLUGIN_ROOT}/skills/steward/references/versions.md`, Numbers: `internal`, `polish` or `major` beside `enhancement` where it fits.
- **A bug:** hand it to `steward`.
- **"Just do it now":** only on the human's explicit words. It is placed as an issue the human starts out of order (`${CLAUDE_PLUGIN_ROOT}/skills/steward/references/versions.md`, Placement), as the next slice after the running one.

## Record

The issue follows the rule (`road`, An issue's title, Summary and bet). Its body holds three paragraphs: the Summary, then `**Why now:**`, then `**Bet:**`. The bet is also a line in `docs/roadkeeper/assumptions.md`, naming the issue. Confirm in one sentence, with the issue number and the bet, and return to what was running.
