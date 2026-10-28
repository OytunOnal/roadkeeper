// @level infrastructure
// Roadkeeper — the Astro part of the Parsers port (../parsers.mjs): an `.astro` file's code is its frontmatter and each
// `<script>` Astro processes, one with no attribute but `src`, cut out in memory by the project's Astro compiler. The
// TypeScript compiler parses each piece and resolves its imports under the project's options; a relative import, or a
// tsconfig `paths` alias, it does not resolve is resolved by its path on disk. A processed script's `src` written as
// text is an import like the others, an edge only when it resolves. The declarations are the frontmatter's. It reads
// the files given and writes nothing. It refuses a `<script>` with another attribute and a `src` given by an
// expression, reading neither; a file whose markup or code nests past 256 levels, the bound on a source file, stops the
// read (the port's size gate stops a file before it is opened). The compilers' own parse, Astro's and TypeScript's, is
// not this reader's.

import { readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { SOURCE_MAX_NESTING, nestingStop } from "../../lib/source-bounds.mjs";
import { declarationsIn, posix } from "./typescript-parser.mjs";

// an import named by its path from the importing file, looked up beside it on disk
const RELATIVE = /^\.{1,2}\//;

// What `compiler`, the Astro compiler, and `ts` read of the `.astro` files given, under the compiler's `options`:
// { read, declarations } as the port gives them (../../lib/dependency-graph.mjs); `local` says whether an import's name
// is the repository's own.
export async function astroParser({ compiler, ts }, root, { files, declared, options, local }) {
  const read = [], declarations = Object.create(null), wanted = new Set(declared);
  for (const file of files) {
    const page = await pageCode({ compiler, ts }, root, file);
    if (page.stop) return page;
    read.push({ file, imports: page.named.map((i) => resolvedImport(ts, i, { path: join(root, file), root, options, local })) });
    if (!wanted.has(file)) continue;
    declarations[file] = declarationsIn(ts, page.frontmatter);
    if (!declarations[file]) return nestingStop(file);
  }
  return { read, declarations };
}

// One Astro file's code: { frontmatter, named }, its frontmatter parsed and the imports its code names; or { stop }
// naming the file and the bound it passes.
async function pageCode({ compiler, ts }, root, file) {
  const code = await codeOf(compiler, readFileSync(join(root, file), "utf8"));
  const tooDeep = nestingStop(file);
  if (!code) return tooDeep;
  const parse = (text) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  const frontmatter = parse(code.frontmatter);
  const found = [frontmatter, ...code.scripts.map(parse)].map((sf) => importsIn(ts, sf));
  if (found.includes(null)) return tooDeep;
  return { frontmatter, named: [...found.flat(), ...code.sources.map((name) => ({ name, typeOnly: false }))] };
}

// An Astro file's code, as its compiler cuts it: { frontmatter, scripts, sources }, the frontmatter's text ("" for
// none), each processed script's text, and each processed script's `src`; null when its tree nests past
// SOURCE_MAX_NESTING.
async function codeOf(compiler, source) {
  const { ast } = await compiler.parse(source, { position: false });
  const code = { frontmatter: "", scripts: [], sources: [] };
  const stack = [{ node: ast, depth: 0 }];
  while (stack.length) {
    const { node, depth } = stack.pop();
    if (depth > SOURCE_MAX_NESTING) return null;
    if (node.type === "frontmatter") code.frontmatter = node.value;
    else if (node.type === "element" && node.name === "script") scriptCode(node, code);
    else stack.push(...(node.children || []).map((child) => ({ node: child, depth: depth + 1 })));
  }
  return code;
}

// a `<script>`'s text and `src` added to `code` when Astro processes it: it carries no attribute but `src`
function scriptCode(node, code) {
  const attributes = node.attributes || [];
  if (!attributes.every((a) => a.name === "src")) return;
  const src = attributes.find((a) => a.kind === "quoted");
  if (src) code.sources.push(src.value);
  code.scripts.push((node.children || []).filter((c) => c.type === "text").map((c) => c.value).join(""));
}

// the imports a parsed piece names, { name, typeOnly } each: its import and export declarations from a module, and
// each `import("…")` of a string; null when the piece nests past SOURCE_MAX_NESTING
function importsIn(ts, sf) {
  const out = [];
  // true, ending the walk, past the bound
  const visit = (node, depth) => {
    if (depth > SOURCE_MAX_NESTING) return true;
    const from = ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ? node.moduleSpecifier : null;
    if (from && ts.isStringLiteral(from)) out.push({ name: from.text, typeOnly: isTypeOnly(ts, node) });
    else if (isImportOfString(ts, node)) out.push({ name: node.arguments[0].text, typeOnly: false });
    return ts.forEachChild(node, (child) => visit(child, depth + 1));
  };
  return visit(sf, 0) ? null : out;
}

// an import or export declaration that brings types only, as dependency-cruiser marks one: `import type`,
// `export type`, or braces whose every specifier is a type, with no default import beside them
function isTypeOnly(ts, node) {
  const allTypes = (named) => Boolean(named) && (ts.isNamedImports(named) || ts.isNamedExports(named)) && named.elements.every((e) => e.isTypeOnly);
  if (ts.isExportDeclaration(node)) return node.isTypeOnly || allTypes(node.exportClause);
  const clause = node.importClause;
  if (!clause) return false;
  return clause.isTypeOnly || (!clause.name && allTypes(clause.namedBindings));
}

function isImportOfString(ts, node) {
  if (!ts.isCallExpression(node) || node.expression.kind !== ts.SyntaxKind.ImportKeyword) return false;
  return Boolean(node.arguments[0]) && ts.isStringLiteralLike(node.arguments[0]);
}

// an import of the file at `path` as the port gives it: { name, to, typeOnly }, `to` root-relative, or null with `local`
function resolvedImport(ts, { name, typeOnly }, { path, root, options, local }) {
  const found = ts.resolveModuleName(name, path, options, ts.sys).resolvedModule;
  const to = found ? found.resolvedFileName : fileOnDisk(path, name, options);
  return to ? { name, to: posix(relative(root, to)), typeOnly } : { name, to: null, typeOnly, local: local(name) };
}

// the file an import names on disk: a relative name beside the importing file at `path`, another through the
// compiler's `options.paths`; null for none
function fileOnDisk(path, name, options) {
  const candidates = RELATIVE.test(name) ? [join(dirname(path), name)] : aliasTargets(name, options);
  return candidates.find(isFile) || null;
}

const isFile = (p) => { try { return statSync(p).isFile(); } catch { return false; } };

// the paths a tsconfig `paths` alias maps `name` to, under the folder they are read from, as the compiler tries them:
// an exact key first, then the key with the longest text before its `*`, each key's targets in order
function aliasTargets(name, { paths, baseUrl, pathsBasePath }) {
  const base = baseUrl || pathsBasePath;
  if (!paths || !base) return [];
  const targetsByKey = Object.assign(Object.create(null), paths);
  const fitting = Object.keys(targetsByKey).map((key) => ({ key, star: key.indexOf("*") })).filter(({ key, star }) => fits(name, key, star));
  // a key with no `*` counts longer than its own text, so it goes before a `*` key of the same prefix
  const prefixLength = ({ key, star }) => (star < 0 ? key.length + 1 : star);
  fitting.sort((a, b) => prefixLength(b) - prefixLength(a));
  return fitting.flatMap(({ key, star }) => {
    const middle = star < 0 ? "" : name.slice(star, name.length - (key.length - star - 1));
    return targetsByKey[key].map((target) => join(base, target.replace("*", middle)));
  });
}

// whether `name` fits a `paths` key whose `*` sits at `star` (-1 for none)
function fits(name, key, star) {
  if (star < 0) return name === key;
  return name.length >= key.length - 1 && name.startsWith(key.slice(0, star)) && name.endsWith(key.slice(star + 1));
}
