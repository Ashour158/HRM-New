# Production Infrastructure Setup

This is the honest, step-by-step path from what's in this repo (Terraform + K8s
manifests — real, `terraform validate`/`kubectl kustomize`-clean code) to an actually
running production environment. Nothing in `deploy/terraform/` has been applied and no
real AWS/GitHub resources have been created on your behalf — every step below that
touches a real account is something **you** run, with **your** credentials.

Related reading: [`docs/postgres-pitr.md`](postgres-pitr.md) (PITR design),
[`docs/disaster-recovery.md`](disaster-recovery.md) (RPO/RTO targets + restore
procedure), [`docs/GO-LIVE-RUNBOOK.md`](GO-LIVE-RUNBOOK.md) (the broader go-live
checklist this slots into — items 2 and 3 there are what this document closes out).

## 0. What's real vs. what you still have to do

| | Real / scaffolded here | You do, with real credentials |
|---|---|---|
| Cloud account | — | Create the AWS account (or use an existing one) |
| Cluster + DB infra | `deploy/terraform/*.tf` — valid, `terraform validate`-clean HCL for a VPC, EKS cluster, RDS Postgres (PITR), AWS Budgets alert | `terraform init` / `plan` / `apply` with real credentials against a real backend |
| K8s app manifests | `deploy/k8s/base/` (existing) + the `hcm-platform-secrets` naming fix in this change | Populate the real `hcm-platform-secrets` Secret; apply to the real cluster |
| Observability | `deploy/observability/` — Prometheus + Alertmanager + kube-state-metrics Deployments, wired to the existing alert rules/routing config | Apply to the real cluster; provision `hcm-alertmanager-secrets` (Slack/PagerDuty) for real |
| GitHub | — | Any GitHub Environments/secrets/variables referenced by CI workflow YAML must be created by you in the GitHub UI — this change does not create or touch any live GitHub repo setting |

## 1. Create the AWS account and IAM access

1. Create (or designate) an AWS account for this environment.
2. Create an IAM identity for Terraform (a dedicated deploy role/user — not your personal
   root/console user) with permissions to manage VPC, EKS, RDS, IAM, KMS, Budgets, and
   Secrets Manager resources. Least-privilege scoping of this role is your call; it needs
   broad infra-admin permissions to run this configuration.
3. Configure credentials locally (`aws configure` / SSO profile) so the `aws` provider in
   `deploy/terraform/` can authenticate. Do not put access keys in any file in this repo.

## 2. Configure Terraform state and variables

1. Create a private S3 bucket + DynamoDB table (or your preferred backend) for Terraform
   state, in an account/bucket you control. Uncomment and fill in the `backend "s3" {}`
   block in `deploy/terraform/versions.tf` with real values, then run `terraform init`
   again (it will prompt to migrate state).
2. Copy `deploy/terraform/terraform.tfvars.example` to
   `deploy/terraform/terraform.tfvars` and replace every placeholder value (region,
   account id, CIDR, budget email, etc.) with real ones. **`terraform.tfvars` must never
   be committed** — it's already covered by `.gitignore`.

## 3. Provision the infrastructure

```sh
cd deploy/terraform
terraform init
terraform plan    # review carefully — this is real infra with real cost
terraform apply
```

This creates: a VPC (public/private subnets across `var.az_count` AZs, NAT gateway(s)),
an EKS cluster + managed node group, an RDS PostgreSQL instance (encrypted, with
`backup_retention_period = var.db_backup_retention_days` — this is what gives you native
PITR, see `docs/postgres-pitr.md`), and an `aws_budgets_budget` account-level cost alert.

Capture the outputs (`terraform output`) — you need `eks_cluster_name`, `rds_endpoint`,
`rds_db_name`, and `rds_master_user_secret_arn` for the next steps.

## 4. Point kubectl at the new cluster

```sh
aws eks update-kubeconfig --name <output.eks_cluster_name> --region <your-region>
kubectl get nodes    # confirm the node group registered
```

## 5. Provision the database roles and populate the real K8s secret

1. Fetch the RDS master credentials Terraform generated (RDS-managed, never stored in
   Terraform state as plaintext):
   ```sh
   aws secretsmanager get-secret-value --secret-id <output.rds_master_user_secret_arn>
   ```
2. Run the RLS role-provisioning script **once**, as that master role, against the new
   RDS endpoint:
   ```sh
   psql "postgresql://<master-user>:<master-password>@<output.rds_endpoint>/<output.rds_db_name>" \
     -v app_password="'<a-strong-generated-password>'" \
     -f infra/rls/provision-app-role.sql
   ```
   This creates the `hcm_app` (RLS-subject) and `hcm_system` (BYPASSRLS) roles the
   application actually connects as — see `infra/rls/README.md` and
   `docs/RLS-ROLLOUT-PLAN.md` for the full model. **Known gap:** as shipped, this script
   does not grant `hcm_system` `CREATEDB` — the restore-drill CronJob's `CREATE
   DATABASE`/`DROP DATABASE` step needs that privilege (see the comment in
   `deploy/k8s/base/restore-drill-cronjob.yaml`). Decide how to close that (grant it to
   `hcm_system`, or provision a separate least-privilege drill role) as part of this step
   — that decision belongs with whoever owns the RLS role model, not this infra change.
3. Build the two connection strings and populate the real `hcm-platform-secrets` Secret
   (copy `deploy/k8s/base/secret.example.yaml` to a real, gitignored `secret.yaml` — do
   not commit it):
   - `DATABASE_URL` = `postgresql://hcm_app:<password>@<output.rds_endpoint>/<output.rds_db_name>`
   - `SYSTEM_DATABASE_URL` = `postgresql://hcm_system:<password>@<output.rds_endpoint>/<output.rds_db_name>`
   - fill in the remaining keys (`JWT_SECRET`, `ENCRYPTION_KEY_ID`, etc.) with real values.
4. Apply it:
   ```sh
   kubectl apply -n hcm-production -f secret.yaml
   ```

## 6. Deploy the application

```sh
kubectl apply -k deploy/k8s/base
```

(Or the equivalent overlay, if the base/overlays restructuring from the parallel effort
has landed by the time you read this.)

## 7. Deploy Prometheus + Alertmanager for real

```sh
kubectl apply -k deploy/observability
```

Then provision the real Alertmanager receiver secrets (copy
`deploy/observability/alertmanager-secret.example.yaml` to a real, gitignored
`secret.yaml` with your real Slack webhook URL and PagerDuty routing key):

```sh
kubectl apply -n hcm-observability -f secret.yaml
```

**Acceptance:** `kubectl -n hcm-observability get pods` shows `prometheus`,
`alertmanager`, and `kube-state-metrics` Running; `http://<prometheus-svc>:9090/targets`
shows the `kubernetes-pods` and `kube-state-metrics` jobs up; forcing a synthetic
critical alert (per `docs/GO-LIVE-RUNBOOK.md` item 2) pages on-call for real.

## 8. Drill a real PITR restore

Follow `docs/postgres-pitr.md` / `docs/disaster-recovery.md`'s restore procedure against
the real RDS instance (RDS console or `aws rds restore-db-instance-to-point-in-time`),
verify the recovered data, and record the achieved RPO/RTO in the release evidence per
`docs/GO-LIVE-RUNBOOK.md` item 3.

## 9. GitHub Environments / CI secrets (if your workflows reference one)

If any CI workflow YAML in this repo references `environment: <name>`, that's just a
string in the workflow file — it does not require a matching GitHub Environment to exist
for the YAML itself to be valid. To actually gate deploys on it:

1. In the GitHub repo settings UI: **Settings → Environments → New environment**.
2. Add the real secrets/variables that environment's jobs need (cloud credentials,
   `KUBECONFIG`, etc.) directly in the GitHub UI.
3. Optionally add required reviewers / wait timers on the environment.

This repo does not create, modify, or otherwise touch any live GitHub repository
setting, Environment, secret, or variable — that's entirely a manual step you perform in
the GitHub UI (or via `gh`/the API yourself, outside of this change).

## 10. Ongoing cost visibility

- The `aws_budgets_budget` resource in `deploy/terraform/budgets.tf` alerts by email
  (and optionally SNS) at 80% actual / 100% forecasted / 90% actual (if an SNS topic is
  configured) of `var.monthly_budget_limit_usd`. Revisit that number once you have a real
  baseline month of spend.
- Inside the cluster, `HcmHpaAtMaxReplicasSustained` (in
  `deploy/observability/prometheus-rules.yaml`) fires when an HPA sits at its
  `maxReplicas` ceiling for 30+ minutes — a capacity/cost signal now capable of actually
  firing once step 7 above is applied (previously inert — no Prometheus was deployed
  anywhere to evaluate it). Note that specific alert rule ships on a separate,
  not-yet-merged branch (`chore/dockerfile-copy-trim-cost-guardrail`); once that lands on
  `main`, `deploy/observability`'s `configMapGenerator` picks it up automatically on the
  next `kubectl apply -k deploy/observability` — nothing here needs to change.
