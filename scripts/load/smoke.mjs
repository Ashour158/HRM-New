#!/usr/bin/env node
/**
 * Dependency-free load smoke (TEST-2).
 *
 * Fires a fixed concurrency of requests at a target URL for a duration, then reports
 * throughput (RPS) and latency percentiles (p50/p90/p95/p99) and asserts SLO
 * thresholds. No external load tool / npm dep required, so it runs anywhere Node
 * runs (CI, local). Intended as a baseline gate, not a full stress/soak rig — point
 * it at a representative read endpoint (e.g. /api/v1/health/ready) or an authed path
 * via LOAD_HEADERS.
 *
 * Env:
 *   LOAD_URL          target URL (required)
 *   LOAD_METHOD       HTTP method (default GET)
 *   LOAD_BODY         request body (optional)
 *   LOAD_HEADERS      JSON object of headers (optional, e.g. auth)
 *   LOAD_CONCURRENCY  in-flight requests (default 25)
 *   LOAD_DURATION_MS  test duration (default 10000)
 *   LOAD_WARMUP_MS    warmup excluded from stats (default 1000)
 *   LOAD_P95_MAX_MS   fail if p95 exceeds this (default 0 = no threshold)
 *   LOAD_MIN_RPS      fail if RPS below this (default 0 = no threshold)
 *   LOAD_MAX_ERROR_RATE fail if error rate above this fraction (default 0.01)
 */
const url = process.env.LOAD_URL;
if (!url) { console.error('LOAD_URL is required'); process.exit(2); }
const method = process.env.LOAD_METHOD ?? 'GET';
const body = process.env.LOAD_BODY;
const headers = process.env.LOAD_HEADERS ? JSON.parse(process.env.LOAD_HEADERS) : {};
const concurrency = Number(process.env.LOAD_CONCURRENCY ?? 25);
const durationMs = Number(process.env.LOAD_DURATION_MS ?? 10_000);
const warmupMs = Number(process.env.LOAD_WARMUP_MS ?? 1_000);
const p95Max = Number(process.env.LOAD_P95_MAX_MS ?? 0);
const minRps = Number(process.env.LOAD_MIN_RPS ?? 0);
const maxErrorRate = Number(process.env.LOAD_MAX_ERROR_RATE ?? 0.01);

const latencies = [];
let total = 0; let errors = 0; let measuring = false;
const start = Date.now();
const warmupEnd = start + warmupMs;
const end = start + warmupMs + durationMs;

async function worker() {
  while (Date.now() < end) {
    const now = Date.now();
    if (!measuring && now >= warmupEnd) measuring = true;
    const t0 = performance.now();
    try {
      const res = await fetch(url, { method, body, headers });
      // Drain the body so the connection is reusable.
      await res.arrayBuffer();
      const dt = performance.now() - t0;
      if (measuring) { total++; latencies.push(dt); if (res.status >= 500) errors++; }
    } catch {
      if (measuring) { total++; errors++; }
    }
  }
}

function pct(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

const t = Date.now();
await Promise.all(Array.from({ length: concurrency }, () => worker()));
const elapsedSec = (Date.now() - Math.max(t, warmupEnd)) / 1000;

latencies.sort((a, b) => a - b);
const rps = total / Math.max(elapsedSec, 0.001);
const errorRate = total ? errors / total : 0;
const report = {
  url, method, concurrency, durationMs,
  requests: total,
  rps: Math.round(rps),
  errorRate: Number(errorRate.toFixed(4)),
  latencyMs: {
    p50: Math.round(pct(latencies, 50)),
    p90: Math.round(pct(latencies, 90)),
    p95: Math.round(pct(latencies, 95)),
    p99: Math.round(pct(latencies, 99)),
    max: Math.round(latencies[latencies.length - 1] ?? 0),
  },
};
console.log(JSON.stringify(report, null, 2));

const failures = [];
if (p95Max && report.latencyMs.p95 > p95Max) failures.push(`p95 ${report.latencyMs.p95}ms > ${p95Max}ms`);
if (minRps && report.rps < minRps) failures.push(`rps ${report.rps} < ${minRps}`);
if (errorRate > maxErrorRate) failures.push(`error rate ${report.errorRate} > ${maxErrorRate}`);
if (failures.length) { console.error('LOAD SMOKE FAILED: ' + failures.join('; ')); process.exit(1); }
console.log('LOAD SMOKE PASS');
