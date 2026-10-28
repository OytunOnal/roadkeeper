<!-- Genesis writes this to the project root as CODING_STANDARDS.md at plan step 5: each placeholder filled, and a line under Departures for each default of ROADKEEPER_STANDARDS.md the human changes. Adopt fills it from what the codebase already does. -->

# Coding standards

Roadkeeper's general rules, `ROADKEEPER_STANDARDS.md` at the Roadkeeper plugin's root, hold in every section below; a line under `## Departures` wins over the rule it names.

## Commands

- Lint: `<command>`; it loads Roadkeeper's rules from `roadkeeper-lint/`. Existing breaches: Ceilings in `docs/roadkeeper/ceilings.json`, Suppressions in `eslint-suppressions.json`.
- Format: `<command>`
- Typecheck: `<command>`
- Tests: `<command>`
- Structure: `<command>` (JavaScript, TypeScript, Astro or Python: Roadkeeper's, set up as Roadkeeper's `structure-command.md` says), writing `docs/roadkeeper/structure.json`; the module boundaries are in `docs/roadkeeper/dependency-rules.md`.
- Roadkeeper's tools (the green, red-before, same-cases, the check at write) run the steps of `docs/roadkeeper/commands.json`; their commands are in Roadkeeper's `briefing.md`.

## Rules

- Naming that differs from the language's default: `<conventions>`

## Departures

Each line names a general rule and its section in `ROADKEEPER_STANDARDS.md`, the project's version, and why. A lint departure also adds its override after Roadkeeper's preset in `eslint.config.mjs`.

- `<general rule> (<section>): <the project's version>, because <why>`

## Security

- `<a rule for each further boundary in threats.md>`
