import { describe, expect, it, vi } from 'vitest';
import { LegalHoldGuard } from './legal-hold-guard.service.js';
import type { LegalHoldRepository } from '../repositories/legal-hold.repository.js';
import { LegalHold } from '../aggregates/legal-hold.aggregate.js';
import { Uuid, ConflictError } from '@hcm/shared-kernel';

describe('LegalHoldGuard', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const workerId = new Uuid('550e8400-e29b-41d4-a716-446655440099');

  const makeHold = () =>
    LegalHold.create(
      {
        id: Uuid.generate(),
        tenantId,
        holdName: 'Litigation 2026',
        reason: 'pending litigation',
        affectedWorkerIds: [workerId],
        placedBy: Uuid.generate(),
      },
      Uuid.generate(),
    );

  it('throws ConflictError when an active hold covers the worker', async () => {
    const repo = {
      findActiveByWorkerForTenant: vi.fn().mockResolvedValue([makeHold()]),
    } as unknown as LegalHoldRepository;
    const guard = new LegalHoldGuard(repo);

    await expect(guard.assertNotUnderHold(workerId, tenantId, 'erase personal data')).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(await guard.isUnderHold(workerId, tenantId)).toBe(true);
  });

  it('passes when no active hold covers the worker', async () => {
    const repo = {
      findActiveByWorkerForTenant: vi.fn().mockResolvedValue([]),
    } as unknown as LegalHoldRepository;
    const guard = new LegalHoldGuard(repo);

    await expect(guard.assertNotUnderHold(workerId, tenantId, 'erase personal data')).resolves.toBeUndefined();
    expect(await guard.isUnderHold(workerId, tenantId)).toBe(false);
  });
});
