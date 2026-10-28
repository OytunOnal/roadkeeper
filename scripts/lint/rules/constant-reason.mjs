// @level domain
// Roadkeeper's constant-reason rule: a top-level UPPER_CASE const, exported or not, is refused unless a comment sits on its
// line or on its own line directly above it; a comment trailing a constant above is that constant's.

const UPPER = /^[A-Z][A-Z0-9_]*$/;  // a constant's name; a lower-case one names a helper

function topLevelConstants(statement) {
  const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
  if (declaration?.type !== "VariableDeclaration" || declaration.kind !== "const") return [];
  return declaration.declarations.filter((d) => d.id.type === "Identifier" && UPPER.test(d.id.name));
}

function explained(source, statement) {
  const { start, end } = statement.loc;
  const onItsLine = (c) => [start.line, end.line].includes(c.loc.start.line);
  const ownLineAbove = (c) => c.loc.end.line === start.line - 1
    && source.getTokenBefore(c)?.loc.end.line !== c.loc.start.line;  // a comment trailing code above is that code's
  return source.getAllComments().some((c) => onItsLine(c) || ownLineAbove(c));
}

export const constantReason = {
  create: (context) => ({
    Program(program) {
      for (const statement of program.body) {
        const constants = topLevelConstants(statement);
        if (!constants.length || explained(context.sourceCode, statement)) continue;
        for (const d of constants) {
          context.report({ node: d.id, message: `give '${d.id.name}' a reason: a comment on its line or the line above` });
        }
      }
    },
  }),
};
