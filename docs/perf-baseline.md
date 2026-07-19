# Performance Baseline (app-under-load)

Closes PERF-1: the load harness (`scripts/load/smoke.mjs`) is now run against a **live,
booted hr-api instance** — not just proven to gate. Recorded baseline + a CI job
(`load-smoke`) that boots the API and load-tests `/api/v1/health` on every push.

## Recorded baseline — 2026-06-30 (local, dev DB)
Booted `node apps/hr-api/dist/main.js` (NODE_ENV=development, Postgres 5434, Redis 6379),
then `scripts/load/smoke.mjs` against `GET /api/v1/health`:

| metric | value |
|---|---|
| concurrency | 25 |
| duration | 12 s (1.5 s warmup excluded) |
| requests | 6,253 |
| RPS | 519 |
| error rate | 0 |
| p50 / p90 / p95 / p99 / max (ms) | 46 / 71 / 78 / 97 / 181 |

Result: **LOAD SMOKE PASS** against SLO gates `LOAD_P95_MAX_MS=150`, `LOAD_MIN_RPS=200`,
`LOAD_MAX_ERROR_RATE=0.01`.

## CI gate
`.github/workflows/ci.yml` job **`load-smoke`** boots the built API against Postgres+Redis
services, waits for readiness, and runs the harness with the SLO thresholds above (kept in
sync with the `LOAD_P95_MAX_MS`/`LOAD_MIN_RPS` env vars in that job — update both together). A
regression that pushes p95 over the gate or drops RPS fails the build.

Note: these gates are measured against `/api/v1/health`, a trivial static health check with
no DB/Redis/auth work — passing this gate does not by itself prove a representative
authenticated business endpoint meets these SLOs (see PERF-2 below).

## Not yet covered (tracked, P2/P3)
- This is a **smoke** profile (fixed concurrency, health endpoint). Soak (sustained
  multi-hour) and spike (ramped concurrency) profiles, and authenticated business-endpoint
  load, are still to be added (PERF-2).
- Production-scale baselines should be captured in staging against representative data
  volumes and recorded in release evidence.
