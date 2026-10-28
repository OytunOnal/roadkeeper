// @level infrastructure
// Roadkeeper — the TypeScript compiler's part of the Parsers port (../parsers.mjs): the compiler's options, the `implements` and
// `inheritance` edges, and each file's top-level declarations. It reads the files given, under the root tsconfig.json's
// options or with allowJs where there is none, and adds no file an import names: noResolve, and no package's types.
// A tsconfig the compiler cannot read or parse is a stop, in the compiler's words. Its two walks, the heritage walk
// over `files` and the destructuring walk over `declared`, each stop past 256 levels, the bound on a source file, naming
// the file; the port's size gate stops a file before it is read. The compiler's own parse is not this reader's: a script
// nesting past what the compiler parses stops the command in the compiler's words, naming no file.

import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { SOURCE_MAX_NESTING, nestingStop } from "../../lib/source-bounds.mjs";
import { readerMessage } from "../../lib/structure-model.mjs";

// a compiler's message is cut here: a stop stays one readable line
const WORDS = 600;

export const posix = (p) => p.split("\\").join("/");

// What the compiler `ts` reads of the files given, under the root's `tsconfig` (null for none): { options, heritage,
// declarations }, the compiler's options, the `implements` and `inheritance` edges between `files`, and each of
// `declared`'s top-level declarations by file; or { stop }.
export function typescriptParser(ts, root, { files, declared, tsconfig }) {
  const compiler = compilerOptions(ts, root, tsconfig);
  if (compiler.stop) return compiler;
  const heritageWalk = heritageEdges(ts, root, { files, options: compiler.options });
  if (heritageWalk.stop) return heritageWalk;
  const declarations = Object.create(null);
  for (const file of declared) {
    declarations[file] = declarationsOf(ts, root, file);
    if (!declarations[file]) return nestingStop(file);
  }
  return { options: compiler.options, heritage: heritageWalk.edges, declarations };
}

// The compiler's options, { options }: the root tsconfig's, or JavaScript read with allowJs where there is none; or
// { stop } when the compiler cannot read or parse it.
function compilerOptions(ts, root, tsconfig) {
  const words = (list) => readerMessage(list.map((d) => ts.flattenDiagnosticMessageText(d.messageText, " ")).join("; ")).slice(0, WORDS);
  if (!tsconfig) return { options: { allowJs: true } };
  const read = ts.readConfigFile(join(root, tsconfig), ts.sys.readFile);
  if (read.error) return { stop: `the compiler cannot read ${tsconfig}: ${words([read.error])}` };
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, root);
  const errors = parsed.errors.filter((e) => e.code !== 18003);  // no inputs: the command gives its own files
  if (errors.length) return { stop: `the compiler cannot parse ${tsconfig}: ${words(errors)}` };
  return { options: parsed.options };
}

// `implements` and `inheritance` edges between the files given, from the compiler over those files only: { edges }, or
// the stop for the first file whose tree nests past SOURCE_MAX_NESTING
function heritageEdges(ts, root, { files, options }) {
  const program = ts.createProgram({ rootNames: files.map((f) => join(root, f)), options: { ...options, noEmit: true, noResolve: true, types: [] } });
  const checker = program.getTypeChecker(), read = new Set(files), edges = [];
  const target = (t) => {
    let sym = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(t.expression) ? t.expression.name : t.expression);
    if (sym && sym.flags & ts.SymbolFlags.Alias) sym = checker.getAliasedSymbol(sym);
    const decl = sym?.declarations?.[0];
    return decl ? posix(relative(root, decl.getSourceFile().fileName)) : null;
  };
  const heritageClauses = (node) => (ts.isClassLike(node) || ts.isInterfaceDeclaration(node) ? node.heritageClauses || [] : []);
  // another file among those read
  const readElsewhere = (to, from) => to !== null && to !== from && read.has(to);
  // true, ending the walk, past the bound
  const visit = (from, node, depth) => {
    if (depth > SOURCE_MAX_NESTING) return true;
    for (const clause of heritageClauses(node)) {
      const kind = clause.token === ts.SyntaxKind.ImplementsKeyword ? "implements" : "inheritance";
      for (const to of clause.types.map(target)) if (readElsewhere(to, from)) edges.push({ from, to, kind });
    }
    return ts.forEachChild(node, (child) => visit(from, child, depth + 1));
  };
  for (const sf of program.getSourceFiles()) {
    const from = posix(relative(root, sf.fileName));
    if (read.has(from) && visit(from, sf, 0)) return nestingStop(from);
  }
  return { edges };
}

// how the compiler parses a file, by its extension
function scriptKind(ts, file) {
  const ext = file.slice(file.lastIndexOf("."));
  if (ext === ".tsx") return ts.ScriptKind.TSX;
  if (ext === ".jsx") return ts.ScriptKind.JSX;
  return ext.endsWith("js") ? ts.ScriptKind.JS : ts.ScriptKind.TS;
}

// what a file declares at its top level (declarationsIn), null past the bound
function declarationsOf(ts, root, file) {
  return declarationsIn(ts, ts.createSourceFile(file, readFileSync(join(root, file), "utf8"), ts.ScriptTarget.Latest, false, scriptKind(ts, file)));
}

// What the parsed source `sf` declares at its top level, in order: each name, its kind (fn, class, const, type, other)
// and whether it is exported, there or by a later `export { name }`; null when a destructuring nests past
// SOURCE_MAX_NESTING.
export function declarationsIn(ts, sf) {
  const decls = new Map(), later = new Set();
  const add = (name, kind, exported) => {
    const d = decls.get(name);
    if (d) d.exported = d.exported || exported;
    else decls.set(name, { name, kind, exported });
  };
  for (const s of sf.statements) if (statementDeclarations(ts, s, { add, later })) return null;
  for (const n of later) if (decls.has(n)) decls.get(n).exported = true;
  return [...decls.values()];
}

// one top-level statement's declarations, handed to `add`; the names a bare `export { … }` or `export default name`
// exports go to `later`. True, ending the walk, when a destructuring nests past the bound.
function statementDeclarations(ts, s, { add, later }) {
  const exported = (ts.canHaveModifiers(s) ? ts.getModifiers(s) || [] : []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  if (ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s)) add(s.name ? s.name.text : "default", ts.isClassDeclaration(s) ? "class" : "fn", exported);
  else if (isTypeDeclaration(ts, s)) add(s.name.text, "type", exported);
  else if (ts.isModuleDeclaration(s) && ts.isIdentifier(s.name)) add(s.name.text, "other", exported);
  else if (ts.isVariableStatement(s)) {
    for (const d of s.declarationList.declarations) {
      const names = bindingNames(ts, d.name);
      if (!names) return true;
      for (const n of names) add(n, variableKind(ts, s, d), exported);
    }
  } else if (isLocalNamedExport(ts, s)) {
    for (const el of s.exportClause.elements) later.add((el.propertyName || el.name).text);
  } else if (ts.isExportAssignment(s)) {
    if (ts.isIdentifier(s.expression)) later.add(s.expression.text);
    else add("default", "other", true);
  }
  return false;
}

// an interface, a type alias or an enum
const isTypeDeclaration = (ts, s) => ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s) || ts.isEnumDeclaration(s);
// `export { a, b as c }` naming the file's own declarations, from no other module
const isLocalNamedExport = (ts, s) => ts.isExportDeclaration(s) && !s.moduleSpecifier && Boolean(s.exportClause) && ts.isNamedExports(s.exportClause);

// a variable's kind: fn when it holds a function, const when declared so, else other
function variableKind(ts, statement, d) {
  const holdsFunction = d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer));
  if (holdsFunction) return "fn";
  return (statement.declarationList.flags & ts.NodeFlags.Const) !== 0 ? "const" : "other";
}

// the names a declaration binds, a destructuring's each; null when it nests past SOURCE_MAX_NESTING
function bindingNames(ts, name) {
  const out = [];
  // true, ending the walk, past the bound; a level is a step down the syntax tree, a binding element one
  const walk = (node, depth) => {
    if (depth > SOURCE_MAX_NESTING) return true;
    if (ts.isBindingElement(node)) return walk(node.name, depth + 1);
    if (!ts.isIdentifier(node)) return node.elements.some((el) => !ts.isOmittedExpression(el) && walk(el, depth + 1));
    out.push(node.text);
    return false;
  };
  return walk(name, 0) ? null : out;
}
