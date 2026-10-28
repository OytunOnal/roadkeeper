# The structure command

Read this when setting up a project's structure command, in slice 1 or after adoption. `CODING_STANDARDS.md` names it.

First, add `docs/roadkeeper/structure.json text eol=lf` to the project's `.gitattributes`: the command writes LF, and a checkout with `core.autocrlf=true` writes CRLF, so every run would read as a change with no diff.

A JavaScript, TypeScript, Astro or Python project runs Roadkeeper's, in its root: `node ${CLAUDE_PLUGIN_ROOT}/scripts/structure.mjs [--packages <folder>]`. The command reads every JavaScript, TypeScript, Astro and Python file from the root, but what `## Ignore` names, `.`-names and node_modules. It reads them with the project's own dependency-cruiser and TypeScript when it holds a JavaScript, TypeScript or `.astro` file, `@astrojs/compiler` when it holds an `.astro` file; with `--packages`, with the packages in that folder; and a `.py` file with the Python 3 on the PATH. It writes `docs/roadkeeper/structure.json`, stamped, its `tool` naming each reader that ran. `## Tests` sorts out the tests.

## structure.json

```json
{ "tool": "dependency-cruiser 16 + tsc 5", "digest": "<written by the stamp>",
  "modules": [{ "path": "src/order", "files": ["src/order/index.ts", "src/order/lib/total.ts"],
               "entries": [{ "file": "src/order/index.ts", "level": "domain" }] }],
  "loose": ["src/web/routes.ts"],
  "levels": { "src/order/index.ts": "domain", "src/web/routes.ts": "presentation" },
  "edges": [{ "from": "src/web/routes.ts", "to": "src/order/index.ts", "kind": "dependency" }],
  "declarations": { "src/order/index.ts": [{ "name": "placeOrder", "kind": "fn", "exported": true }] } }
```

- **modules**: each deep module's folder and, under `entries`, every source file at its root with its level, the tagged first: the first is its entry, the check names any other.
- **edges**: one per dependency. Kinds: `dependency`, `type-only`, `implements`, `inheritance`.
- **levels** (optional): every file that carries `@level`, a file of mixed levels with its levels split by spaces.
- **declarations** (optional): what each file declares: `fn`, `class`, `const`, `type` or `other`.
- **files** (a module's), **loose** (the files no module holds) and **digest**: written by the stamp. The digest lets the check tell when the code has changed since.

Paths are relative to the repo root, with forward slashes.

## Another stack

The project writes one script: it reads the code with the stack's import graph tool and parser, writes the same JSON, and runs `node ${CLAUDE_PLUGIN_ROOT}/scripts/structure-stamp.mjs` as its last step. Add the recipe here the first time.
