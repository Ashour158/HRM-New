# Staging Environment Setup

This document is the honest boundary between what's scaffolded in this repo
and what a human still has to go do, in order for a real "staging"
environment (the one `docs/GO-LIVE-RUNBOOK.md`, `docs/RLS-ROLLOUT-PLAN.md`,
and `docs/perf-baseline.md` already assume exists) to actually exist.

Nothing in this doc, or in the PR that introduced it, provisions any real
cloud resource, creates any real GitHub repository setting, or touches
branch protection. It's all code/config/docs. Every value below that looks
like a hostname, account id, or secret is a placeholder — read it as "put
your real one here," not as something already live.

## What's already scaffolded (real, applies cleanly)

| Piece | Where | What it does |
|---|---|---|
| Kustomize base + overlays | `deploy/k8s/base/`, `deploy/k8s/overlays/{staging,production}/` | `deploy/k8s/base/` is now environment-agnostic. `overlays/production/` reproduces today's hardcoded prod behavior exactly (verified byte-for-byte against the pre-refactor base). `overlays/staging/` patches namespace, replica counts, resource requests/limits, HPA min/max, DB connection-pool sizing, CORS, PDB, and ingress host down to a smaller, cost-conscious footprint. |
| Deploy workflow | `.github/workflows/deploy-staging.yml` | `workflow_dispatch`-only (never runs automatically). Builds and pushes candidate images, then applies the staging kustomize overlay. References a GitHub Environment named `staging` that doesn't exist yet — see below. |
| Local staging-like compose | `deploy/.env.staging.example` (reuses `deploy/docker-compose.production.yml`) | Lets a developer without cluster access run something staging-shaped locally. |
| This document | `docs/staging-environment-setup.md` | You're reading it. |

Validated with `kubectl kustomize` (v5.5.0, bundled with `kubectl` in this
environment — the standalone `kustomize` CLI wasn't installed here, but
`kubectl kustomize` uses the same library and is an equivalent check):

```
kubectl kustomize deploy/k8s/overlays/staging     # builds clean
kubectl kustomize deploy/k8s/overlays/production   # builds clean, byte-identical
                                                    # to the pre-refactor base output
```

The workflow YAML was checked with `actionlint` (installed via `go install`
for this check) with zero findings, and parsed with PyYAML to confirm job
structure. `kubectl apply --dry-run` against a real API server was **not**
run — there's no cluster in this environment to talk to, which is expected
per this task's scope (no live provisioning).

## What you still have to do

None of this is automated by this PR. In rough order:

### 1. Get a Kubernetes cluster staging can live in

Either a dedicated small cluster, or a separate namespace/node-pool on
whatever cluster already runs `hcm-production` — this repo doesn't assume
either way. Whatever you pick, you need `kubectl` access to it before
anything else here works.

### 2. Provision the datastores staging talks to

Postgres, Redis, and Redpanda/Kafka, reachable from the cluster. Point-in-time
recovery isn't required for staging the way it is for production, but the
app's `DB_RLS_ENABLED: "true"` setting (`deploy/k8s/base/configmap.yaml`) is
inherited by the staging overlay unchanged — staging runs with row-level
security ON by default, same as production. Before the first deploy, run
`infra/rls/provision-app-role.sql` against the staging database to create the
`hcm_app` / `hcm_system` roles (this is exactly step 1 of the "Remaining"
checklist in `docs/RLS-ROLLOUT-PLAN.md` — staging is precisely where that
step was meant to happen).

### 3. Create the in-cluster Kubernetes Secrets

Nothing in `deploy/k8s/overlays/staging/` creates or contains real secret
values — Kubernetes Secrets are deliberately not managed through this
kustomize tree. Create them directly in the `hcm-staging` namespace. Set the
real values as shell variables first — from your own password manager or
secrets store, never typed as literals that end up in shell history or a
terminal scrollback — then pass them to `kubectl` by reference:

```
kubectl create namespace hcm-staging   # or let the first `kubectl apply -k` create it

# STAGING_APP_DB_URL / STAGING_SYSTEM_DB_URL: standard Postgres connection
# strings (scheme postgresql, role hcm_app / hcm_system respectively, the
# password you set for that role in step 2, your staging Postgres host,
# port 5432, database hcm_platform) — same shape deploy/k8s/base/secret.example.yaml
# documents for production, just pointed at your staging instance.
kubectl -n hcm-staging create secret generic hcm-platform-secrets \
  --from-literal=DATABASE_URL="$STAGING_APP_DB_URL" \
  --from-literal=SYSTEM_DATABASE_URL="$STAGING_SYSTEM_DB_URL" \
  --from-literal=JWT_SECRET="$STAGING_JWT_SECRET" \
  --from-literal=ENCRYPTION_KEY_ID="$STAGING_ENCRYPTION_KEY_ID" \
  --from-literal=SYSTEM_API_KEY="$STAGING_SYSTEM_API_KEY" \
  --from-literal=INTEGRATION_API_KEY="$STAGING_INTEGRATION_API_KEY" \
  --from-literal=MFA_DEMO_CODE=''
```

The key list above comes straight from `deploy/k8s/base/secret.example.yaml`
— treat that file as the source of truth for what belongs in
`hcm-platform-secrets`.

**Pre-existing gap noticed while writing this doc, not introduced by this
PR:** `deploy/k8s/base/backup-cronjob.yaml` and
`deploy/k8s/base/restore-drill-cronjob.yaml` read from a *different* secret
object, `hcm-secrets` (keys `DATABASE_URL` and `ADMIN_DATABASE_URL`), which
has no corresponding entry in `secret.example.yaml` and no documented
provisioning step anywhere in the repo. If you want the backup/restore-drill
CronJobs to actually work in staging (or production), you'll also need:

```
# STAGING_BACKUP_DB_URL: connects as hcm_admin to hcm_platform (used for pg_dump).
# STAGING_ADMIN_DB_URL: connects as hcm_admin to the maintenance 'postgres' db
# (used by the restore drill to CREATE/DROP its scratch database).
kubectl -n hcm-staging create secret generic hcm-secrets \
  --from-literal=DATABASE_URL="$STAGING_BACKUP_DB_URL" \
  --from-literal=ADMIN_DATABASE_URL="$STAGING_ADMIN_DB_URL"
```

This mismatch is out of scope for this PR to fix (it's a pre-existing gap
in the backup/restore-drill wiring, not something the staging scaffolding
introduced) but it affects staging just as much as production, so it's
called out here rather than silently worked around.

### 4. Point DNS at the staging ingress

`deploy/k8s/overlays/staging/patch-ingress.yaml` sets the ingress host to
`staging.hcm.example.com` — an obvious placeholder, same style as
production's `hcm.example.com`. Replace it with your real staging hostname
(edit that file) and point DNS at your ingress controller's load balancer.
You'll also need a TLS certificate for that host bound to the
`hcm-platform-tls` secret in the `hcm-staging` namespace (cert-manager with
an `Issuer`/`ClusterIssuer` is the usual way; that's cluster configuration
this repo doesn't include).

### 5. Create the GitHub Environment

`.github/workflows/deploy-staging.yml` references `environment: staging` on
its `deploy` and `smoke` jobs. **This Environment object does not exist in
the repository yet, and this PR does not create it** — that's a live
GitHub-settings mutation and explicitly out of scope for this change.

In the GitHub UI: **Settings → Environments → New environment**, name it
exactly `staging`. From there:

- Add protection rules if you want them (required reviewers, wait timer,
  restrict to specific branches/tags) — this repo has no opinion on that,
  configure whatever fits your team.
- Add environment **secret** `KUBE_CONFIG_STAGING`: a base64-encoded
  kubeconfig (`cat ~/.kube/config | base64 -w0`, or your cluster provider's
  equivalent) scoped to a service account that can apply into the
  `hcm-staging` namespace. The `deploy` job in `deploy-staging.yml` fails
  loudly with a clear error if this isn't set — it won't silently no-op.
- Optionally add environment **variable** `STAGING_API_BASE_URL` (e.g.
  `https://staging.hcm.example.com/api/v1`) once DNS/ingress are live. This
  turns on the `smoke` job at the end of the workflow, which runs the same
  `pnpm runtime:smoke` harness `release.yml` uses for production candidates.
  Leave it unset and that job is a no-op — same pattern `release.yml`
  already uses for `RUNTIME_API_BASE_URL`.

No other GitHub secrets/variables are needed for the deploy workflow itself
— image pushes to `ghcr.io` use the automatic `GITHUB_TOKEN`, same as
`release.yml`.

### 6. Run it

Once 1–5 are done: **Actions → Deploy to Staging → Run workflow** (or
`gh workflow run deploy-staging.yml`). Watch the run; it builds and pushes
`api`/`web` images tagged with the short commit SHA (or your own tag via the
`image_tag` input), deletes any previous migration Job, applies the staging
overlay, waits for the migration Job to complete, and waits for both
Deployments to roll out. Then confirm from a machine with cluster access:

```
kubectl -n hcm-staging get pods
kubectl -n hcm-staging get ingress
curl -fsS https://staging.hcm.example.com/api/v1/health
```

## What's real vs. what's still yours to do — summary

**Real, ready to use as-is:**
- `deploy/k8s/base/` + `deploy/k8s/overlays/{staging,production}/` — valid,
  `kubectl kustomize`-verified Kustomize trees.
- `.github/workflows/deploy-staging.yml` — valid, `actionlint`-clean GitHub
  Actions workflow, manual-trigger-only.
- `deploy/.env.staging.example` — a working env file for
  `deploy/docker-compose.production.yml`, validated with `docker compose
  config`.

**Not done, and this PR does not attempt them:**
- Any real cloud account, cluster, or managed database.
- DNS for `staging.hcm.example.com` (or whatever real hostname you choose).
- The GitHub Environment `staging` itself, its protection rules, and its
  `KUBE_CONFIG_STAGING` secret / `STAGING_API_BASE_URL` variable.
- The in-cluster `hcm-platform-secrets` (and `hcm-secrets`, see the gap
  noted above) Kubernetes Secrets — real values, created directly against
  the cluster, never committed to git.
- Running `infra/rls/provision-app-role.sql` against the staging database.
- The first actual `workflow_dispatch` run.
