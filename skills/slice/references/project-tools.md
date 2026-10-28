# Roadkeeper's tools

Read this when setting up Roadkeeper's tools in a project: genesis's walking skeleton, adopt's tour, or the slice a session start asks for. The tools are the green, the merge guard, red-before, same-cases and the check at write; each script's header in `${CLAUDE_PLUGIN_ROOT}/scripts/` says its command. All read the project's `docs/roadkeeper/commands.json`; until it exists, the hooks let everything pass.

Take the steps in order.

1. **Commands file.** Write `docs/roadkeeper/commands.json` from the commands the project already runs, its CI's first:

   ```json
   { "stack": "js-ts",
     "green": [["npm", "run", "build"], ["npm", "test"], ["npm", "run", "lint"]],
     "tests": "tests/**/*.test.ts",
     "runTests": ["npx", "vitest", "run", "--reporter=junit", "--outputFile={out}", "{files}"],
     "beforeTests": [["npm", "run", "build"]],
     "lintFile": ["npx", "eslint", "--format", "json", "{file}"],
     "readByNothing": ["docs/**", "**/*.md"] }
   ```

   - `stack`: `js-ts` or `python` (Stacks).
   - `green`: the steps, run in order from the root; the first red one stops it.
   - `tests`: the test files' pattern; the stack's own when left out.
   - `runTests`: one run of named test files writing a per-case report: `{files}` becomes the files, `{out}` the report's path.
   - `beforeTests` (optional): what the tests need built first on an older tree.
   - `lintFile` (optional): the linter on one file, `{file}` its path: the check at write.
   - `readByNothing` (optional): files no step reads, as the CI's ignored paths; `docs/roadkeeper/**` when left out.
   - `install` (optional): the folder holding the installed packages, its path from the root; the stack's when left out. Never `.venv`: its editable install points at the main checkout's source, so a copy's tests would import the main checkout's code.
   - `filesPerRun` (optional): how many test files one run of `runTests` takes; the stack's when left out.

   Each command is an argument list, its program a bare name on the PATH, run with no shell: a step that needs `&&` or a pipe becomes a package script.

2. **Lint rules.** With no ESLint yet, install it (and `typescript-eslint` for TypeScript); the suppressions below need 9.24 or later. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/copy-lint-rules.mjs` at the root: it writes the plugin's rules into `roadkeeper-lint/`, committed. Load them in `eslint.config.mjs`:

   ```js
   import { readFileSync } from "node:fs";
   import { preset } from "./roadkeeper-lint/lint.mjs";

   const ceilings = JSON.parse(readFileSync("docs/roadkeeper/ceilings.json", "utf8"));
   export default [{ ignores: ["roadkeeper-lint/", ".run/"] }, ...preset({ ceilings })];
   ```

   The preset takes the place of the config's own shape limits. A TypeScript project keeps its parser's config and hands the preset its files: `preset({ ceilings, files: ["src/**/*.ts"] })`; after the preset, it turns ESLint's `no-unused-vars` off and typescript-eslint's `@typescript-eslint/no-unused-vars` on, since the core rule misreads types. The linter joins `green`, and `lintFile` names it. The green turns red while the copy differs from the plugin's, naming this command.

3. **Ceilings.** Write `docs/roadkeeper/ceilings.json` as `{}` and run the linter over the project (`npx eslint --format json .`). Each file `max-lines` refuses gets a row with the count ESLint names, its path from the config's folder: `{ "src/route.ts": { "lines": 2342 } }`. The file cannot grow past it; once within 400 lines, `roadkeeper/ceiling-paid-off` refuses it until its row goes.

4. **Suppressions.** With the Ceilings in, `npx eslint --suppress-all .` records every other breach in `eslint-suppressions.json`, committed. A file's count of a rule cannot grow; `npx eslint --prune-suppressions .` drops the ones paid off.

5. **Structure.** Where `docs/roadkeeper/dependency-rules.md` exists, run `node ${CLAUDE_PLUGIN_ROOT}/scripts/structure-check.mjs`. Each hard, stale or unread line turns the green red: fix it, or write a hard line as an exception with its version (`structure.md`, Known debt). After adopt's tour, the structure command waits for the first slice (`structure.md`, Adopting), and the green is red until then. On a Python project the structure command counts the code's imports, tests aside, that it found neither in a search place (the importing file's folder, the root, `src/`) nor in the standard library: the map may be missing those imports' arrows.

6. **Ignored files.** `.gitignore` names `.run/`, where the green's stamp and agents' scratch live, and `docs/roadkeeper/issues.json`, the tracker's snapshot the hooks and the `road` command rewrite.

7. **Standards.** `CODING_STANDARDS.md`'s Commands carry the line for Roadkeeper's tools as genesis's template has it (`${CLAUDE_PLUGIN_ROOT}/skills/genesis/references/coding-standards.md`): their commands live only in Roadkeeper's `briefing.md`.

8. **Green.** Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/green.mjs` at the root. Done when it ends on `green: stamped <tree>`.

## Stacks

- **`js-ts`**: cases read from a JUnit report; the install is `node_modules`; the default tests `**/*.test.ts`.
  - Vitest: `["npx", "vitest", "run", "--reporter=junit", "--outputFile={out}", "{files}"]`.
  - Node's runner: `["node", "--import", "tsx", "--test", "--test-reporter=junit", "--test-reporter-destination={out}", "{files}"]`.
  - ESLint for `lintFile`: `["npx", "eslint", "--format", "json", "{file}"]`.
- **`python`**: cases read from a JUnit report; lint read from the line `path:line:col: CODE message`; no install; the default tests `**/test_*.py` and `**/*_test.py`, all in one run. Run each tool through `uv run`, which builds every worktree's and copy's own environment from uv's cache; the install is never `.venv` (step 1).
  - pytest: `["uv", "run", "pytest", "--continue-on-collection-errors", "--junitxml={out}", "{files}"]`: a test file pytest cannot import fails as one case, and the other files' cases are still read.
  - ruff for `lintFile`: `["uv", "run", "ruff", "check", "--output-format=concise", "{file}"]`; flake8's default line reads the same, and pylint's as `["uv", "run", "pylint", "--msg-template={path}:{line}:{column}: {msg_id} {msg}", "{file}"]`.
  - Roadkeeper's lint rules reach a Python project at review; its own linter, at write.

A linked worktree with no install of its own gets the main checkout's linked in while its `package-lock.json` beside the install matches the main checkout's byte for byte; otherwise each tool says to install in the worktree.

## Another stack

A stack neither adapter reads gets its own in the plugin, once: `scripts/project-tools/adapters/stacks/<stack>.mjs`, registered in `adapters.mjs`, whose header says what an adapter gives. Add its recipe under Stacks.
