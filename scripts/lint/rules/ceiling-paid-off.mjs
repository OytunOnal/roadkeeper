// @level domain
// Roadkeeper's ceiling-paid-off rule: a file holding a Ceiling, its lines within the file limit (the option `limit`), is
// refused until its row leaves the Ceilings. Lines are counted as ESLint's max-lines counts them: the empty line after
// a last newline is none.

const lineCount = (lines) => (lines.length > 1 && lines.at(-1) === "" ? lines.length - 1 : lines.length);

export const ceilingPaidOff = {
  meta: {
    schema: [{ type: "object", properties: { limit: { type: "integer", minimum: 0 } }, required: ["limit"],
      additionalProperties: false }],
  },
  create: (context) => ({
    Program() {
      const { limit } = context.options[0];
      const count = lineCount(context.sourceCode.lines);
      if (count > limit) return;
      context.report({ loc: { line: 1, column: 0 },
        message: `${count} lines, within the ${limit} limit: remove the file's row from the Ceilings` });
    },
  }),
};
