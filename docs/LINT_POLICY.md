# Frontend lint policy

The 2026-11-02 audit found 167 errors. The cleanup keeps the Next.js/TypeScript
and React rules enabled for application code, with these reviewed exceptions:

- Only `scripts/check-*.cjs` permits `require()` imports. These are Node CommonJS
  harnesses that compile isolated TypeScript fixtures in a VM; converting them
  to application ES modules would change how the fixtures execute.
- Generated Cargo `target` folders are excluded from traversal. Contract source,
  frontend source and test harness source are not excluded by this build-output rule.
- Individual request-time `Date.now()` statements in async server components
  have a `react-hooks/purity` exception. They run after `connection()`, supply
  initial hydration snapshots, and are not cached client render calculations.
- Individual external-state invalidation/restoration statements have documented
  `react-hooks/set-state-in-effect` exceptions. These preserve wallet/account
  isolation, browser draft hydration, protected-session revalidation, and clearing
  stale ownership/financial evidence during cancellable reads. They are not a
  general exemption for derived state or permission to disable React rules.

These exceptions preserve existing synchronization behavior; they do not claim
that cascading renders were eliminated or that every resource hook was rewritten.
Future resource-state refactors should remove exceptions when they make that
synchronization unnecessary, while retaining stale-data and cancellation tests.

The campaign-list and public-payment routes now render JSX outside their data
`try/catch` blocks. A read failure remains a deliberate data fallback; rendering
failures can reach the framework error boundary.

Run `npm run lint`, all `scripts/check-*.cjs` regressions, and `npm run build` after
changes. Lint success alone does not verify wallet behavior or browser rendering.
