---
name: road
description: "The Road: redraw the page the human follows, and write what the human owes as a waiting-on-you issue."
---

What the human sees: the page, and what is waiting on them.

## The page

The Road, `docs/roadkeeper/road.html`, is drawn from the tracker, `docs/roadkeeper/ARCHITECTURE.md`, `docs/roadkeeper/one-pager.md` and the structure files; the tracker's snapshot is kept in `docs/roadkeeper/issues.json`, which `.gitignore` names. It is drawn on the default branch only: a page drawn on a feature branch would travel in its pull request. There, a hook redraws it in the background after every tracker write in the session.

1. On the default branch, before the page is committed, run `node ${CLAUDE_PLUGIN_ROOT}/scripts/road.mjs` in the project root: the hook's redraw may still be running. On a feature branch, draw nothing.
2. Commit the drawn page with the next commit on the default branch, and before a branch is cut.

Done when the default branch's page is drawn from the current tracker and files.

## An issue's title, Summary and bet

How every issue reads where The Road shows it, for someone who does not read code:

- **Title:** what becomes possible, in words that reader follows. A real-use issue's: `Real use of #N: <the plain gain>`.
- **Summary**, the first paragraph under the title (a spec's: the first paragraph under its Problem Statement): why it matters and to whom, never the title again. A bug's says what goes wrong for the person using it; a waiting-on-you issue's, what you are asked and why.
- **`Bet:` line:** plain too.
- **Below the Summary:** history, paths, case ids, tool and flag names, commits and PR numbers.

## Waiting on you

Anything the human owes outside this conversation is an issue labelled `waiting-on-you` (An issue's title, Summary and bet). An issue in flight wears it beside its board label. One that waits on something else first ends on a paragraph of its own, `**Waits on:** …`; The Road sets it apart until the line goes, which Claude removes when that comes. Before opening one:

1. **Hand over only what only the human can supply:** their judgment, a credential, a device, a region, their eyes, a decision with consequences. Name it in one sentence. If the honest answer is "nothing, I just had not done it", do it instead.
2. **A stranger could act on it alone**, with the product, a browser and the issue, and nothing else. The issue says:
   - the exact target: the full URL, the file and line, or the command;
   - the exact thing to look for: the value, string or behaviour, quoted;
   - what a pass looks like, and what to do if it fails;
   - why it is theirs: the sentence from rule 1.
3. **It speaks to the human as "you"**, in the language the project's tracker is written in; the human's own words are quoted translated into it. The agent is "Claude"; a Roadkeeper step (a session, a critique, a grill, a retro) is said as what happened, not by its name; another project is named with what it is to the human the first time it appears.

When the human answers, write the answer as a comment, remove the label, and close the issue.
