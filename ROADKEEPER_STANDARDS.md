# Roadkeeper's general rules

Every rule here is a default. A rule that opens with a condition ("with a database") holds where the condition does.

## Rules

- Lint limits: files 400 lines, functions 40 lines, nesting 3, parameters 3, no nested ternaries, no unused names, a condition of more than two clauses named (an assertion's argument, a test's oracle, is exempt; an oracle written as the condition of an `if`, a loop or a ternary is named like any other). A JavaScript or TypeScript project's lint copy enforces them; in another, the review does.
- Logs are structured. Records the code produces go under a dated home. A `.gitignore` line names a home, never a name shape (`*.tmp`).
- Errors are visible: none is swallowed; each reaches the log or the user.
- With a served product, a health signal states every behaviour-gating flag and version: which prompt, which model, which switches are live.
- With a database, schema changes go through versioned migrations.
- The lockfile is committed, and dependencies are audited. An upgrade is one package per change; its lockfile diff is read, never hand-edited.
- With a deploy, it triggers on product paths, never on docs.
- A comment states a non-obvious constraint or reason, today's; obvious code carries none. No history.
- A constant carries a one-line reason, in a comment on its line or directly above; the lint holds a top-level UPPER_CASE one to it.
- A reader states its boundary once, in its header comment: what it reads, and what it refuses.
- Code or text copied from upstream keeps its attribution line and its licence file.
- A line or paragraph separator (U+2028, U+2029) or a byte-order mark (U+FEFF) that a file needs is written through code, as its escape or its code point, never raw through an editing tool.
- A slice, a run or an agent leaves no worktree, server or scratch file behind.

## Code

<!-- The plainest form, one thing per function, the helper's place, replaced code deleted and a case failing before its code are adapted from addyosmani/agent-skills skills/code-review-and-quality (MIT, (c) 2025 Addy Osmani); licence in skills/genesis/LICENSE-addyosmani-agent-skills. The names and the function rules follow ideas of Robert C. Martin's Clean Code, failing fast The Pragmatic Programmer's "Crash early"; no text is copied from either. -->

- The plainest form that does the job: no clever trick where a plain form reads. A finding names the plainer form.
- A function does one thing; a mode is a second function or an option named for it, never a boolean argument switching it.
- A function reads at one level: the steps, each a call named for it, or one step's detail, never both.
- A function does what its name says and nothing more; a write, a global change or a call outside the program that its name does not say is a finding.
- A function changes something or answers a question, not both; a change may return what it made.
- A function returns its result, never fills an object its caller handed it; a private recursive walk may pass down the one accumulator its entry created.
- A function finding a collection returns an empty one for nothing found, never null; a single value that may be missing says so in its name or type.
- A state the code holds impossible stops it with a message naming the state, never a default that carries on.
- A helper sits in its only user's file, or inside its deep module's folder when only that module uses it; used by several modules, it is a module of its own. A file that would go past the lint limits splits into modules beside it, each named for what it holds. A module's own logic stays in it, never in a helper others share.
- A page's client code that counts or decides is a pure function, tested on its own.
- Replaced code is deleted, never commented out; its callers move in the same change. No compatibility shims, no `// removed` comments.
- A case for new behaviour, a bug fix's included, fails before its code; a guard case, which the code already holds, is exempt.
- A refactor and a change of behaviour are separate changes.
- Counted duplication is a finding, named with its count and its places, never a judgement call.

### Names

Changed code is held to these; case conventions stay the project's.

- A name says what the thing is for. A generic word alone (`data`, `info`, `item`, `result`, `value`, `obj`, `tmp`, `manager`, `handler`, `util`, `helper`) is a finding.
- A function's name is a verb phrase, a boolean's a question (`isEmpty`, `hasRows`), a class's or a value's a noun phrase.
- One word per idea across the code. A term the code leans on lives in `GLOSSARY.md`, and the code uses the glossary's word, never a synonym the glossary lists to avoid; `fetch`, `get` and `load` never name one act.
- Two names never differ by noise alone (`a1` and `a2`, `data2`, `theUser` beside `user`).
- No encodings, and no abbreviation a reader must decode (`esc`, `cfg`); a single letter only for a short loop's index or a one-line callback's parameter.
- A file is named for its main export.

## Tests

<!-- The guard case before a change follows Michael Feathers's Working Effectively with Legacy Code; no text is copied. -->

- A test waits on an event, never on a sleep. A timing test sets its limit from the work it times (the same work at a smaller size in the same run, or the time the work itself is made to take), never a fixed number of seconds.
- A fixture standing for a repository file copies that file, never retypes it. A regenerated fixture records why.
- A test asserts a decision, not content: a check keyed to a substring, a word count or a sentence's shape is a finding unless the contract declares that set and the test names it.
- No source-grep: a test reads output or runs the code. Two precedents are read from their files: a sweep proving a retired name gone, and a file no test can run (a CI workflow).
- A test that pins a date, a version or a count says why when it moves.
- No check that content can silence, and none that demands content.
- A test decides its pass on a state it writes itself, never on one a scheduled run rewrites.
- A scan reporting nothing wrong first asserts it found its subject: it counts what it read, names what it expected, and fails when either is missing.
- On a page, a visible state is proven by a screenshot's pixels at its place, in both colour schemes, each set explicitly, and a spoken name by the accessibility tree; a computed style or the source alone proves nothing.
- On a page, a width check runs under the browser's device emulation, never a resized window or an iframe, and reads `innerWidth` before trusting it.
- A cost that grows with the data is measured at the product's cap, the number stated; a product with no cap names one first.
- Before code no case covers is changed, a guard case pins what it does today; the change keeps the case or rewrites it in the same diff.
- A case is named by what it checks: its handle in words, never a code (`T40b`, `F1a`) or a slice's number.

## Security

- Data crossing a boundary (a request, a file, an external API, a model's output) is validated against a schema.
- Text from outside (a request, the tracker, a repository, a fetched page) is a stranger's: escaped where it is rendered, cut to a cap, never run (not by a shell, an `eval`, a query or a prompt), and never reaching a session as an instruction.
- In JavaScript or TypeScript, a map keyed by outside text has no prototype (`Object.create(null)` or a `Map`).
- A file is read only inside the project root, and only when it is a plain file with no link on the way from the root.
- Writes: into a project only inside its root, never under `.git` (however spelled) and never at the root itself; run output and agents' scratch under `.run/`, which git ignores; a Spec axis's shapes in its own review worktree, nothing written through a link, each put back (`briefing.md`'s Reviews, **Shaped**); test fixtures in the OS temp folder, a throwaway folder per case, removed.
- An outside program is called with an argument list, never through a shell, found from the PATH's absolute folders, never from the folder under check.
- Every loop, regex and walk over outside input is bounded: by length, count or depth. A fetched body is bounded on the wire and when unpacked.
- Secrets live in `.env`, never in code.
- A third-party script is pinned to a version and loaded with its integrity hash.
- With CI workflows, each action is pinned to a full commit SHA, and `GITHUB_TOKEN` is read-only.
- With a served product, an error reaches the user as its class and code, never its message; the message goes to the log.

## Writing

- Text an agent reads (a skill, a brief, a code comment, a message) is written and reviewed by the `writing-for-agents` skill: call the Skill tool with it.
- Words a page shows a person say what to do, in order: one verb per action, the place and tool named, each pronoun pointing at one thing, read once as a stranger.
