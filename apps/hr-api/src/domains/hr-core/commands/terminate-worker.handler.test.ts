import { describe, expect, it, vi } from 'vitest';
import { TerminateWorkerHandler } from './terminate-worker.handler.js';
import type { WorkerRepository } from '../repositories/worker.repository.js';
import type { JobAssignmentRepository } from '../repositories/job-assignment.repository.js';
import type { EmploymentRelationshipRepository } from '../repositories/employment-relationship.repository.js';
import type { WorkerEventsPublisher } from '../events/worker-events.publisher.js';
import type { WorksCouncilConsultationGuard } from '../../global-hr/services/works-council-consultation-guard.service.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid, ConflictError } from '@hcm/shared-kernel';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const workerId = new Uuid('550e8400-e29b-41d4-a716-446655440001');
const legalEntityId = new Uuid('00000000-0000-0000-0000-000000000100');

function command(): HrCommandEnvelope<unknown> {
  return {
    payload: { workerId, terminationDate: new Date('2026-08-01T00:00:00.000Z'), reason: 'Reduction in force' },
    tenantId,
    correlationId: Uuid.generate(),
    commandId: Uuid.generate(),
  } as unknown as HrCommandEnvelope<unknown>;
}

function makeWorker(overrides: { legalEntityId?: Uuid } = {}) {
  return {
    id: workerId,
    status: 'TERMINATED',
    aggregateVersion: 3,
    domainEvents: [{ eventName: 'WorkerTerminated' }],
    legalEntityId: overrides.legalEntityId,
    terminate: vi.fn(),
  };
}

function emptyRepos() {
  const jobAssignmentRepo = {
    findByWorkerForTenant: vi.fn().mockResolvedValue([]),
    save: vi.fn(),
  } as unknown as JobAssignmentRepository;
  const employmentRelationshipRepo = {
    findByWorkerForTenant: vi.fn().mockResolvedValue([]),
    save: vi.fn(),
  } as unknown as EmploymentRelationshipRepository;
  return { jobAssignmentRepo, employmentRelationshipRepo };
}

function fsm() {
  return { getAllowedActionsFromState: vi.fn(() => []) } as unknown as FsmFramework;
}

function eventPublisher() {
  return { publishFromAggregate: vi.fn().mockResolvedValue(undefined) } as unknown as WorkerEventsPublisher;
}

describe('TerminateWorkerHandler', () => {
  it('blocks termination when the worker legal entity has an incomplete works-council consultation', async () => {
    const worker = makeWorker({ legalEntityId });
    const workerRepo = { findByIdForTenant: vi.fn().mockResolvedValue(worker), save: vi.fn() } as unknown as WorkerRepository;
    const { jobAssignmentRepo, employmentRelationshipRepo } = emptyRepos();
    const guard = {
      assertNotBlocked: vi.fn().mockRejectedValue(new ConflictError('blocked')),
    } as unknown as WorksCouncilConsultationGuard;

    const handler = new TerminateWorkerHandler(
      workerRepo,
      jobAssignmentRepo,
      employmentRelationshipRepo,
      fsm(),
      eventPublisher(),
      guard,
    );

    await expect(handler.handle(command())).rejects.toBeInstanceOf(ConflictError);
    expect(worker.terminate).not.toHaveBeenCalled();
    expect(workerRepo.save).not.toHaveBeenCalled();
  });

  it('terminates the worker once the consultation has completed (guard passes)', async () => {
    const worker = makeWorker({ legalEntityId });
    const workerRepo = { findByIdForTenant: vi.fn().mockResolvedValue(worker), save: vi.fn() } as unknown as WorkerRepository;
    const { jobAssignmentRepo, employmentRelationshipRepo } = emptyRepos();
    const guard = { assertNotBlocked: vi.fn().mockResolvedValue(undefined) } as unknown as WorksCouncilConsultationGuard;

    const handler = new TerminateWorkerHandler(
      workerRepo,
      jobAssignmentRepo,
      employmentRelationshipRepo,
      fsm(),
      eventPublisher(),
      guard,
    );
    const result = await handler.handle(command());

    expect(result.success).toBe(true);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(workerRepo.save).toHaveBeenCalledWith(worker);
    expect(guard.assertNotBlocked).toHaveBeenCalledWith(legalEntityId, tenantId, 'terminate worker');
  });

  it('succeeds normally when the worker has no legal entity on file (guard not scoped, not consulted)', async () => {
    const worker = makeWorker();
    const workerRepo = { findByIdForTenant: vi.fn().mockResolvedValue(worker), save: vi.fn() } as unknown as WorkerRepository;
    const { jobAssignmentRepo, employmentRelationshipRepo } = emptyRepos();
    const guard = { assertNotBlocked: vi.fn() } as unknown as WorksCouncilConsultationGuard;

    const handler = new TerminateWorkerHandler(
      workerRepo,
      jobAssignmentRepo,
      employmentRelationshipRepo,
      fsm(),
      eventPublisher(),
      guard,
    );
    const result = await handler.handle(command());

    expect(result.success).toBe(true);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(guard.assertNotBlocked).not.toHaveBeenCalled();
  });
});
