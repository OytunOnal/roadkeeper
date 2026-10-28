<!-- Genesis copies this to docs/roadkeeper/threats.md at plan, Product level. Each default row that fits the product's shape becomes a row of the Threats table, tested or accepted with the human; the section itself is not copied. -->

# Threats

## What we protect

- `<data, money, accounts, the sources' trust, the user's privacy>`

## Who can hurt it

- `<a stranger, a malicious user, a captured dependency or account, ourselves by mistake>`

## Not attackers

- `<actor>`: `<why>` (e.g. the project's own committers: they can change the test too)

## Threats

| # | Threat | Test, or "accepted: why" |
|---|---|---|
| 1 | `<threat>` | `<test name>` |

## Default rows by shape

- **A build pipeline:** actions pinned to a full commit SHA; `GITHUB_TOKEN` read-only by default, raised per job; no plaintext secret in a workflow.
- **A domain:** HSTS (`max-age` ≥ 1 year, `includeSubDomains`, preload decided) and a CSP that names its script sources, or the host's refusal with the exposure named.
- **Hosted, multi-user:** resources addressed by the caller (`/me/…`), never by a guessable id; every read and write scoped to the caller's id and tested with a second user · sessions destroyed on logout, cookies `Secure` and `HttpOnly`, OAuth `state`, parameterized queries only · server-side fetches of user-supplied URLs only through an allowlist · security signals watched (failed logins, per-user spend, rate-limit hits).
- **Calls a model:** text a user or a source wrote is marked as data in the prompt, never executed or rendered raw, and a verdict grants nothing the caller lacks · a per-user spend budget with a hard cap, separate from the rate limit.
