// @level infrastructure
// Roadkeeper — the JS/TS adapter: one run takes every test file; its cases are read from the JUnit file the run wrote at
// `{out}` (Vitest's junit reporter, Node's runner's), through junit-results.mjs. A case's file is its testcase's
// `file` (Node's runner), made relative to the tree; else its classname or its outermost testsuite's name, when that is
// a file the run was given (Vitest); else none. Its id is the names of the testsuites around it, but the one naming its
// file, and its own, joined by " > ". The install is node_modules. The check at write reads ESLint's JSON report
// (`--format json`) from its lint run's output.

import { eslintNumbers } from "../../../_eslint-numbers.mjs";
import { readResultsCases } from "./junit-results.mjs";
import { isUnusedName } from "./lint-message.mjs";

// A JUnit testcase as a case of the run that was given `files`.
function readCase(raw, files) {
  const file = raw.file || [raw.classname, raw.suites[0]].find((n) => files.has(n)) || "";
  const suites = raw.suites.filter((s, k) => !(k === 0 && s === file));
  const id = [...suites, raw.name].join(" > ");
  return { file, id, name: id, outcome: raw.outcome, detail: raw.detail };
}

// The cases of a run given `files` in the tree at `root`, read from its JUnit file at `results`: none when it wrote none.
function readRunCases({ root, files, results }) {
  const given = new Set(files);
  return readResultsCases({ root, results }).map((raw) => readCase(raw, given));
}

// ESLint's JSON report in a lint run's output: the output whole, else its one line holding it (a warning on stderr
// beside it); null when there is none.
function eslintReport(output) {
  for (const text of [output, ...output.split("\n")]) {
    const json = text.trim();
    if (!json.startsWith("[")) continue;
    try { const report = JSON.parse(json); if (Array.isArray(report)) return report; } catch { /* not the report */ }
  }
  return null;
}

// A lint run's breaches, read from ESLint's JSON (`--format json`): its errors, warnings and unused names aside, each
// { line, rule, numbers }, a parse error's rule `parse`; null when the output holds no report.
function lintBreaches({ output }) {
  const report = eslintReport(output);
  if (!report) return null;
  return report.flatMap((r) => (Array.isArray(r?.messages) ? r.messages : []))
    .filter((m) => m?.severity === 2 && !isUnusedName(m.ruleId))
    .map((m) => ({ line: m.line, rule: m.ruleId ?? "parse", numbers: eslintNumbers(m.message) }));
}

export const jsTs = {
  install: "node_modules",
  tests: ["**/*.test.ts"], // Vitest's and Node's runner's usual name for a TypeScript test file
  filesPerRun: Infinity,
  cases: readRunCases,
  breaches: lintBreaches,
};
