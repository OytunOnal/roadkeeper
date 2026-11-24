// @level infrastructure
// Roadkeeper — the JS/TS adapter: one run takes every test file; its cases are read from the JUnit file the run wrote at
// `{out}` (Vitest's junit reporter, Node's runner's), through junit-results.mjs. A case's file is its testcase's
// `file` (Node's runner), made relative to the tree; else its classname or its outermost testsuite's name, when that is
// a file the run was given (Vitest); else none. Its id is the names of the testsuites around it, but the one naming its
// file, and its own, joined by " > ". A file Node's runner could not load, its case saying only "test failed", takes its
// cause from the run's output (load-cause.mjs). The install is node_modules. The check at write reads ESLint's JSON report
// (`--format json`) from its lint run's output, ESLint's own sentences beside it, and the run's exit: a failed run whose
// report holds no error is a cause.

import { eslintNumbers } from "../../../_eslint-numbers.mjs";
import { caseFromTestcase, readResultsCases } from "./junit-results.mjs";
import { CAUSES, buildLintRead, isUnusedName, markSyntaxError, readEslintCause } from "./lint-message.mjs";
import { withLoadCause } from "./load-cause.mjs";

// A JUnit testcase as a case of the run that was given `files`.
function readCase(raw, files) {
  const file = raw.file || [raw.classname, raw.suites[0]].find((n) => files.has(n)) || "";
  const suites = raw.suites.filter((s, k) => !(k === 0 && s === file));
  const id = [...suites, raw.name].join(" > ");
  return caseFromTestcase(raw, file, id);
}

// The cases of a run given `files` in the tree at `root`, read from its JUnit file at `results`: none when it wrote none.
// A file Node's runner could not load takes its cause from the run's `output` (load-cause.mjs).
function readRunCases({ root, files, output, results }) {
  const given = new Set(files);
  return readResultsCases({ root, results }).map((raw) => withLoadCause(readCase(raw, given), { output, files }));
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

// An error of ESLint's report as a breach: { line, rule, numbers }; a parse error, with no rule id, read as the rule
// `parse`, marked a syntax error.
function readReportError(error) {
  const breach = { line: error.line, rule: error.ruleId ?? "parse", numbers: eslintNumbers(error.message) };
  return error.ruleId == null ? markSyntaxError(breach) : breach;
}

// A lint run read from ESLint's JSON (`--format json`): { breaches }, its errors, warnings and unused names aside, each
// { line, rule, numbers }, a parse error's rule `parse`, marked `syntaxError`; with { cause } beside them when ESLint's own sentence names one
// (lint-message.mjs), alone when there is no breach. Else { cause }: `failed` when the run did not pass and its report
// holds no error (a warning ESLint was told to fail on) or there is no report, `unread` when it passed with none.
function lintBreaches({ output, passed }) {
  const cause = readEslintCause(output);
  const report = eslintReport(output);
  if (!report) return { cause: cause ?? (passed ? CAUSES.unread : CAUSES.failed) };
  const errors = report.flatMap((r) => (Array.isArray(r?.messages) ? r.messages : [])).filter((m) => m?.severity === 2);
  const breaches = errors.filter((m) => !isUnusedName(m.ruleId)).map(readReportError);
  return buildLintRead({ breaches, cause, found: errors.length, passed });
}

export const jsTs = {
  install: "node_modules",
  tests: ["**/*.test.ts"], // Vitest's and Node's runner's usual name for a TypeScript test file
  filesPerRun: Infinity,
  cases: readRunCases,
  breaches: lintBreaches,
};
