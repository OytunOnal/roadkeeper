# Structure

How a project's modules are laid out, checked and planned. Uses the vocabulary of `codebase-design` (interface, depth, seam, adapter), Module, Deep module, Entry and Mixed levels from `${CLAUDE_PLUGIN_ROOT}/GLOSSARY.md`, plus one word:

- **Level**: a ring of the dependency rule. Inner levels hold policy; outer levels touch input and output.

## The shape

- A folder is a deep module: its one entry, the one source file at its root, is its interface; everything else sits in folders under it, private. Deep modules nest.
- Code sits flat until a deep module forms and takes its folder.
- An entry's level tag: `// @level domain`. A file outside every deep module carries its own.
- A tag is its file's first comment; an Astro file's tag opens its frontmatter; a Python file's is `# @level domain`, after any shebang and encoding line.
- Seen from outside, a deep module has its entry's level: the outermost level the entry wires.
- A private file names its own level.
- A file takes its job's level. One whose code holds two levels names both, `// @level application infrastructure`: mixed levels, debt under an exception until it is split.

## docs/roadkeeper/dependency-rules.md

Copy this into the project, and keep its comments.

```markdown
# Dependency rules

## Modules
<!-- a deep module's folder per line, or none; `folder/*` declares every folder directly under it -->
- `src/order`
- `src/order/line`
- `src/db`
- `src/gateways/*`

## Levels
<!-- innermost first; changing them takes an ADR -->
1. domain — business rules and pure computation; no disk, clock, network or process
2. application — use cases, and the ports outer levels implement
3. infrastructure | presentation — adapters at the ports (a database gateway, an HTTP client), and the UI, CLI or HTTP handlers; same ring
4. main — wiring that builds the adapters and hands them to the application, and a deep module's entry that wires its levels; dropped when nothing wires

## Rules
<!-- for the reader; the check does not read this section -->
- Dependencies point inward: a file depends on its own level or an inner one. A file of mixed levels counts as its outermost.
- Two levels on the same ring never depend on each other.
- A file names one level; a deep module may hold several.
- Code and tests reach a deep module only through its entry; what is inside it, inner modules too, is private.
- Deep modules nested in one parent, and top deep modules, never depend on each other in a cycle.
- An exception never hides a cycle.

## Exceptions
<!-- a dependency allowed until a version or a date; a line naming one path, a file or a module's folder, covers only what is wrong with that path itself (a file's mixed levels or missing level, a module's root files or missing level), never its edges or a cycle -->
- `src/order/legacy.ts` → `src/db` — why it is allowed (v0.6)
- `src/order/export.ts` — its file writer is infrastructure (v0.6)
- `src/db` — two entries until the split (v0.6)

## Tests
<!-- test file patterns: * within a folder, ** across folders -->
- `**/*.test.ts`

## Ignore
<!-- generated files, such as build output -->
- `**/dist/**`

## Relations
<!-- association, aggregation or composition, where the code cannot show them -->
- composition: `src/order` → `src/order/line`
```

The structure command writes `docs/roadkeeper/structure.json` from the code. To set it up, read `structure-command.md`.

Its last step, the stamp, writes nothing on a line the check reads as the disk unread (a declared module with no folder, the digest bound, a root file off the walk); a stale or hard line never stops it.

## The check

Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/structure-check.mjs` in the project root. It reports:

- a deep module, a private file, or a file outside every deep module, with no level;
- a deep module with more than one source file at its root;
- a file of mixed levels;
- a dependency that points outward;
- an import into a deep module past its entry;
- a cycle between modules;
- a level named like a module's folder;
- debt still covered by exceptions;
- a `structure.json` older than the code.

It exits 1 when a rule is broken or `structure.json` is stale. It reads the tracker snapshot, in a worktree with none its main checkout's; with none anywhere, a `note` line says version exceptions were not judged. A `shallow?` line, advisory, names a deep module whose one file is its entry: it hides nothing.

The Road's Architecture tab opens on the check's unread, stale and level-name lines, and draws the graph under them.

## Planning a slice

The spec gets a `## Structure` section:

```markdown
## Structure
- module `src/order/line` @domain — the order's lines
- edge `src/web` → `src/order` — dependency
- seam `src/order` — production: the Postgres gateway; test: an in-memory gateway
```

- **module**: a module the slice adds, or levels it adds to one. A new module also gets its `## Modules` line, unless a `folder/*` line covers it.
- **edge**: a dependency between two modules, with its kind.
- **seam**: a module whose interface is the seam, with its adapters.

Nothing else goes in the section.

1. Write the spec issue's body to a file in your scratch directory: `gh issue view <N> --json body --jq .body > <scratch>/spec.md`.
2. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/structure-plan.mjs draw <scratch>/spec.md` in the project's tree, or with `--root <tree>` from elsewhere. It draws the plan over the current structure: existing modules in grey, new ones in colour.
3. Put the drawing in front of the human with the spec.
4. After the build, write the base from the default branch (`gh repo view --json defaultBranchRef --jq .defaultBranchRef.name` names it): `git show <default>:docs/roadkeeper/structure.json > <scratch>/base.json`. Then run `node ${CLAUDE_PLUGIN_ROOT}/scripts/structure-plan.mjs check <scratch>/spec.md <scratch>/base.json` in the PR's tree, or with `--root <tree>` from elsewhere; `--no-base` goes in place of the base when the slice adds structure.json. It reports what was built but not planned, and planned but not built.

## Known debt

- When the check first runs on existing code, each violation becomes an exception with a version: an edge's line names its two ends; a line naming one file or module's folder covers that path's own rulings.
- When that version closes, the exception is a violation again.
- To move the version, give a one-line reason in the PR.

## At a milestone

Before a milestone closes:

1. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/structure-check.mjs --stamping <the milestone's version>`. A stale or unread line blocks the close until fixed.
2. For each `coming` line (an exception about to expire), ask the human: one refactor issue per module, or one slice for all. The issues have no milestone, and the re-plan places them; each carries `architecture-reader`'s proposed fix and a `## Structure` plan with its drawing.

## Adopting

1. The tour proposes the modules it found and their levels; the human corrects them.
2. The first slice after adoption adds the `@level` tags and sets up the structure command.
3. Every violation the check then reports becomes an exception with a version.
