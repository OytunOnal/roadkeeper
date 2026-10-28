---
name: launch
description: "Prepare a production launch: pre-launch checklist, monitoring, rollback plan. Use before shipping a release to real users."
---

# Shipping and Launch

Each item is done, or declined with a one-line reason under the release's notes.

- **The first launch:** also `references/first-launch.md`.
- **An announced release:** also `references/announcement.md`.

## The Pre-Launch Checklist

### Code Quality

- [ ] All tests pass (unit, integration, e2e)
- [ ] Build succeeds with no warnings
- [ ] Lint and type checking pass
- [ ] Code reviewed and approved
- [ ] No TODO comments that should be resolved before launch
- [ ] No debug output in production code (JS: `console.log`)
- [ ] Error handling covers expected failure modes

### Security

- [ ] No secrets in code or version control
- [ ] The ecosystem's dependency audit (`npm audit`, `pip-audit`, `cargo audit`, ...) shows no critical or high vulnerabilities
- [ ] Input validation on all user-facing endpoints
- [ ] Authentication and authorization checks in place
- [ ] Security headers configured (CSP, HSTS, etc.)
- [ ] Rate limiting on authentication endpoints
- [ ] CORS configured to specific origins (not wildcard)
- [ ] Every row of `docs/roadkeeper/threats.md` tested or accepted
- [ ] What the product says it collects is what actually leaves the device, checked on the wire

### Performance

- [ ] Core Web Vitals within "Good" thresholds
- [ ] No N+1 queries in critical paths
- [ ] Images optimized (compression, responsive sizes, lazy loading)
- [ ] Bundle size within budget
- [ ] Database queries have appropriate indexes
- [ ] Caching configured for static assets and repeated queries
- [ ] Launch-day load: an expected number, and one test at a multiple of it

### Accessibility

- [ ] Keyboard navigation works for all interactive elements
- [ ] Screen reader can convey page content and structure
- [ ] Color contrast meets WCAG 2.1 AA (4.5:1 for text)
- [ ] Focus management correct for modals and dynamic content
- [ ] Error messages are descriptive and associated with form fields
- [ ] No accessibility warnings in axe-core or Lighthouse
- [ ] The product walked on a phone (390px), on the real address

### Infrastructure

- [ ] Environment variables set in production
- [ ] Database migrations applied (or ready to apply)
- [ ] DNS and SSL configured
- [ ] CDN configured for static assets
- [ ] Logging and error reporting configured (what to watch: `references/monitoring.md`)
- [ ] Health check endpoint exists and responds
- [ ] For each external dependency the product needs live, what the user sees when it is down is designed
- [ ] Every success metric has a source that produces its number from day one, or a reason it is not measured

### Documentation

- [ ] README updated with any new setup requirements
- [ ] API documentation current
- [ ] ADRs written for any architectural decisions
- [ ] Changelog updated (the milestone's release)
- [ ] User-facing documentation updated (if applicable)
- [ ] The README's first screen answers a stranger, replaced in place:
  - [ ] an image of the product first;
  - [ ] one sentence;
  - [ ] who it is for;
  - [ ] what it does now;
  - [ ] how to run it: one command, tried from a fresh clone;
  - [ ] where feedback goes;
  - [ ] the licence.

## Rollback Strategy

Every deployment needs a rollback plan before it happens:

```markdown
## Rollback Plan for [Feature/Release]

### Trigger Conditions
- Error rate > 2x baseline
- P95 latency > [X]ms
- User reports of [specific issue]

### Rollback Steps
1. Disable feature flag (if applicable)
   OR
1. Deploy previous version: `git revert <commit> && git push`
2. Verify rollback: health check, error monitoring
3. Communicate: notify team of rollback

### Database Considerations
- Migration [X] has a rollback: <verified command or runbook link>
- Data inserted by new feature: [preserved / cleaned up]

### Time to Rollback
- Feature flag: < 1 minute
- Redeploy previous version: < 5 minutes
- Database rollback: < 15 minutes
```

## Post-Launch Verification

In the first hour after launch:

1. Check health endpoint returns 200
2. Check error monitoring dashboard (no new error types)
3. Check latency dashboard (no regression)
4. Test the critical user flow manually
5. Verify logs are flowing and readable
6. Confirm rollback mechanism works (dry run if possible)

## Done

Before deploying:

- [ ] Every checklist item done or declined, those of the references this release reads included
- [ ] Feature flag configured (if applicable)
- [ ] Rollback plan documented
- [ ] Monitoring dashboards set up
- [ ] Team notified of deployment

After deploying: every Post-Launch Verification step passes.

<!-- Adapted from addyosmani/agent-skills skills/shipping-and-launch at 1401c8b (MIT, (c) 2025 Addy Osmani). -->
