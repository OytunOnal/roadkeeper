// @level domain
// Roadkeeper — the kinds of a failed tracker read: the tracker names one (scripts/_tracker.mjs, classifyFailure), The
// Road's page says each in plain words (scripts/road/lib/road-html.mjs).

// each kind by its name, one string the tracker writes and the page reads
export const FAILURE_KIND = Object.freeze({
  noAnswer: "no-answer",        // a server's error answer, a failed connection, a timeout
  notSignedIn: "not-signed-in", // gh holds no login, or its login was refused
  ghMissing: "gh-missing",      // no gh to run
  rateLimited: "rate-limited",  // GitHub limiting reads, which passes on its own
  other: "other",               // any other failure
});
