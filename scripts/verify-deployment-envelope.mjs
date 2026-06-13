import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const requiredFiles = [
  '.github/workflows/ci.yml',
  '.github/workflows/release.yml',
  '.github/workflows/codeql.yml',
  '.github/dependabot.yml',
  'apps/hr-api/Dockerfile',
  'apps/hr-web/Dockerfile',
  'apps/hr-web/nginx.conf',
  'deploy/k8s/base/kustomization.yaml',
  'deploy/k8s/base/api-deployment.yaml',
  'deploy/k8s/base/web-deployment.yaml',
  'deploy/k8s/base/migration-job.yaml',
  'deploy/k8s/base/ingress.yaml',
  'deploy/k8s/base/secret.example.yaml',
  'deploy/k8s/overlays/ci/kustomization.yaml',
  'deploy/k8s/overlays/production/kustomization.yaml',
  'deploy/observability/prometheus-rules.yaml',
  'deploy/docker-compose.production.yml',
  'docs/disaster-recovery.md',
  'docs/observability-runbook.md',
  'docs/release-process.md',
  'SECURITY.md',
  'apps/hr-web/playwright.config.ts',
  'apps/hr-web/e2e/login-accessibility.spec.ts',
  'apps/hr-web/src/pages/login.a11y.test.tsx',
  'scripts/secret-scan.mjs',
  'apps/hr-api/src/observability/observability-metrics.service.spec.ts',
  'apps/hr-api/src/observability/observability.middleware.spec.ts',
  'apps/hr-api/src/observability/opentelemetry.spec.ts',
];

const missing = requiredFiles.filter((file) => !existsSync(join(root, file)));

const contentChecks = [
  {
    file: '.github/workflows/ci.yml',
    patterns: [
      /pull_request/,
      /pnpm secret:scan/,
      /pnpm ci:verify-deployment-envelope/,
      /pnpm lint/,
      /pnpm typecheck/,
      /pnpm test/,
      /pnpm --filter hr-web content:check/,
      /pnpm --filter hr-web test:a11y/,
      /pnpm --filter hr-web exec playwright install --with-deps chromium/,
      /pnpm --filter hr-web test:e2e/,
      /pnpm build/,
      /pnpm audit --prod --audit-level high/,
      /aquasecurity\/trivy-action/,
      /pnpm --filter @hcm\/database migrate/,
      /Kubernetes manifest gate/,
      /postgres:15-alpine/,
      /docker\/build-push-action/,
      /load:\s*true/,
      /apps\/hr-api\/Dockerfile/,
      /apps\/hr-web\/Dockerfile/,
    ],
  },
  {
    file: '.github/workflows/release.yml',
    patterns: [
      /tags:\s*[\s\S]*v\*/,
      /pnpm secret:scan/,
      /pnpm audit --prod --audit-level high/,
      /pnpm ci:verify-deployment-envelope/,
      /pnpm --filter @hcm\/database migrate/,
      /pnpm lint/,
      /pnpm typecheck/,
      /pnpm test/,
      /pnpm --filter hr-web content:check/,
      /pnpm --filter hr-web test:a11y/,
      /pnpm --filter hr-web exec playwright install --with-deps chromium/,
      /pnpm --filter hr-web test:e2e/,
      /pnpm build/,
      /ghcr\.io/,
      /docker\/login-action/,
      /docker\/build-push-action/,
      /softprops\/action-gh-release/,
      /vars\.RUNTIME_API_BASE_URL/,
      /RUNTIME_API_BASE_URL is required before creating a production release/,
      /pnpm runtime:smoke/,
      /pnpm runtime:golden-workflow/,
      /actions\/upload-artifact/,
      /needs:[\s\S]*runtime-smoke/,
    ],
  },
  {
    file: '.github/workflows/codeql.yml',
    patterns: [
      /github\/codeql-action\/init/,
      /javascript-typescript/,
      /security-and-quality/,
      /github\/codeql-action\/analyze/,
    ],
  },
  {
    file: '.github/dependabot.yml',
    patterns: [
      /package-ecosystem:\s*npm/,
      /package-ecosystem:\s*github-actions/,
      /interval:\s*weekly/,
    ],
  },
  {
    file: 'apps/hr-api/Dockerfile',
    patterns: [
      /node:20/,
      /pnpm install --frozen-lockfile/,
      /pnpm --filter @hcm\/hr-api build/,
      /USER node/,
      /HEALTHCHECK[\s\S]*\/api\/v1\/health\/live/,
      /CMD \["node", "apps\/hr-api\/dist\/main\.js"\]/,
    ],
  },
  {
    file: 'apps/hr-web/Dockerfile',
    patterns: [
      /node:20/,
      /VITE_API_BASE_URL/,
      /pnpm --filter hr-web build/,
      /nginx:1\.27-alpine/,
      /HEALTHCHECK[\s\S]*\/healthz/,
    ],
  },
  {
    file: 'apps/hr-web/nginx.conf',
    patterns: [
      /X-Content-Type-Options/,
      /X-Frame-Options/,
      /Referrer-Policy/,
      /try_files \$uri \$uri\/ \/index\.html/,
    ],
  },
  {
    file: 'deploy/docker-compose.production.yml',
    patterns: [
      /POSTGRES_PASSWORD:\s*\$\{POSTGRES_PASSWORD:\?set POSTGRES_PASSWORD\}/,
      /JWT_SECRET:\s*\$\{JWT_SECRET:\?set JWT_SECRET\}/,
      /ENCRYPTION_KEY_ID:\s*\$\{ENCRYPTION_KEY_ID:\?set ENCRYPTION_KEY_ID\}/,
      /healthcheck:/,
      /OTEL_ENABLED/,
      /postgres_data:/,
      /redis_data:/,
      /redpanda_data:/,
    ],
  },
  {
    file: 'deploy/k8s/base/kustomization.yaml',
    patterns: [
      /api-deployment\.yaml/,
      /web-deployment\.yaml/,
      /migration-job\.yaml/,
      /ingress\.yaml/,
    ],
  },
  {
    file: 'deploy/k8s/base/api-deployment.yaml',
    patterns: [
      /replicas:\s*2/,
      /prometheus\.io\/scrape:\s*"true"/,
      /prometheus\.io\/path:\s*\/api\/v1\/metrics/,
      /readinessProbe:[\s\S]*\/api\/v1\/health\/ready/,
      /livenessProbe:[\s\S]*\/api\/v1\/health\/live/,
      /resources:[\s\S]*requests:[\s\S]*limits:/,
      /secretRef:[\s\S]*hcm-platform-secrets/,
      /automountServiceAccountToken:\s*false/,
      /allowPrivilegeEscalation:\s*false/,
      /readOnlyRootFilesystem:\s*true/,
      /startupProbe:/,
      /timeoutSeconds:/,
      /capabilities:[\s\S]*drop:[\s\S]*ALL/,
    ],
  },
  {
    file: 'deploy/k8s/base/web-deployment.yaml',
    patterns: [
      /replicas:\s*2/,
      /readinessProbe:[\s\S]*\/healthz/,
      /livenessProbe:[\s\S]*\/healthz/,
      /automountServiceAccountToken:\s*false/,
      /resources:[\s\S]*requests:[\s\S]*limits:/,
      /allowPrivilegeEscalation:\s*false/,
      /readOnlyRootFilesystem:\s*true/,
      /volumeMounts:[\s\S]*nginx-cache/,
      /volumes:[\s\S]*nginx-cache/,
      /startupProbe:/,
      /timeoutSeconds:/,
      /capabilities:[\s\S]*drop:[\s\S]*ALL/,
    ],
  },
  {
    file: 'deploy/k8s/base/migration-job.yaml',
    patterns: [
      /backoffLimit:\s*1/,
      /activeDeadlineSeconds:\s*1800/,
      /ttlSecondsAfterFinished:\s*86400/,
      /restartPolicy:\s*Never/,
      /command:\s*\["pnpm", "--filter", "@hcm\/database", "migrate"\]/,
      /secretRef:[\s\S]*hcm-platform-secrets/,
      /resources:[\s\S]*requests:[\s\S]*limits:/,
      /automountServiceAccountToken:\s*false/,
      /allowPrivilegeEscalation:\s*false/,
      /readOnlyRootFilesystem:\s*true/,
      /capabilities:[\s\S]*drop:[\s\S]*ALL/,
    ],
  },
  {
    file: 'deploy/k8s/base/ingress.yaml',
    patterns: [
      /ingressClassName:\s*nginx/,
      /host:\s*hcm\.example\.com/,
      /tls:[\s\S]*secretName:\s*hcm-platform-tls/,
    ],
  },
  {
    file: 'deploy/k8s/base/secret.example.yaml',
    patterns: [
      /stringData:/,
      /DATABASE_URL:/,
      /JWT_SECRET:\s*replace-me/,
      /ENCRYPTION_KEY_ID:\s*replace-me/,
    ],
  },
  {
    file: 'deploy/k8s/overlays/ci/kustomization.yaml',
    patterns: [
      /namespace:\s*hcm-ci/,
      /newName:\s*ghcr\.io\/ashour158\/hr-hcm-api/,
      /newName:\s*ghcr\.io\/ashour158\/hr-hcm-web/,
      /newTag:\s*ci/,
      /hcm-ci\.local/,
    ],
  },
  {
    file: 'deploy/k8s/overlays/production/kustomization.yaml',
    patterns: [
      /namespace:\s*hcm-production/,
      /newName:\s*ghcr\.io\/ashour158\/hr-hcm-api/,
      /newName:\s*ghcr\.io\/ashour158\/hr-hcm-web/,
      /newTag:\s*v1\.4\.0/,
      /hcm\.company\.internal/,
    ],
  },
  {
    file: 'deploy/observability/prometheus-rules.yaml',
    patterns: [
      /HcmApiHighErrorRate/,
      /hcm_http_errors_total/,
      /HcmApiHighLatencyP95/,
      /hcm_http_request_duration_seconds_bucket/,
      /HcmOutboxPublishFailures/,
      /hcm_outbox_events_total/,
      /HcmInboxProcessingFailures/,
      /hcm_inbox_events_total/,
      /runbook_url:/,
    ],
  },
  {
    file: 'docs/observability-runbook.md',
    patterns: [
      /GET \/api\/v1\/metrics/,
      /hcm_http_requests_total/,
      /hcm_http_errors_total/,
      /hcm_http_request_duration_seconds_bucket/,
      /hcm_outbox_events_total/,
      /hcm_inbox_events_total/,
      /OTEL_ENABLED=true/,
      /traceparent/,
      /correlationId/,
      /Prometheus alert rules/i,
    ],
  },
  {
    file: 'apps/hr-web/playwright.config.ts',
    patterns: [
      /testDir:\s*['"]\.\/e2e['"]/,
      /baseURL:\s*['"]http:\/\/127\.0\.0\.1:4174['"]/,
      /strictPort/,
      /Desktop Chrome/,
    ],
  },
  {
    file: 'apps/hr-web/e2e/login-accessibility.spec.ts',
    patterns: [
      /@axe-core\/playwright/,
      /page\.goto\(['"]\/login['"]\)/,
      /wcag2a/,
      /wcag2aa/,
      /critical/,
      /serious/,
    ],
  },
  {
    file: 'apps/hr-web/src/pages/login.a11y.test.tsx',
    patterns: [
      /jest-axe/,
      /toHaveNoViolations/,
      /single sign-on is not configured/i,
    ],
  },
  {
    file: 'docs/release-process.md',
    patterns: [
      /version/i,
      /migration/i,
      /rollback/i,
      /release/i,
      /pnpm runtime:smoke/,
      /pnpm --filter hr-web test:a11y/,
      /pnpm --filter hr-web test:e2e/,
      /load/i,
      /p95/i,
      /backup/i,
      /restore/i,
      /disaster recovery/i,
      /pnpm secret:scan/,
      /pnpm audit --prod --audit-level high/,
    ],
  },
  {
    file: 'docs/disaster-recovery.md',
    patterns: [
      /RPO/i,
      /RTO/i,
      /backup/i,
      /restore/i,
      /PostgreSQL/i,
      /migration/i,
      /rollback/i,
      /drill/i,
      /evidence/i,
    ],
  },
  {
    file: 'SECURITY.md',
    patterns: [
      /GitHub Security Advisories/,
      /Initial triage target:\s*3 business days/,
      /CodeQL analysis/,
      /Trivy filesystem and image scans/,
      /runtime smoke and golden workflow smoke/,
    ],
  },
  {
    file: 'scripts/secret-scan.mjs',
    patterns: [
      /gitFiles\(\['ls-files'\]\)/,
      /ls-files', '--others', '--exclude-standard'/,
      /Secret values are intentionally not printed/,
      /AWS access key id/,
      /Google API key/,
      /GitHub token/,
      /isAllowedFinding/,
      /Private key block/,
      /Database URL with embedded credentials/,
      /JWT-like bearer token/,
      /process\.exit\(1\)/,
    ],
  },
  {
    file: 'apps/hr-api/src/observability/observability-metrics.service.spec.ts',
    patterns: [
      /hcm_http_requests_total/,
      /hcm_http_request_duration_seconds_sum/,
      /hcm_http_errors_total/,
      /hcm_outbox_events_total/,
      /hcm_inbox_events_total/,
    ],
  },
  {
    file: 'apps/hr-api/src/observability/observability.middleware.spec.ts',
    patterns: [
      /X-Correlation-Id/,
      /traceparent/,
      /HTTP_REQUEST/,
      /hcm_http_requests_total/,
    ],
  },
  {
    file: 'apps/hr-api/src/observability/opentelemetry.spec.ts',
    patterns: [
      /shouldStartOpenTelemetry/,
      /buildOpenTelemetryOptions/,
      /OTLP/,
      /otel-collector:4318\/v1\/traces/,
    ],
  },
];

const contentFailures = contentChecks.flatMap(({ file, patterns }) => {
  const path = join(root, file);
  if (!existsSync(path)) return [];
  const content = readFileSync(path, 'utf8');
  return patterns
    .filter((pattern) => !pattern.test(content))
    .map((pattern) => `${file} missing ${pattern}`);
});

if (missing.length || contentFailures.length) {
  if (missing.length) {
    console.error('Missing deployment envelope files:');
    missing.forEach((file) => console.error(`- ${file}`));
  }
  if (contentFailures.length) {
    console.error('Deployment envelope content checks failed:');
    contentFailures.forEach((failure) => console.error(`- ${failure}`));
  }
  process.exit(1);
}

console.log('Deployment envelope verified.');
