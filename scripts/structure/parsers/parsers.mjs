// @level infrastructure
// Roadkeeper — the Parsers port's adapter (../lib/dependency-graph.mjs), its one entry; everything under lib/ is private:
// dependency-cruiser for the scripts' `dependency` and `type-only` edges, the TypeScript compiler for `implements`,
// `inheritance` and the declarations (lib/typescript-parser.mjs), the Astro compiler cutting an `.astro` file's code
// for the TypeScript compiler to read (lib/astro-parser.mjs), and the Python 3 on the PATH reading a `.py` file's imports,
// `inheritance` and declarations with Python's own `ast` (lib/python-parser.mjs). An `.astro` or `.py` file never goes to dependency-cruiser or into
// the compiler's program.
//
// Loads the packages from the node_modules in the folder given, the project root or the --packages folder, never one
// above; loading them runs the project's installed code (docs/adr/0003). Stops, naming the install, when one is missing;
// dependency-cruiser and TypeScript are loaded, and missed, only when a JavaScript, TypeScript or `.astro` file is
// read, the Astro compiler only when an `.astro` file is, and Python is looked for only when a `.py` file is; the tool
// line names each reader that ran. The cruise reads only the files given and
// follows no import on; all read from `root`, whatever the working folder. A file given over 1 MB, the bound on a source
// file, stops the read before any reader opens one; each reader bounds its own walks. Past the gate the packages' own
// work is theirs, unbounded here: dependency-cruiser's read and walk, and the compilers' parse.

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { SOURCE_MAX_BYTES, sizeStop } from "../lib/source-bounds.mjs";
import { isAstro, isPython, printable } from "../lib/structure-model.mjs";
import { astroParser } from "./lib/astro-parser.mjs";
import { readPythonFiles } from "./lib/python-parser.mjs";
import { posix, typescriptParser } from "./lib/typescript-parser.mjs";

// the Astro compiler's package, borrowed as the other two are
const ASTRO_COMPILER = "@astrojs/compiler";

// an import that names the repository's own files by its form: relative, rooted, or package.json's `#imports`
const LOCAL_FORM = /^(?:\.{1,2}(?:\/|$)|\/|#)/;

// a package's folder in the folder's own node_modules, null for none: the lookup never climbs above it, so no install
// outside the project (or the --packages folder) is loaded
function packageDir(from, name) {
  const dir = join(from, "node_modules", name);
  return existsSync(join(dir, "package.json")) ? dir : null;
}

// a package's manifest
const manifest = (dir) => JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));

// the file an import of a package's subpath loads ("." its main), as its exports say, else its main
function entryOf(dir, sub = ".") {
  const pkg = manifest(dir), ex = pkg.exports;
  let target = typeof ex === "string" && sub === "." ? ex : ex && ex[sub];
  while (target && typeof target === "object") target = target.import || target.default;
  return pathToFileURL(join(dir, target || pkg.main || "index.js")).href;
}

// The parsers that load from the folder `dir`: { parsers }, the packages loaded by the read that needs them.
export function parsersFrom(dir, given) {
  return { parsers: { read: (root, files, declared) => readCode({ dir, given }, root, { files, declared }) } };
}

// The script packages loaded from the folder `dir`: { packages }, or { stop } naming the install when either is
// missing: the project installs both, pinned; a --packages folder, `given` as typed, pins them already, so `npm ci`
// there.
async function loadScriptPackages({ dir, given }) {
  const cruiser = packageDir(dir, "dependency-cruiser"), tsDir = packageDir(dir, "typescript");
  const missing = [cruiser ? null : "dependency-cruiser", tsDir ? null : "typescript"].filter(Boolean).join(" and ");
  if (missing && given) return { stop: `${missing} not installed in the --packages folder ${printable(given)}: run \`npm ci\` there` };
  if (missing) return { stop: `${missing} not installed in the project: install both, pinned, with \`npm install --save-dev --save-exact dependency-cruiser typescript\`` };
  const { cruise } = await import(entryOf(cruiser));
  const { default: extractTSConfig } = await import(entryOf(cruiser, "./config-utl/extract-ts-config"));
  const ts = (await import(entryOf(tsDir))).default;
  const tool = `dependency-cruiser ${manifest(cruiser).version} + tsc ${ts.version}`;
  return { packages: { cruise, extractTSConfig, ts, tool, astro: () => astroCompiler(dir, given) } };
}

// The Astro compiler loaded from the folder `dir`: { compiler, tool }, `tool` its name and version; or { stop } naming
// the install when it is missing.
async function astroCompiler(dir, given) {
  const found = packageDir(dir, ASTRO_COMPILER);
  if (!found && given) return { stop: `${ASTRO_COMPILER} not installed in the --packages folder ${printable(given)}, and the project holds .astro files: run \`npm ci\` there` };
  if (!found) return { stop: `${ASTRO_COMPILER} not found in the project's node_modules, which holds .astro files: it comes with astro; install the project's packages` };
  return { compiler: await import(entryOf(found)), tool: `${ASTRO_COMPILER} ${manifest(found).version}` };
}

// nothing read, as the port gives it
const NONE_READ = { tool: null, read: [], heritage: [], declarations: Object.create(null), foundNowhere: [] };

// the files split by `test`: [those it holds for, the rest], each in their order
const splitBy = (files, test) => [files.filter(test), files.filter((f) => !test(f))];

// what the port's `read` gives (dependency-graph.mjs), or the size gate's stop, or a reader's: the script packages
// loaded from `packageFolder`, { dir, given }, only for a script or an `.astro` file, Python run only for a `.py` file
async function readCode(packageFolder, root, { files, declared }) {
  const oversizedFile = [...files, ...declared].find((f) => statSync(join(root, f)).size > SOURCE_MAX_BYTES);
  if (oversizedFile !== undefined) return sizeStop(oversizedFile);
  const [pythonFiles, others] = splitBy(files, isPython), [pythonDeclared, othersDeclared] = splitBy(declared, isPython);
  const scripts = others.length ? await readScripts(packageFolder, root, { files: others, declared: othersDeclared }) : NONE_READ;
  if (scripts.stop) return scripts;
  const python = pythonFiles.length ? readPythonFiles(root, pythonFiles, pythonDeclared) : NONE_READ;
  if (python.stop) return python;
  const tool = [scripts.tool, python.tool].filter(Boolean).join(" + ");
  const declarations = Object.assign(Object.create(null), scripts.declarations, python.declarations);
  const heritage = [...scripts.heritage, ...python.heritage];
  return { tool, read: [...scripts.read, ...python.read], heritage, declarations, foundNowhere: python.foundNowhere };
}

// what the script packages read of the JavaScript, TypeScript and Astro files given, or a stop
async function readScripts(packageFolder, root, { files, declared }) {
  const loaded = await loadScriptPackages(packageFolder);
  if (loaded.stop) return loaded;
  const packages = loaded.packages;
  const tsconfig = existsSync(join(root, "tsconfig.json")) ? "tsconfig.json" : null;
  const [astroFiles, scripts] = splitBy(files, isAstro);
  const compiled = typescriptParser(packages.ts, root, { files: scripts, declared: splitBy(declared, isAstro)[1], tsconfig });
  if (compiled.stop) return compiled;
  const local = inRepository(compiled.options);
  const astro = await astroRead(packages, root, { files: astroFiles, declared, options: compiled.options, local });
  if (astro.stop) return astro;
  const read = await cruiseFiles(packages, root, { files: scripts, tsconfig, local });
  const tool = astro.tool ? `${packages.tool} + ${astro.tool}` : packages.tool;
  return { tool, read: [...read, ...astro.read], heritage: compiled.heritage, declarations: Object.assign(Object.create(null), compiled.declarations, astro.declarations) };
}

// the read of `toRead`, the `.astro` files and what lib/astro-parser.mjs reads them with, and the compiler's `tool`, the
// Astro compiler loaded only when there is one; or its stop
async function astroRead(packages, root, toRead) {
  if (!toRead.files.length) return { read: [], declarations: Object.create(null), tool: null };
  const loaded = await packages.astro();
  if (loaded.stop) return loaded;
  return { ...(await astroParser({ compiler: loaded.compiler, ts: packages.ts }, root, toRead)), tool: loaded.tool };
}

// whether an import names the repository's own files: by its form, through one of the tsconfig's paths, or under its
// baseUrl, where the import's first segment names a file or folder
function inRepository({ paths, baseUrl }) {
  const keys = Object.keys(paths || {});
  const viaPaths = (spec) => keys.some((k) => (k.endsWith("*") ? spec.startsWith(k.slice(0, -1)) : spec === k));
  const underBase = (spec) => Boolean(baseUrl) && existsSync(join(baseUrl, spec.split("/")[0]));
  return (spec) => LOCAL_FORM.test(spec) || viaPaths(spec) || underBase(spec);
}

// a dependency-cruiser import as the port gives it: { name, to, typeOnly }, and `local` when it does not resolve
function importOf(d, local) {
  const types = d.dependencyTypes || [], typeOnly = types.includes("type-only") || types.includes("type-import");
  if (d.couldNotResolve || !d.resolved) return { name: d.module, to: null, typeOnly, local: local(d.module) };
  return { name: d.module, to: posix(d.resolved), typeOnly };
}

// each file given that dependency-cruiser read as a root, with its imports but a core module's; it follows no import,
// so a given file another imports is still read as its own, not listed as a bare dependency. Its paths are `root`'s:
// the files given, the ones it gives back, and the tsconfig's.
async function cruiseFiles({ cruise, extractTSConfig }, root, { files, tsconfig, local }) {
  const config = tsconfig ? join(root, tsconfig) : null;
  const options = { baseDir: root, doNotFollow: { path: "." }, tsPreCompilationDeps: true, outputType: "json", ...(config ? { tsConfig: { fileName: config } } : {}) };
  const result = await cruise(files, options, {}, config ? { tsConfig: extractTSConfig(config) } : {});
  const output = typeof result.output === "string" ? JSON.parse(result.output) : result.output;
  const given = new Set(files);
  return output.modules.filter((m) => given.has(posix(m.source)) && !m.matchesDoNotFollow)
    .map((m) => ({ file: posix(m.source), imports: m.dependencies.filter((d) => !d.coreModule).map((d) => importOf(d, local)) }));
}
