import { describe, expect, it, vi } from 'vitest';
import { createReadinessMetadata } from './readiness.js';
import { IntegrationHealthService } from './integration-health.service.js';
import { IntegrationOrchestrator } from './integration-orchestrator.service.js';
import type { IntegrationAdapter, IntegrationResult } from './types.js';

function result(success: boolean, error?: string, retryable = true): IntegrationResult {
  return {
    success,
    adapterName: 'retry-adapter',
    operationId: crypto.randomUUID(),
    timestamp: new Date(),
    error,
    details: { retryable },
  };
}

function makeAdapter(send: IntegrationAdapter['send'], retryOverrides: Partial<IntegrationAdapter['readiness']['retryPolicy']> = {}): IntegrationAdapter {
  return {
    name: 'retry-adapter',
    direction: 'OUTBOUND',
    readiness: createReadinessMetadata({
      ownerTeam: 'Test',
      ownerContact: 'test@example.com',
      sandboxEndpointRef: 'env:TEST_SANDBOX_ENDPOINT',
      productionEndpointRef: 'env:TEST_PRODUCTION_ENDPOINT',
      credentialRefBase: 'env:TEST_TOKEN',
      credentialState: 'CONFIGURED',
      retryPolicy: {
        maxAttempts: 3,
        deadLetterAfterAttempts: 3,
        initialDelayMs: 0,
        maxDelayMs: 0,
        ...retryOverrides,
      },
    }),
    healthCheck: async () => true,
    send,
    receive: async () => ({}),
  };
}

describe('IntegrationOrchestrator retry and dead-letter handling', () => {
  it('retries retryable adapter failures until a later attempt succeeds', async () => {
    const send = vi
      .fn<IntegrationAdapter['send']>()
      .mockResolvedValueOnce(result(false, 'temporary failure'))
      .mockResolvedValueOnce(result(true));
    const health = new IntegrationHealthService();
    const orchestrator = new IntegrationOrchestrator(health);
    orchestrator.registerAdapter(makeAdapter(send, { maxAttempts: 2, deadLetterAfterAttempts: 2 }));

    const response = await orchestrator.send('retry-adapter', { operation: 'sync' });

    expect(response.success).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
    expect(orchestrator.getDeadLetters()).toHaveLength(0);
  });

  it('records exhausted retryable failures in the in-memory dead-letter queue', async () => {
    const send = vi.fn<IntegrationAdapter['send']>().mockResolvedValue(result(false, 'provider down'));
    const health = new IntegrationHealthService();
    const orchestrator = new IntegrationOrchestrator(health);
    orchestrator.registerAdapter(makeAdapter(send, { maxAttempts: 2, deadLetterAfterAttempts: 2 }));

    await expect(orchestrator.send('retry-adapter', { operation: 'sync' })).rejects.toThrow('provider down');

    expect(send).toHaveBeenCalledTimes(2);
    expect(orchestrator.getDeadLetters()).toEqual([
      expect.objectContaining({
        adapterName: 'retry-adapter',
        attempt: 2,
        error: 'provider down',
        payload: { operation: 'sync' },
      }),
    ]);
  });

  it('does not retry non-retryable adapter failures', async () => {
    const send = vi.fn<IntegrationAdapter['send']>().mockResolvedValue(result(false, 'bad mapping', false));
    const health = new IntegrationHealthService();
    const orchestrator = new IntegrationOrchestrator(health);
    orchestrator.registerAdapter(makeAdapter(send));

    await expect(orchestrator.send('retry-adapter', { operation: 'sync' })).rejects.toThrow('bad mapping');

    expect(send).toHaveBeenCalledTimes(1);
    expect(orchestrator.getDeadLetters()).toHaveLength(0);
  });
});
