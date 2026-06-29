import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { getPool, getSystemPool } from '@hcm/database';
import { createReadinessMetadata } from '../src/integrations/readiness.js';
import { IntegrationHealthService } from '../src/integrations/integration-health.service.js';
import { IntegrationOrchestrator } from '../src/integrations/integration-orchestrator.service.js';
import type { IntegrationAdapter, IntegrationResult } from '../src/integrations/types.js';

let dbReady = false;
let skipReason = '';
const marker = `e2e-dlq-${randomUUID()}`;

async function canReachDatabase(): Promise<boolean> {
  if (!process.env.DATABASE_URL) { skipReason = 'DATABASE_URL not set'; return false; }
  try {
    await Promise.race([
      getPool().query('select 1'),
      new Promise((_r, rej) => setTimeout(() => rej(new Error('db timeout')), 5000)),
    ]);
    return true;
  } catch (e) { skipReason = e instanceof Error ? e.message : String(e); return false; }
}

function failingAdapter(error: string): IntegrationAdapter {
  const res: IntegrationResult = {
    success: false, adapterName: 'retry-adapter', operationId: randomUUID(),
    timestamp: new Date(), error, details: { retryable: true },
  };
  return {
    name: 'retry-adapter', direction: 'OUTBOUND',
    readiness: createReadinessMetadata({
      ownerTeam: 'Test', ownerContact: 't@example.com',
      sandboxEndpointRef: 'env:X', productionEndpointRef: 'env:Y', credentialRefBase: 'env:Z',
      credentialState: 'CONFIGURED',
      retryPolicy: { maxAttempts: 1, deadLetterAfterAttempts: 1, initialDelayMs: 0, maxDelayMs: 0 },
    }),
    healthCheck: async () => true,
    send: vi.fn<IntegrationAdapter['send']>().mockResolvedValue(res),
    receive: async () => ({}),
  };
}

beforeAll(async () => {
  dbReady = await canReachDatabase();
  // When a database IS configured (CI), the durable-persistence path MUST run — a
  // connection failure is a real failure, not a silent skip. Skipping is only allowed
  // locally when DATABASE_URL is unset; otherwise this test gave false comfort in CI.
  if (!dbReady && process.env.DATABASE_URL) {
    throw new Error(`DLQ e2e requires a reachable database (DATABASE_URL is set): ${skipReason}`);
  }
});
afterAll(async () => {
  if (dbReady) {
    await getSystemPool().query('delete from hr_platform.integration_dead_letters where error = $1', [marker]).catch(() => undefined);
  }
});

describe('integration dead-letter persistence (ARCH-8)', () => {
  it('persists an exhausted send to hr_platform.integration_dead_letters', async () => {
    if (!dbReady) { console.warn(`[dlq.e2e] skipped: ${skipReason}`); return; }
    const orchestrator = new IntegrationOrchestrator(new IntegrationHealthService());
    orchestrator.registerAdapter(failingAdapter(marker));

    await expect(orchestrator.send('retry-adapter', { op: marker })).rejects.toThrow(marker);

    // The durable write is best-effort/async; poll until it lands.
    let found: unknown[] = [];
    for (let i = 0; i < 20 && found.length === 0; i++) {
      const rows = await getSystemPool().query(
        'select adapter_name, attempt, error, payload from hr_platform.integration_dead_letters where error = $1',
        [marker],
      );
      found = rows.rows;
      if (found.length === 0) await new Promise((r) => setTimeout(r, 100));
    }
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ adapter_name: 'retry-adapter', attempt: 1, error: marker });

    // And it is visible via the durable API.
    const persisted = await orchestrator.getPersistedDeadLetters(10);
    expect(persisted.some((e) => e.error === marker && e.adapterName === 'retry-adapter')).toBe(true);
  });
});
