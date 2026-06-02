import { describe, expect, it, vi } from 'vitest';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid, Email } from '@hcm/shared-kernel';
import { WorkerProfile } from '../aggregates/worker-profile.aggregate.js';
import { EmploymentRelationship } from '../aggregates/employment-relationship.aggregate.js';
import { EmploymentContract } from '../aggregates/employment-contract.aggregate.js';
import { PersonalDataRecord } from '../aggregates/personal-data-record.aggregate.js';
import { JobAssignment } from '../aggregates/job-assignment.aggregate.js';
import { SuspendWorkerHandler } from './suspend-worker.handler.js';
import { ReinstateWorkerHandler } from './reinstate-worker.handler.js';
import { RehireWorkerHandler } from './rehire-worker.handler.js';
import { CreateJobAssignmentHandler } from './create-job-assignment.handler.js';
import { CreateEmploymentRelationshipHandler } from './create-employment-relationship.handler.js';
import { ActivateEmploymentRelationshipHandler } from './activate-employment-relationship.handler.js';
import { EndEmploymentRelationshipHandler } from './end-employment-relationship.handler.js';
import { CreateEmploymentContractHandler } from './create-employment-contract.handler.js';
import { SignEmploymentContractHandler } from './sign-employment-contract.handler.js';
import { UpsertWorkerProfileSectionHandler } from './upsert-worker-profile-section.handler.js';

const tenantId = new Uuid('550e8400-e29b-41d4-a716-446655440001');
const workerId = new Uuid('550e8400-e29b-41d4-a716-446655440002');
const actorId = new Uuid('550e8400-e29b-41d4-a716-446655440003');

function command<TPayload>(
  commandName: string,
  aggregateType: string,
  payload: TPayload,
  options: Partial<HrCommandEnvelope<TPayload>> = {},
): HrCommandEnvelope<TPayload> {
  return {
    commandId: Uuid.generate(),
    commandName,
    commandSchemaVersion: 1,
    tenantId,
    actor: {
      actorType: 'USER',
      actorId,
      roles: ['HR_ADMIN'],
      permissions: ['*'],
      mfaAuthenticated: true,
    },
    aggregateType,
    aggregateId: options.aggregateId,
    expectedState: options.expectedState,
    expectedVersion: options.expectedVersion,
    subjectWorkerId: options.subjectWorkerId,
    effectiveDate: options.effectiveDate,
    idempotencyKey: 'test-key',
    correlationId: Uuid.generate(),
    reason: 'test',
    payload,
    metadata: {
      requestHash: 'hash',
      clientType: 'HR_ADMIN',
    },
  };
}

function worker(status: WorkerProfile['status']): WorkerProfile {
  return new WorkerProfile({
    id: workerId,
    tenantId,
    employeeNumber: 'EMP-001',
    status,
    firstName: 'Amina',
    lastName: 'Nour',
    email: new Email('amina.nour@example.com'),
    hireDate: new Date('2024-01-01'),
    employmentType: 'FULL_TIME',
  });
}

describe('Core HR command handlers', () => {
  const fsm = { getAllowedActionsFromState: vi.fn(() => ['NextAction']) };
  const eventPublisher = { publishFromAggregate: vi.fn() };

  it('suspends, reinstates, and rehires worker lifecycle commands', async () => {
    const workerRepo = { findByIdForTenant: vi.fn(), save: vi.fn() };

    workerRepo.findByIdForTenant.mockResolvedValueOnce(worker('ACTIVE'));
    const suspend = await new SuspendWorkerHandler(workerRepo as never, fsm as never, eventPublisher as never).handle(
      command('SuspendWorker', 'WorkerProfile', { workerId, reason: 'Investigation' }, { aggregateId: workerId }),
    );
    expect(suspend).toMatchObject({
      success: true,
      data: { workerId: workerId.value, status: 'SUSPENDED' },
      eventsEmitted: ['WorkerSuspended'],
    });

    workerRepo.findByIdForTenant.mockResolvedValueOnce(worker('SUSPENDED'));
    const reinstate = await new ReinstateWorkerHandler(workerRepo as never, fsm as never, eventPublisher as never).handle(
      command('ReinstateWorker', 'WorkerProfile', { workerId }, { aggregateId: workerId }),
    );
    expect(reinstate).toMatchObject({
      success: true,
      data: { workerId: workerId.value, status: 'ACTIVE' },
      eventsEmitted: ['WorkerReinstated'],
    });

    workerRepo.findByIdForTenant.mockResolvedValueOnce(worker('TERMINATED'));
    const rehire = await new RehireWorkerHandler(workerRepo as never, fsm as never, eventPublisher as never).handle(
      command('RehireWorker', 'WorkerProfile', { workerId }, { aggregateId: workerId }),
    );
    expect(rehire).toMatchObject({
      success: true,
      data: { workerId: workerId.value, status: 'REHIRED' },
      eventsEmitted: ['WorkerRehired'],
    });

    expect(workerRepo.save).toHaveBeenCalledTimes(3);
    expect(eventPublisher.publishFromAggregate).toHaveBeenCalledTimes(3);
  });

  it('creates, activates, and ends employment relationships', async () => {
    const relationshipId = new Uuid('550e8400-e29b-41d4-a716-446655440004');
    const workerRepo = { findByIdForTenant: vi.fn().mockResolvedValue(worker('ACTIVE')) };
    const relationshipRepo = { findById: vi.fn(), save: vi.fn() };

    const created = await new CreateEmploymentRelationshipHandler(
      workerRepo as never,
      relationshipRepo as never,
      fsm as never,
    ).handle(command('CreateEmploymentRelationship', 'EmploymentRelationship', {
      relationshipId,
      workerId,
      relationshipType: 'EMPLOYEE',
      startDate: new Date('2024-01-01'),
    }));
    expect(created).toMatchObject({
      success: true,
      data: { relationshipId: relationshipId.value, state: 'DRAFT' },
      eventsEmitted: ['EmploymentRelationshipCreated'],
    });

    relationshipRepo.findById.mockResolvedValueOnce(new EmploymentRelationship({
      id: relationshipId,
      tenantId,
      workerId,
      relationshipType: 'EMPLOYEE',
      startDate: new Date('2024-01-01'),
      state: 'DRAFT',
    }));
    const activated = await new ActivateEmploymentRelationshipHandler(relationshipRepo as never, fsm as never).handle(
      command('ActivateEmploymentRelationship', 'EmploymentRelationship', { relationshipId }, { aggregateId: relationshipId }),
    );
    expect(activated).toMatchObject({
      success: true,
      data: { relationshipId: relationshipId.value, state: 'ACTIVE' },
      eventsEmitted: ['EmploymentRelationshipActivated'],
    });

    relationshipRepo.findById.mockResolvedValueOnce(new EmploymentRelationship({
      id: relationshipId,
      tenantId,
      workerId,
      relationshipType: 'EMPLOYEE',
      startDate: new Date('2024-01-01'),
      state: 'ACTIVE',
    }));
    const ended = await new EndEmploymentRelationshipHandler(relationshipRepo as never, fsm as never).handle(
      command('EndEmploymentRelationship', 'EmploymentRelationship', {
        relationshipId,
        endDate: new Date('2024-12-31'),
        reason: 'Transfer',
      }, { aggregateId: relationshipId }),
    );
    expect(ended).toMatchObject({
      success: true,
      data: { relationshipId: relationshipId.value, state: 'ENDED' },
      eventsEmitted: ['EmploymentRelationshipEnded'],
    });
  });

  it('creates job assignments only after tenant-scoped active assignment checks', async () => {
    const assignmentId = new Uuid('550e8400-e29b-41d4-a716-446655440007');
    const positionId = new Uuid('550e8400-e29b-41d4-a716-446655440008');
    const workerRepo = { findByIdForTenant: vi.fn().mockResolvedValue(worker('ACTIVE')) };
    const jobAssignmentRepo = { findActiveForWorkerForTenant: vi.fn(), save: vi.fn() };

    const created = await new CreateJobAssignmentHandler(
      workerRepo as never,
      jobAssignmentRepo as never,
      fsm as never,
    ).handle(command('CreateJobAssignment', 'JobAssignment', {
      assignmentId,
      workerId,
      positionId,
      startDate: new Date('2024-01-01'),
    }));

    expect(jobAssignmentRepo.findActiveForWorkerForTenant).toHaveBeenCalledWith(workerId, tenantId);
    expect(created).toMatchObject({
      success: true,
      data: { assignmentId: assignmentId.value },
      eventsEmitted: ['JobAssignmentCreated'],
    });

    jobAssignmentRepo.findActiveForWorkerForTenant.mockResolvedValueOnce(new JobAssignment({
      id: assignmentId,
      tenantId,
      workerId,
      positionId,
      startDate: new Date('2024-01-01'),
      assignmentType: 'PRIMARY',
      state: 'ACTIVE',
    }));

    await expect(new CreateJobAssignmentHandler(
      workerRepo as never,
      jobAssignmentRepo as never,
      fsm as never,
    ).handle(command('CreateJobAssignment', 'JobAssignment', {
      assignmentId,
      workerId,
      positionId,
      startDate: new Date('2024-02-01'),
    }))).rejects.toThrow('Worker already has an active primary job assignment');
  });

  it('creates a draft contract and safely offers before signing a draft contract', async () => {
    const contractId = new Uuid('550e8400-e29b-41d4-a716-446655440005');
    const workerRepo = { findByIdForTenant: vi.fn().mockResolvedValue(worker('ACTIVE')) };
    const contractRepo = { findById: vi.fn(), save: vi.fn() };

    const created = await new CreateEmploymentContractHandler(workerRepo as never, contractRepo as never, fsm as never).handle(
      command('CreateEmploymentContract', 'EmploymentContract', {
        contractId,
        workerId,
        contractType: 'FULL_TIME',
        startDate: new Date('2024-01-01'),
      }),
    );
    expect(created).toMatchObject({
      success: true,
      data: { contractId: contractId.value, state: 'DRAFT' },
      eventsEmitted: ['EmploymentContractCreated'],
    });

    contractRepo.findById.mockResolvedValueOnce(new EmploymentContract({
      id: contractId,
      tenantId,
      workerId,
      contractType: 'FULL_TIME',
      startDate: new Date('2024-01-01'),
      state: 'DRAFT',
    }));
    const signed = await new SignEmploymentContractHandler(contractRepo as never, fsm as never).handle(
      command('SignEmploymentContract', 'EmploymentContract', {
        contractId,
        signedAt: new Date('2024-01-02'),
      }, { aggregateId: contractId }),
    );
    expect(signed).toMatchObject({
      success: true,
      data: { contractId: contractId.value, state: 'SIGNED' },
      eventsEmitted: ['EmploymentContractOffered', 'EmploymentContractSigned'],
    });
  });

  it('upserts generic profile sections including CUSTOM fields', async () => {
    const workerRepo = { findByIdForTenant: vi.fn().mockResolvedValue(worker('ACTIVE')) };
    const personalDataRepo = { findByWorkerAndCategoryForTenant: vi.fn(), save: vi.fn() };

    const created = await new UpsertWorkerProfileSectionHandler(
      workerRepo as never,
      personalDataRepo as never,
      fsm as never,
    ).handle(command('UpsertWorkerProfileSection', 'WorkerProfile', {
      workerId,
      dataCategory: 'CUSTOM',
      fields: {
        localUnionCode: 'EG-CUSTOM-1',
        healthCardExpiryDate: '2026-06-20',
      },
    }, { aggregateId: workerId }));
    expect(created).toMatchObject({
      success: true,
      data: { workerId: workerId.value, dataCategory: 'CUSTOM' },
      eventsEmitted: ['PersonalDataRecordCreated', 'PersonalDataRecordActivated'],
    });

    personalDataRepo.findByWorkerAndCategoryForTenant.mockResolvedValueOnce(new PersonalDataRecord({
      id: new Uuid('550e8400-e29b-41d4-a716-446655440006'),
      tenantId,
      workerId,
      dataCategory: 'CUSTOM',
      dataClassification: 'CONFIDENTIAL',
      payload: { localUnionCode: 'OLD' },
      consentStatus: 'GRANTED',
      state: 'ACTIVE',
    }));
    const updated = await new UpsertWorkerProfileSectionHandler(
      workerRepo as never,
      personalDataRepo as never,
      fsm as never,
    ).handle(command('UpsertWorkerProfileSection', 'WorkerProfile', {
      workerId,
      dataCategory: 'CUSTOM',
      fields: { localUnionCode: 'EG-CUSTOM-2' },
    }, { aggregateId: workerId }));
    expect(updated).toMatchObject({
      success: true,
      eventsEmitted: ['PersonalDataRecordUpdated'],
    });
  });
});
