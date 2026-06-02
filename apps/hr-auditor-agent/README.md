# HRM Nexus Policy & Workflow Auditor

Small advisory Agents SDK sidecar for auditing HRM Nexus service wiring, policy workflow completeness, API route mismatches, scroll/layout blockers, placeholder workflows, and attendance geolocation evidence.

The auditor is intentionally read-only. It does not mutate HR data, approve actions, or write files.

## Local Commands

```bash
pnpm --filter @hcm/hr-auditor-agent build
pnpm --filter @hcm/hr-auditor-agent audit:dry
```

For API-backed agent mode:

```bash
Copy `.env.example` to `.env.local`, then set `OPENAI_API_KEY`.
pnpm --filter @hcm/hr-auditor-agent build
pnpm --filter @hcm/hr-auditor-agent audit:agent
```

Use `OPENAI_MODEL` if you want to override the SDK default model.

## What It Checks

- Migrated table names and migration files.
- Database trigger definitions.
- Backend controller routes.
- Frontend API client route calls.
- Layout files that trap page scroll with fixed viewport height and hidden overflow.
- Placeholder or demo markers in user-facing pages.
- Geolocation-related structured fields in migrations.
- Workflow, FSM, saga, command bus, outbox, and inbox files.

## Output

`audit:dry` prints a deterministic Markdown report. Add `--json` when invoking the built CLI directly to get raw evidence and report JSON.
