// @level infrastructure
// Roadkeeper's inner-levels-pure rule: a file whose level tag names inner levels alone, kernel, domain or application,
// reaches nothing outside the project: an import, re-export or run-time import whose source is not a relative path, any
// reference to `process` or `fetch`, either as a member of `globalThis`, and `Date.now()` or an argument-free
// `new Date()` are refused. A file naming an outer level
// among them counts as its outermost and is not held, as in the structure check's Python rule.

const LEVEL_TAG = /^\/\/\s*@level\s+(.+)$/;  // the structure command's tag, on a trimmed line
const RELATIVE = /^\.\.?\//;  // a file of the project; anything else is a Node module or a package
// the levels kept pure: no disk, clock, network or process; scripts/structure/lib/inner-levels-pure.mjs keeps the same
// list and test for Python, as this folder, copied into a project, imports nothing outside it
const INNER_LEVELS = ["kernel", "domain", "application"];

// whether the file's first non-blank line, a shebang aside, is a level tag naming inner levels alone: the structure
// command reads the tag there and nowhere else
function inInnerLevel(source) {
  const lines = source.lines.slice(source.lines[0].startsWith("#!") ? 1 : 0);
  const first = lines.find((l) => l.trim());
  const tag = first ? LEVEL_TAG.exec(first.trim()) : null;
  return tag !== null && tag[1].trim().split(/\s+/).every((level) => INNER_LEVELS.includes(level));
}

// an import's source as text: a string, or a template literal with no substitution; null when computed
function sourceText(from) {
  if (from.type === "Literal") return String(from.value);
  const plain = from.type === "TemplateLiteral" && from.expressions.length === 0;
  return plain ? from.quasis[0].value.cooked : null;
}

function reportOutside(context, node) {
  const from = node.source;
  if (!from) return;
  const text = sourceText(from);
  if (text !== null && RELATIVE.test(text)) return;
  const what = text !== null ? `'${text}'` : "a computed source";
  context.report({ node: from, message: `an inner-level file imports project files only: ${what} is outside` });
}

// the references to these names that no binding of the file holds: a built-in global such as `Date` is resolved to
// ESLint's own global variable, an unknown one such as `process` is left unresolved
function globalReferences(globalScope, names) {
  const builtIn = names.flatMap((n) => globalScope.set.get(n)?.references ?? []);
  return [...builtIn, ...globalScope.through.filter((r) => names.includes(r.identifier.name))];
}

// what each global an inner level may not reach reads, by its name, whatever the use
const READS = { process: "`process` reads the environment", fetch: "`fetch` reads the network" };

// the global a member of `globalThis` names, `globalThis.process` or `globalThis["process"]`; null for any other use
function globalThisMember(identifier) {
  const p = identifier.parent;
  if (p.type !== "MemberExpression" || p.object !== identifier) return null;
  if (!p.computed) return p.property.name;
  return p.property.type === "Literal" ? String(p.property.value) : null;
}

// what a global reference to `process`, `fetch`, `Date` or a member of `globalThis` reads that an inner level may not,
// the environment, the network or the clock; null for a use that reads none, as `new Date(x)`
function impureUse(identifier) {
  const p = identifier.parent;
  const named = identifier.name === "globalThis" ? globalThisMember(identifier) : identifier.name;
  if (Object.hasOwn(READS, named ?? "")) return READS[named];
  if (identifier.name === "globalThis") return null;
  const now = p.type === "MemberExpression" && p.object === identifier && !p.computed && p.property.name === "now"
    && p.parent.type === "CallExpression" && p.parent.callee === p;
  const bareNew = p.type === "NewExpression" && p.callee === identifier && p.arguments.length === 0;
  return now || bareNew ? "the clock is read where it is infrastructure: take the date as an argument" : null;
}

export const innerLevelsPure = {
  create: (context) => {
    if (!inInnerLevel(context.sourceCode)) return {};
    const outside = (node) => reportOutside(context, node);
    return {
      ImportDeclaration: outside, ExportNamedDeclaration: outside, ExportAllDeclaration: outside,
      ImportExpression: outside,
      "Program:exit"(program) {
        for (const ref of globalReferences(context.sourceCode.getScope(program), ["process", "fetch", "Date", "globalThis"])) {
          const said = impureUse(ref.identifier);
          if (said) context.report({ node: ref.identifier, message: `an inner-level file is pure: ${said}` });
        }
      },
    };
  },
};
