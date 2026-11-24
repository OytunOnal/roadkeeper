// @level domain
// Roadkeeper — when a commit may land on the default branch: its tree holds a green stamp, or, where the landing looks
// for one, it differs from a stamped tree only in files the green does not read; and the refusal, in fixed words, of
// one that may not.

// a landing's patterns where a commit lands only on its own stamp: no near stamp is looked for
export const OWN_STAMP_ONLY = null;

// The commit's state: "green", "unstamped", "unrun" when unstamped and no near stamp is looked for, or "missing" when
// the clone holds no such commit. `asks`: { tree(), stamped(tree), near(tree) }, the commit's tree (null: none), whether
// the green stamp holds a tree, and whether a tree differs from a stamped one only in files `patterns` names, each
// asked only when the state needs it; `patterns`: the commands file's readByNothing, OWN_STAMP_ONLY: a commit lands only
// on its own stamp.
export function landingState(asks, patterns) {
  const tree = asks.tree();
  if (tree === null) return "missing";
  if (asks.stamped(tree)) return "green";
  if (patterns === OWN_STAMP_ONLY) return "unrun";
  return asks.near(tree) ? "green" : "unstamped";
}

// The refusal for a commit that is not green, by its state (landingState): `short` the commit as a line shows it,
// `runGreen` the line every refusal ends on, naming the green.
export function refusalFor(state, short, runGreen) {
  if (state === "missing") return `commit ${short} is not in this clone; fetch it, then ${runGreen}`;
  if (state === "unrun") return `commit ${short} has not run green; ${runGreen}`;
  return `commit ${short} has not run green, and differs from every green tree in files the green reads; ${runGreen}`;
}
