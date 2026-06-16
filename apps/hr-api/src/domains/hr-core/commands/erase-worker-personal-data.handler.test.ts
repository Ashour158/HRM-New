import { describe, expect, it, vi } from 'vitest';
import { EraseWorkerPersonalDataHandler } from './erase-worker-personal-data.handler.js';
import type { WorkerRepository } from '../repositories/worker.repository.js';
import type { PersonalDataRecordRepository } from '../repositories/personal-data-record.repository.js';
import type { LegalHoldGuard } from '../../compliance/services/legal-hold-guard.service.js';
import { PersonalDataRecord } from '../aggregates/personal-data-record.aggregate.js';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid, ConflictError } from '@hcm/shared-kernel';

describe('EraseWorkerPersonalDataHandler', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const workerId = new Uuid('550e8400-e29b-41d4-a716-446655440001');

  const command = {
    payload: { workerId, requestedByWorkerId: Uuid.generate(), reason: 'GDPR request' },
    tenantId,
    correlationId: Uuid.generate(),
    commandId: Uuid.generate(),
  } as unknown as HrCommandEnvelope<unknown>;

  const makeRecord = () =>
    PersonalDataRecord.create(
      {
        id: Uuid.generate(),
        tenantId,
        workerId,
        dataCategory: 'BASIC',
        dataClassification: 'CONFIDENTIAL',
        payload: { phoneNumber: '555' },
        consentStatus: 'GRANTED',
        state: 'DRAFT',
      },
      command.correlationId,
    );

  it('blocks erasure when the worker is under an active legal hold', async () => {
    const workerRepo = { findByIdForTenant: vi.fn().mockResolvedValue({ aggregateVersion: 1 }) } as unknown as WorkerRepository;
    const personalDataRepo = { findByWorkerForTenant: vi.fn(), save: vi.fn() } as unknown as PersonalDataRecordRepository;
    const guard = {
      assertNotUnderHold: vi.fn().mockRejectedValue(new ConflictError('under hold')),
    } as unknown as LegalHoldGuard;

    const handler = new EraseWorkerPersonalDataHandler(workerRepo, personalDataRepo, guard);

    await expect(handler.handle(command)).rejects.toBeInstanceOf(ConflictError);
    expect(personalDataRepo.save).not.toHaveBeenCalled();
  });

  it('deletes all personal data records when no hold is active', async () => {
    const record = makeRecord();
    const workerRepo = { findByIdForTenant: vi.fn().mockResolvedValue({ aggregateVersion: 1 }) } as unknown as WorkerRepository;
    const personalDataRepo = {
      findByWorkerForTenant: vi.fn().mockResolvedValue([record]),
      save: vi.fn(),
    } as unknown as PersonalDataRecordRepository;
    const guard = { assertNotUnderHold: vi.fn().mockResolvedValue(undefined) } as unknown as LegalHoldGuard;

    const handler = new EraseWorkerPersonalDataHandler(workerRepo, personalDataRepo, guard);
    const result = await handler.handle(command);

    expect(result.success).toBe(true);
    expect(record.state).toBe('DELETED');
    expect(personalDataRepo.save).toHaveBeenCalledTimes(1);
    expect((result.data as { erasedCategories: string[] }).erasedCategories).toEqual(['BASIC']);
  });
});
