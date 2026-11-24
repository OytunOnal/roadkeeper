// @level domain
// Roadkeeper — the merge guard's landing rule: nothing lands on the default branch, nor as a tag, that is not green; a
// git command given an alias on its command line, which can push under another name, is refused.

const ALIAS_REFUSAL = "a git command given an alias on its command line can push under another name; run git's own command"; // fixed words

// Whether a push's destination lands on the default branch `home` or as a tag: `destination` its full ref, git's short
// forms expanded; `sourceRef`, its source's full name, which names a tag a destination with no ref names.
export function landsOn(destination, sourceRef, home) {
  const onHome = destination === home || destination === `refs/heads/${home}`;
  const tagByName = !destination.startsWith("refs/") && sourceRef.startsWith("refs/tags/"); // git names it as its source
  return onHome || destination.startsWith("refs/tags/") || tagByName;
}

// One landing judged: its refusal, or null when it passes. `rules`, the project's landing rules (null where the
// command's repository is no Roadkeeper project, passed; their own refusal, said); `alias`, whether the git command was
// given one; `landed()`, what it lands ({ commits, … }, or { refusal } when they cannot be said); `refusalOf(landed)`,
// the refusal of the commits landed that are not green.
export function judgeLanding({ rules, alias }, landed, refusalOf) {
  if (!rules || rules.refusal) return rules?.refusal ?? null;
  if (alias) return ALIAS_REFUSAL;
  const lands = landed();
  return lands.refusal ?? refusalOf(lands);
}
