# HRM Nexus Release Process

This release process turns the local prototype workflow into a controlled enterprise delivery path. Every release must pass automated quality gates, verify database migrations, build immutable container images, and publish deployment manifests before production rollout.

## Versioning

- Use semantic versions: `vMAJOR.MINOR.PATCH`.
- Patch releases contain fixes and non-breaking hardening.
- Minor releases add modules, APIs, or workflow features.
- Major releases require an explicit migration and compatibility review.

## Required Gates

Pull requests and release tags must pass:

- Secret scan: `pnpm secret:scan`.
- Production dependency audit: `pnpm audit --prod --audit-level high`.
- Deployment envelope check: `pnpm ci:verify-deployment-envelope`.
- Lint: `pnpm lint`.
- Typecheck: `pnpm typecheck`.
- Tests: `pnpm test`.
- Frontend content check: `pnpm --filter hr-web content:check`.
- Frontend accessibility: `pnpm --filter hr-web test:a11y`.
- Browser smoke: `pnpm --filter hr-web test:e2e`.
- Build: `pnpm build`.
- Migration verification against PostgreSQL: `pnpm --filter @hcm/database migrate`.
- Docker build for API and web images.

## Runtime Smoke And Load Evidence

Every release candidate must be exercised in a production-like environment after the migration job succeeds:

1. Set `RUNTIME_API_BASE_URL` to the candidate API URL.
2. Run `pnpm runtime:smoke` and archive the command output with release evidence.
3. Run `pnpm runtime:golden-workflow` and archive the command output with release evidence.
4. Run the approved load test profile against login, employee self-service, manager team, policy admin, payroll preview, and `/api/v1/metrics`.
5. Pass thresholds: p95 latency under 1 second for steady-state API requests, error rate below 1%, and no sustained `HcmApiHighErrorRate` or `HcmApiHighLatencyP95` alerts.
6. Attach the smoke and load summary to the release notes before production approval.

The release workflow runs the runtime and golden workflow smoke automatically when the repository variable
`RUNTIME_API_BASE_URL` points at a deployed candidate API. If that variable is empty, deployment approval must
record the manual smoke evidence before rollout.

## Migration Verification

CI runs migrations against a fresh PostgreSQL service for every pull request. Before a production release:

1. Back up the target database.
2. Run the Kubernetes migration job from `deploy/k8s/base/migration-job.yaml`.
3. Confirm `/api/v1/health/ready` returns healthy after migration.
4. Confirm audit, outbox, notification, and policy tables are present.

## Backup, Restore, And Disaster Recovery

The disaster recovery procedure is maintained in `docs/disaster-recovery.md`. Release approval requires a current backup, a documented restore point, and confirmation that the latest restore drill met the published RPO and RTO targets.

## Container Images

The release workflow publishes:

- `ghcr.io/<owner>/hr-hcm-api:<version>`
- `ghcr.io/<owner>/hr-hcm-web:<version>`
- `latest` tags for both images

Use versioned tags for production. Avoid deploying `latest` outside test environments.

## Kubernetes Deployment

Base manifests live in `deploy/k8s/base`.

Recommended deployment flow:

1. Build and publish images through the release workflow.
2. Update image tags with Kustomize:
   `kubectl kustomize deploy/k8s/base`.
3. Apply secrets from a real secret manager or environment overlay. The base kustomization intentionally does not deploy `secret.example.yaml`.
4. Run the migration job.
5. Apply API and web deployments.
6. Verify health probes and smoke the login, employee, manager, and admin routes.

## Rollback

Rollback must be deliberate:

1. Stop new rollout: `kubectl rollout pause deployment/hcm-api deployment/hcm-web`.
2. Roll back app images: `kubectl rollout undo deployment/hcm-api deployment/hcm-web`.
3. Do not roll back database migrations automatically.
4. If a migration caused the incident, restore from backup or run an approved down/fix migration.
5. Record the incident, affected version, database state, and remediation in the release notes.

## Release Ownership

- Engineering owns CI, tests, container images, and manifests.
- HR platform owner approves functional readiness.
- Security owner reviews secrets, dependency audit, and access changes.
- Operations owner approves migration and rollback plan.
