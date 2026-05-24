# AGENTS.md — Enterprise HR/HCM SaaS Platform

> **Project type:** Full-stack pnpm/Turbo monorepo with NestJS backend, React/Vite frontend, and shared packages.  
> **Language:** English (source), TypeScript  
> **Purpose:** Enterprise Human Resources / Human Capital Management (HR/HCM) SaaS platform implementation.

---

## Project Overview

This repository is the **full-stack implementation** of the enterprise HR/HCM SaaS platform (Blueprint v1.4). It is organized as a pnpm workspaces monorepo with Turbo 2.x orchestration.

### Architecture Highlights

- **Backend:** NestJS modular monolith with CQRS, domain-driven design, and 25+ bounded contexts
- **Frontend:** React 18 SPA with Vite, Tailwind CSS, and shadcn/ui components
- **Database:** PostgreSQL with Kysely query builder, tenant isolation, and node-pg-migrate
- **Cache:** Redis
- **Events:** Kafka with outbox/inbox pattern
- **Access Control:** RBAC, ABAC, SoD, and field-level privacy policies
- **Audit:** Immutable audit ledger for every meaningful action

### Core Architectural Doctrine

1. **One authority per concept** — Every HR business concept has exactly one owning domain.
2. **Canonical registries** — FSMs, commands, events, aggregates, and rule packs are all canonically registered.
3. **Event nervous system** — Cross-domain communication happens through canonical events.
4. **Policy engines as authority** — All policy decisions are explainable, versioned, and recorded.
5. **Strict tenant isolation** — Every table, query, event, and projection is tenant-scoped.
6. **Field-level HR privacy** — Data classification governs every field access.
7. **Audit discipline** — Every meaningful action produces an immutable audit record.
8. **Outbox / Inbox pattern** — All cross-domain events flow through the outbox pattern.
9. **Idempotency by design** — Every command and saga step is deterministically idempotent.
10. **AI advisory only** — HR AI remains governed and advisory; it never owns HR truth.

---

## Repository Structure

```
.
├── apps/
│   ├── hr-api/              # NestJS API backend
│   └── hr-web/              # React Vite frontend
├── packages/
│   ├── hr-shared-kernel/    # Value objects, Result/Option, guards
│   ├── hr-database/         # Kysely client, migrations, base repository
│   ├── hr-platform-core/    # Tenant context, audit, cache, idempotency
│   ├── hr-access-control/   # RBAC, ABAC, SoD, field policy
│   ├── hr-command-contracts/# Command DTOs and envelopes
│   ├── hr-event-schemas/    # Event envelope schemas
│   ├── hr-policy-engines/   # Policy engine registry
│   └── hr-openapi-contracts/ # OpenAPI contract types
├── infra/
│   └── docker-compose.yml   # PostgreSQL, Redis, Kafka
├── turbo.json               # Turbo 2.x task orchestration
├── pnpm-workspace.yaml
└── package.json
```

---

## Technology Stack

- **Backend:** NestJS 10, TypeScript 5.3, Kysely, PostgreSQL, Redis, Kafka
- **Frontend:** React 18, Vite 5, Tailwind CSS 3, shadcn/ui, TanStack Query, Zustand
- **Monorepo:** pnpm 9, Turbo 2.x
- **Testing:** Vitest 1.6, @nestjs/testing
- **Linting:** ESLint 8, @typescript-eslint, Prettier 3

---

## How to Navigate

### Start Here

1. **For backend API** → `apps/hr-api/src/main.ts`
2. **For worker lifecycle** → `apps/hr-api/src/domains/hr-core/`
3. **For frontend** → `apps/hr-web/src/App.tsx`
4. **For shared types** → `packages/hr-shared-kernel/src/`
5. **For database schema** → `packages/hr-database/src/types/platform-tables.ts`

### Key Directories

| Path | Purpose |
|------|---------|
| `apps/hr-api/src/domains/` | 25+ bounded contexts with aggregates, commands, FSMs, repositories |
| `apps/hr-api/src/platform/` | Command bus, event bus, FSM framework, tenant interceptor |
| `apps/hr-web/src/pages/` | Route pages (admin, employee, portal) |
| `packages/hr-shared-kernel/src/` | Domain primitives (Result, Option, UUID, Money, Email, Guard) |
| `packages/hr-access-control/src/` | RBAC engine, ABAC engine, SoD matrix, field policy |

---

## Key Abbreviations

| Abbreviation | Meaning |
|--------------|---------|
| FSM | Finite State Machine |
| RBAC | Role-Based Access Control |
| ABAC | Attribute-Based Access Control |
| SoD | Segregation of Duties |
| HRBP | HR Business Partner |
| ER | Employee Relations |
| WFM | Workforce Management |
| LMS | Learning Management System |
| VMS | Vendor Management System |
| EAP | Employee Assistance Program |
| DEI | Diversity, Equity & Inclusion |
| HR/HCM | Human Resources / Human Capital Management |
| DDL | Data Definition Language |
| ADR | Architecture Decision Record |

---

## Editing Conventions

When modifying code in this repository:

1. **Keep TypeScript strict** — All packages use `strict: true`.
2. **Maintain domain boundaries** — Do not let one domain mutate another's aggregates.
3. **Use the shared kernel** — Value objects and Result/Option types live in `hr-shared-kernel`.
4. **Respect tenant isolation** — Every repository insert auto-injects `tenant_id` from AsyncLocalStorage.
5. **Preserve cross-references** — If renaming an FSM state or event, update all registrations.
6. **Version consistently** — Mark new architectural elements with the version introduced.
7. **Field-level privacy** — Annotate sensitive fields with their HR data classification level.
8. **Add tests** — New domain behavior should have unit tests; API controllers should have smoke tests.

---

## Build, Test, and Deployment

### Root Commands

```bash
pnpm build        # Turbo build all packages and apps
pnpm typecheck    # Turbo type-check all packages and apps
pnpm lint         # Turbo lint all packages and apps
pnpm test         # Turbo test all packages and apps
pnpm infra:up     # Docker Compose up (PostgreSQL, Redis, Kafka)
pnpm infra:down   # Docker Compose down
pnpm db:migrate   # Run database migrations
pnpm api:start    # Start API dev server
pnpm web:dev      # Start web dev server
```

### Package Scripts

Each workspace package supports:
- `build` — Compile TypeScript
- `typecheck` — `tsc --noEmit`
- `lint` — ESLint
- `test` — Vitest run (with `--passWithNoTests` where applicable)

---

## Security and Privacy Considerations

This platform handles **highly sensitive HR data**. When editing:

- The codebase contains detailed data classification rules (`SPECIAL_CATEGORY`, etc.).
- SoD matrices and break-glass procedures are in `packages/hr-access-control/`.
- Audit and legal-hold requirements are enforced in the command pipeline.
- Do **not** add sample PII or real employee records to tests or seed data.
- Ensure tenant context is present for all DB writes.

---

## Summary for Agents

- **This is a full-stack monorepo.** There is real code to compile, tests to run, and packages to install.
- **All truth is in code and docs.** The master blueprint lives in `enterprise_hr_hcm_master_blueprint_v1_4_country_policy_approval_ready.md`; the implementation lives in `apps/` and `packages/`.
- **When asked to modify architecture**, edit both the relevant Markdown file and the corresponding code.
- **When asked about the tech stack**, refer to actual `package.json` files and the config above.
- **When generating code**, create it in the appropriate workspace package or app.
