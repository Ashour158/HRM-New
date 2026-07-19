/**
 * Coverage for the previously-missing EmploymentContract lifecycle handlers
 * (activate / terminate / expire) and the JobAssignment update handler.
 *
 * `EmploymentContract.activate()/expire()/terminate()` and
 * `JobAssignment.update()` already existed on the aggregates (and
 * `EmploymentContractActivated/Expired/Terminated` / `JobAssignmentUpdated`
 * already existed as FSM-registered actions/events) but had no command
 * handler wired up, so they were dead code reachable only from unit tests
 * directly calling the aggregate method. These tests exercise the new
 * handlers end-to-end (payload -> aggregate mutation -> eventsEmitted).
 */
import { describe, expect, it, vi } from 'vitest';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { EmploymentContract } from '../aggregates/employment-contract.aggregate.js';
import { JobAssignment } from '../aggregates/job-assignment.aggregate.js';
import { ActivateEmploymentContractHandler } from './activate-employment-contract.handler.js';
import { ExpireEmploymentContractHandler } from './expire-employment-contract.handler.js';
import { TerminateEmploymentContractHandler } from './terminate-employment-contract.handler.js';
import { UpdateJobAssignmentHandler } from './update-job-assignment.handler.js';

const tenantId = new Uuid('550e8400-e29b-41d4-a716-446655440001');
const workerId = new Uuid('550e8400-e29b-41d4-a716-446655440002');
const actorId = new Uuid('550e8400-e29b-41d4-a716-446655440003');
const contractId = new Uuid('550e8400-e29b-41d4-a716-446655440005');
const assignmentId = new Uuid('550e8400-e29b-41d4-a716-446655440007');

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

function contract(state: EmploymentContract['state']): EmploymentContract {
  return new EmploymentContract({
    id: contractId,
    tenantId,
    workerId,
    contractType: 'FULL_TIME',
    startDate: new Date('2024-01-01'),
    state,
  });
}

function assignment(state: JobAssignment['state']): JobAssignment {
  return new JobAssignment({
    id: assignmentId,
    tenantId,
    workerId,
    startDate: new Date('2024-01-01'),
    assignmentType: 'PRIMARY',
    state,
  });
}

const fsm = { getAllowedActionsFromState: vi.fn(() => ['NextAction']) };

describe('ActivateEmploymentContractHandler', () => {
  it('activates a SIGNED contract', async () => {
    const contractRepo = { findById: vi.fn().mockResolvedValue(contract('SIGNED')), save: vi.fn() };
    const result = await new ActivateEmploymentContractHandler(contractRepo as never, fsm as never).handle(
      command('ActivateEmploymentContract', 'EmploymentContract', { contractId }, { aggregateId: contractId }),
    );
    expect(result).toMatchObject({
      success: true,
      data: { contractId: contractId.value, state: 'ACTIVE' },
      eventsEmitted: ['EmploymentContractActivated'],
    });
    expect(contractRepo.save).toHaveBeenCalledTimes(1);
  });

  it('rejects activation of a DRAFT contract', async () => {
    const contractRepo = { findById: vi.fn().mockResolvedValue(contract('DRAFT')), save: vi.fn() };
    await expect(
      new ActivateEmploymentContractHandler(contractRepo as never, fsm as never).handle(
        command('ActivateEmploymentContract', 'EmploymentContract', { contractId }, { aggregateId: contractId }),
      ),
    ).rejects.toThrow('Cannot activate contract from state DRAFT');
    expect(contractRepo.save).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when the contract does not exist', async () => {
    const contractRepo = { findById: vi.fn().mockResolvedValue(undefined), save: vi.fn() };
    await expect(
      new ActivateEmploymentContractHandler(contractRepo as never, fsm as never).handle(
        command('ActivateEmploymentContract', 'EmploymentContract', { contractId }, { aggregateId: contractId }),
      ),
    ).rejects.toThrow('Contract not found');
  });
});

describe('ExpireEmploymentContractHandler', () => {
  it('expires an ACTIVE contract', async () => {
    const contractRepo = { findById: vi.fn().mockResolvedValue(contract('ACTIVE')), save: vi.fn() };
    const result = await new ExpireEmploymentContractHandler(contractRepo as never, fsm as never).handle(
      command('ExpireEmploymentContract', 'EmploymentContract', { contractId }, { aggregateId: contractId }),
    );
    expect(result).toMatchObject({
      success: true,
      data: { contractId: contractId.value, state: 'EXPIRED' },
      eventsEmitted: ['EmploymentContractExpired'],
    });
    expect(contractRepo.save).toHaveBeenCalledTimes(1);
  });

  it('rejects expiring a SIGNED (not yet active) contract', async () => {
    const contractRepo = { findById: vi.fn().mockResolvedValue(contract('SIGNED')), save: vi.fn() };
    await expect(
      new ExpireEmploymentContractHandler(contractRepo as never, fsm as never).handle(
        command('ExpireEmploymentContract', 'EmploymentContract', { contractId }, { aggregateId: contractId }),
      ),
    ).rejects.toThrow('Cannot expire contract from state SIGNED');
    expect(contractRepo.save).not.toHaveBeenCalled();
  });
});

describe('TerminateEmploymentContractHandler', () => {
  it('terminates an ACTIVE contract', async () => {
    const contractRepo = { findById: vi.fn().mockResolvedValue(contract('ACTIVE')), save: vi.fn() };
    const result = await new TerminateEmploymentContractHandler(contractRepo as never, fsm as never).handle(
      command(
        'TerminateEmploymentContract',
        'EmploymentContract',
        { contractId, terminationDate: new Date('2024-06-01'), reason: 'Redundancy' },
        { aggregateId: contractId },
      ),
    );
    expect(result).toMatchObject({
      success: true,
      data: { contractId: contractId.value, state: 'TERMINATED' },
      eventsEmitted: ['EmploymentContractTerminated'],
    });
    expect(contractRepo.save).toHaveBeenCalledTimes(1);
  });

  it('rejects terminating an already-EXPIRED contract', async () => {
    const contractRepo = { findById: vi.fn().mockResolvedValue(contract('EXPIRED')), save: vi.fn() };
    await expect(
      new TerminateEmploymentContractHandler(contractRepo as never, fsm as never).handle(
        command(
          'TerminateEmploymentContract',
          'EmploymentContract',
          { contractId, terminationDate: new Date('2024-06-01'), reason: 'Redundancy' },
          { aggregateId: contractId },
        ),
      ),
    ).rejects.toThrow('Cannot terminate contract from state EXPIRED');
    expect(contractRepo.save).not.toHaveBeenCalled();
  });
});

describe('UpdateJobAssignmentHandler', () => {
  it('updates job title, department, and manager on a DRAFT assignment', async () => {
    const jobAssignmentRepo = { findById: vi.fn().mockResolvedValue(assignment('DRAFT')), save: vi.fn() };
    const newManagerId = Uuid.generate();
    const newDepartmentId = Uuid.generate();
    const result = await new UpdateJobAssignmentHandler(jobAssignmentRepo as never, fsm as never).handle(
      command(
        'UpdateJobAssignment',
        'JobAssignment',
        {
          assignmentId,
          jobTitle: 'Senior HR Operations Analyst',
          departmentId: newDepartmentId.value,
          managerId: newManagerId.value,
        },
        { aggregateId: assignmentId },
      ),
    );
    expect(result).toMatchObject({
      success: true,
      data: { assignmentId: assignmentId.value, status: 'DRAFT' },
      eventsEmitted: ['JobAssignmentUpdated'],
    });
    expect(jobAssignmentRepo.save).toHaveBeenCalledTimes(1);
    const [[savedAssignment]] = jobAssignmentRepo.save.mock.calls;
    expect((savedAssignment as JobAssignment).jobTitle).toBe('Senior HR Operations Analyst');
    expect((savedAssignment as JobAssignment).managerId?.value).toBe(newManagerId.value);
  });

  it('throws NotFoundError when the assignment does not exist', async () => {
    const jobAssignmentRepo = { findById: vi.fn().mockResolvedValue(undefined), save: vi.fn() };
    await expect(
      new UpdateJobAssignmentHandler(jobAssignmentRepo as never, fsm as never).handle(
        command('UpdateJobAssignment', 'JobAssignment', { assignmentId, jobTitle: 'X' }, { aggregateId: assignmentId }),
      ),
    ).rejects.toThrow('Job assignment not found');
    expect(jobAssignmentRepo.save).not.toHaveBeenCalled();
  });
});
