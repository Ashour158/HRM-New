# Contributing

## Branch and PR conventions

- Branch off `main`, one focused change per branch.
- Commit messages: `type(scope): description` (e.g. `fix(payroll): ...`,
  `feat(hr-web): ...`) — this is a squash-merge repo, so the final PR title
  is what shows up in `git log`; keep it descriptive.
- Every PR should state, in its own body, what was independently verified
  (typecheck output, test counts, a reproduced bug now fixed) — not just
  what changed. See `.github/PULL_REQUEST_TEMPLATE.md`.
- Squash-merge only. Delete the branch after merge.

## Required checks

Branch protection on `main` requires 5 status checks to pass before merge:
`Lint, typecheck, test, and build`, `Security scan`, `Runtime HTTP lifecycle
E2E`, `RLS-enabled tenant isolation E2E`, `Verify database migrations`.
There is currently no required human-review count configured — see
`.github/CODEOWNERS` for why, and treat this as a gap to close the moment a
second contributor joins this repo, not something to leave open indefinitely.

## High-blast-radius paths

`.github/CODEOWNERS` calls out payroll, auth guards, migrations, RLS
config, and crypto/audit code as the paths most likely to reproduce past
defect classes (jsonb serialization bugs, RLS bypass, auth-guard 500s,
payroll money correctness). Changes here warrant extra scrutiny regardless
of who reviews them.

## Local development

See the root `README.md` and `docs/` for environment setup,
`scripts/check-no-compiled-output-in-src.mjs` for the local test-hygiene
guard, and `docs/GO-LIVE-RUNBOOK.md` for what's gating production
readiness.
