import { describe, expect, it, vi } from 'vitest';
import { WorksCouncilConsultationGuard } from './works-council-consultation-guard.service.js';
import type { WorksCouncilConsultationRepository } from '../repositories/works-council-consultation.repository.js';
import { WorksCouncilConsultation } from '../aggregates/works-council-consultation.aggregate.js';
import { Uuid, ConflictError } from '@hcm/shared-kernel';

describe('WorksCouncilConsultationGuard', () => {
  const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
  const otherTenantId = new Uuid('00000000-0000-0000-0000-000000000099');
  const legalEntityId = new Uuid('00000000-0000-0000-0000-000000000100');

  const makeConsultation = (
    status: WorksCouncilConsultation['status'],
    owningTenantId: Uuid = tenantId,
  ) =>
    new WorksCouncilConsultation({
      id: Uuid.generate(),
      tenantId: owningTenantId,
      countryCode: 'DE',
      legalEntityId,
      actionType: 'RESTRUCTURING',
      consultationType: 'INFORMATION_AND_CONSULTATION',
      status,
      aggregateVersion: 1,
    });

  it('throws ConflictError when the legal entity has a REQUIRED consultation', async () => {
    const repo = {
      findBlockingByLegalEntity: vi.fn().mockResolvedValue([makeConsultation('REQUIRED')]),
    } as unknown as WorksCouncilConsultationRepository;
    const guard = new WorksCouncilConsultationGuard(repo);

    await expect(guard.assertNotBlocked(legalEntityId, tenantId, 'restructure org unit')).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(await guard.isBlocked(legalEntityId, tenantId)).toBe(true);
  });

  it('throws ConflictError when the legal entity has an INITIATED or IN_PROGRESS consultation', async () => {
    const repo = {
      findBlockingByLegalEntity: vi.fn().mockResolvedValue([makeConsultation('IN_PROGRESS')]),
    } as unknown as WorksCouncilConsultationRepository;
    const guard = new WorksCouncilConsultationGuard(repo);

    await expect(guard.assertNotBlocked(legalEntityId, tenantId, 'terminate worker')).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('passes once the consultation is completed (repository no longer returns it as blocking)', async () => {
    // findBlockingByLegalEntity only ever returns REQUIRED/INITIATED/IN_PROGRESS rows,
    // so a completed consultation is naturally absent from its result set.
    const repo = {
      findBlockingByLegalEntity: vi.fn().mockResolvedValue([]),
    } as unknown as WorksCouncilConsultationRepository;
    const guard = new WorksCouncilConsultationGuard(repo);

    await expect(guard.assertNotBlocked(legalEntityId, tenantId, 'restructure org unit')).resolves.toBeUndefined();
    expect(await guard.isBlocked(legalEntityId, tenantId)).toBe(false);
  });

  it('passes when no consultation exists at all for the legal entity', async () => {
    const repo = {
      findBlockingByLegalEntity: vi.fn().mockResolvedValue([]),
    } as unknown as WorksCouncilConsultationRepository;
    const guard = new WorksCouncilConsultationGuard(repo);

    await expect(guard.assertNotBlocked(legalEntityId, tenantId, 'terminate worker')).resolves.toBeUndefined();
  });

  it('ignores blocking rows that belong to a different tenant', async () => {
    const repo = {
      findBlockingByLegalEntity: vi.fn().mockResolvedValue([makeConsultation('REQUIRED', otherTenantId)]),
    } as unknown as WorksCouncilConsultationRepository;
    const guard = new WorksCouncilConsultationGuard(repo);

    await expect(guard.assertNotBlocked(legalEntityId, tenantId, 'restructure org unit')).resolves.toBeUndefined();
    expect(await guard.isBlocked(legalEntityId, tenantId)).toBe(false);
  });
});
