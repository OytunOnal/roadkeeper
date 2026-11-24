// @level domain
// Roadkeeper — one run's counts from its transcript's entries in the slice window as the counts take them
// (read-entry-facts.mjs's facts): its calls, its seconds, and on a session's run the time it waited on the owner.

const MILLISECONDS = 1000; // in a second

// Milliseconds as whole seconds, rounded.
export const toSeconds = (milliseconds) => Math.round(milliseconds / MILLISECONDS);

// The counts of a run whose `entries` (read-entry-facts.mjs's facts, in the file's order) fall in the window:
// { calls, seconds }, its seconds from its first entry to its last.
export function countRun(entries) {
  const calls = entries.reduce((sum, facts) => sum + facts.calls.length, 0);
  return { calls, seconds: entries.length ? toSeconds(entries[entries.length - 1].time - entries[0].time) : 0 };
}

// A count of waits: `add` counts one of so many milliseconds; `total` gives { waited, waits }, waited in seconds.
function startWaitCount() {
  let waited = 0;
  let waits = 0;
  return { add: (milliseconds) => { waited += milliseconds; waits += 1; }, total: () => ({ waited: toSeconds(waited), waits }) };
}

// An agent's time waiting on the owner: the gaps from its last assistant entry, its hand-back, to each message of the
// session resuming it. { waited, waits }, waited in seconds.
export function countAgentWaits(entries) {
  const count = startWaitCount();
  let handedBack = null;
  for (const { isResume, isAssistant, time } of entries) {
    if (isResume && handedBack !== null) { count.add(time - handedBack); handedBack = null; }
    if (isAssistant) handedBack = time;
  }
  return count.total();
}

// the ids of the calls an entry's `facts` make that `isPicked` says yes to; a call with no id is none
export const findCallIds = (facts, isPicked) => facts.calls
  .filter((call) => typeof call.id === "string" && isPicked(call)).map((call) => call.id);

// A session's time waiting on the owner: each question box's time from its call to its answer, declined or not, and
// each gap before a message the owner typed, from the latest of the session's last assistant entry, the owner's own
// message before it and a box's answer. Claude Code's own lines, written while the session sits idle, start no wait.
// { waited, waits }, waited in seconds.
export function countWaits(entries) {
  const count = startWaitCount();
  let waitStart = null; // when a wait before the owner's next message would start
  const openedAt = new Map(); // the question boxes not yet answered, by call id: when each opened
  for (const facts of entries) {
    const time = facts.time;
    for (const answer of facts.results.filter((result) => openedAt.has(result.id))) {
      count.add(time - openedAt.get(answer.id));
      openedAt.delete(answer.id);
      waitStart = time;
    }
    if (facts.isTyped) { if (waitStart !== null) count.add(time - waitStart); waitStart = time; }
    if (!facts.isAssistant) continue;
    waitStart = time;
    for (const id of findCallIds(facts, (call) => call.isQuestionBox)) openedAt.set(id, time);
  }
  return count.total();
}
