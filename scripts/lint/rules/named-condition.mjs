// @level domain
// Roadkeeper's named-condition rule: an `&&`/`||` test of more than two clauses, nested ones counted flat, in an if, a loop
// or a conditional expression is refused; a name says what it asks.

function clauses(node) {
  const joined = node.type === "LogicalExpression" && ["&&", "||"].includes(node.operator);
  return joined ? clauses(node.left) + clauses(node.right) : 1;
}

function reportLongUnnamedTest(context, node) {
  const test = node.test;
  if (test?.type !== "LogicalExpression" || clauses(test) <= 2) return;
  context.report({ node: test, message: `a test of ${clauses(test)} clauses: name it as a const` });
}

export const namedCondition = {
  create: (context) => {
    const check = (node) => reportLongUnnamedTest(context, node);
    return { IfStatement: check, WhileStatement: check, DoWhileStatement: check, ForStatement: check,
      ConditionalExpression: check };
  },
};
