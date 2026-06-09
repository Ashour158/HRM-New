# HR/HCM Platform

Enterprise HR/HCM SaaS Platform — Full-Stack Implementation.

## Stack

- **Backend:** NestJS modular monolith with CQRS, Kysely, PostgreSQL
- **Frontend:** React 18 + Vite + Tailwind CSS + shadcn/ui
- **Infrastructure:** PostgreSQL, Redis, Kafka (via Docker Compose)
- **Monorepo:** pnpm workspaces + Turbo 2.x

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker & Docker Compose (for local infrastructure)

## Install

```bash
pnpm install
```

## Infrastructure (Local)

```bash
# Start PostgreSQL, Redis, Kafka
pnpm infra:up

# Stop
pnpm infra:down

# View logs
pnpm infra:logs
```

## Database Migrations & Seed

```bash
# Run migrations
pnpm db:migrate

# Seed default tenant (required for local dev)
pnpm db:seed
```

## Development

```bash
# API server (http://localhost:3001)
pnpm api:start

# If port 3001 is occupied, override via env:
PORT=3002 pnpm api:start

# Web dev server (http://localhost:5173)
pnpm web:dev

# If API is on a non-default port, set VITE_API_BASE_URL:
VITE_API_BASE_URL=http://localhost:3001/api/v1 pnpm web:dev
```

## Build & Verify

```bash
# Build all packages and apps
pnpm build

# Type-check all packages and apps
pnpm typecheck

# Lint all packages and apps
pnpm lint

# Run tests
pnpm test
```

## API Documentation

When the API is running, Swagger UI is available at:

```
http://localhost:3001/api/docs
```

## Project Structure

```
.
├── apps/
│   ├── hr-api/          # NestJS API backend
│   └── hr-web/          # React Vite frontend
├── packages/
│   ├── hr-shared-kernel/# Result/Option, UUID, Money, Guards
│   ├── hr-database/     # Kysely DB client, migrations, base repository
│   ├── hr-platform-core/# Tenant context, audit, cache, idempotency
│   ├── hr-access-control/  # RBAC, ABAC, SoD, field policy
│   ├── hr-command-contracts/  # Command DTOs and envelopes
│   ├── hr-event-schemas/      # Event envelope schemas
│   ├── hr-policy-engines/     # Policy engine registry
│   └── hr-openapi-contracts/  # OpenAPI contract types
├── infra/
│   └── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

## Local URLs

| Service | URL |
|---------|-----|
| API | http://localhost:3001 (or `PORT` env) |
| Swagger | http://localhost:3001/api/docs |
| Health | http://localhost:3001/api/v1/health |
| Metrics | http://localhost:3001/api/v1/metrics |
| Web App | http://localhost:5173 |

### Authentication

The API enforces authentication through global Nest guards. Controllers no longer
need to opt in one by one. Routes that must remain unauthenticated, such as
health checks and login, are marked with the explicit `@Public()` decorator.

Seeded local users can sign in through:

```http
POST /api/v1/auth/login
```

The login response returns an access token, refresh token, and session metadata.
The web client stores both tokens, refreshes access tokens through
`POST /api/v1/auth/refresh`, and clears the session on refresh failure. Protected
requests use `Authorization: Bearer <token>`.

The seeded default tenant is:

```
X-Tenant-ID: 00000000-0000-0000-0000-000000000001
```

The web client automatically sends this header when `tenant_id` is set in localStorage:

```js
localStorage.setItem('tenant_id', '00000000-0000-0000-0000-000000000001');
```

JWT tenant claims are the primary tenant source for authenticated requests.
Header-based tenant resolution remains available for local tooling, API-key
system actors, and internal paths.

Authentication capabilities:

- `GET /api/v1/auth/providers` exposes configured local, OIDC, SAML, MFA, and
  session settings without leaking secrets.
- `POST /api/v1/auth/mfa/verify` upgrades a protected session when MFA is
  required.
- API-key authentication is still available for governed system and integration
  actors through the configured `API_KEY_HEADER`.
- Permission checks are enforced globally through the permission guard when
  controllers declare `@Permissions(...)` or `@AllPermissions(...)`.

## Worker Lifecycle Vertical Slice

The platform implements an end-to-end worker lifecycle:

1. **Create Worker** — `POST /api/v1/hr/core/workers`
2. **Activate Worker** — `POST /api/v1/hr/core/workers/:id/commands/activate`
3. **Assign Job** — `POST /api/v1/hr/core/job-assignments`
4. **View Workers** — `GET /api/v1/hr/core/workers`
5. **Audit & Outbox** — Every command writes to `audit_log` and `outbox_events`

The HR Admin UI at `/admin/workers` displays the worker list and detail view.
