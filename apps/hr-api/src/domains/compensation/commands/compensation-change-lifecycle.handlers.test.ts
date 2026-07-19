import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { CompensationEventsPublisher } from '../events/compensation-events.publisher.js';
import { CompensationChange } from '../aggregates/compensation-change.aggregate.js';
import { CreateCompensationChangeHandler } from './create-compensation-change.handler.js';
import { SubmitCompensationChangeHandler } from './submit-compensation-change.handler.js';
import { ApproveCompensationChangeHandler } from './approve-compensation-change.handler.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actorId = new Uuid('00000000-0000-0000-0000-000000000002');
const commandId = new Uuid('00000000-0000-0000-0000-000000000003');
const correlationId = new Uuid('00000000-0000-0000-0000-000000000004');
const workerId = new Uuid('00000000-0000-0000-0000-000000000005');
const approverId = new Uuid('00000000-0000-0000-0000-000000000006');
const changeId = new Uuid('00000000-0000-0000-0000-000000000007');

function command(commandName: string, aggregateType: string, payload: unknown, aggregateId?: Uuid): HrCommandEnvelope<unknown> {
  return {
    commandId,
    commandName,
    commandSchemaVersion: 1,
    tenantId,
    actor: {
      actorType: 'USER',
      actorId,
      roles: ['COMPENSATION_ADMIN'],
      permissions: ['COMPENSATION_WRITE'],
      mfaAuthenticated: true,
    },
    aggregateType,
    aggregateId,
    idempotencyKey: `${commandName}-key`,
    correlationId,
    reason: 'compensation lifecycle test',
    payload,
    metadata: {
      requestHash: `${commandName}-hash`,
      clientType: 'HR_ADMIN',
      hrDataSensitivity: 'HIGH',
    },
  };
}

function change(status: CompensationChange['status']) {
  return new CompensationChange({
    id: changeId,
    tenantId,
    workerId,
    changeType: 'SALARY_ADJUSTMENT',
    oldAmount: 60000,
    newAmount: 75000,
    currency: 'USD',
    effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
    status,
    aggregateVersion: 1,
  });
}

describe('CompensationChange lifecycle command handlers', () => {
  it('creates a compensation change that starts in DRAFT', async () => {
    const repo = { save: vi.fn(async () => undefined) };
    const handler = new CreateCompensationChangeHandler(
      repo as never,
      new CompensationEventsPublisher(),
      { getAllowedActions: vi.fn(() => ['Submit', 'Cancel']) } as never,
    );

    const result = await handler.handle(command('CreateCompensationChange', 'CompensationChange', {
      changeId,
      workerId,
      changeType: 'SALARY_ADJUSTMENT',
      oldAmount: 60000,
      newAmount: 75000,
      currency: 'USD',
      effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
    }));

    const saved = repo.save.mock.calls[0]?.[0] as CompensationChange;
    expect(saved.status).toBe('DRAFT');
    expect(result).toEqual(expect.objectContaining({
      success: true,
      aggregateId: changeId,
      newState: 'DRAFT',
      eventsEmitted: [],
    }));
  });

  it('submitting a DRAFT change moves it to SUBMITTED, unblocking SendForApprovalCompensationChange', async () => {
    const existing = change('DRAFT');
    const repo = {
      findById: vi.fn(async () => existing),
      save: vi.fn(async () => undefined),
    };
    const handler = new SubmitCompensationChangeHandler(
      repo as never,
      new CompensationEventsPublisher(),
      { getAllowedActions: vi.fn(() => ['SendForApproval', 'Cancel']) } as never,
    );

    const result = await handler.handle(command('SubmitCompensationChange', 'CompensationChange', { changeId }, changeId));

    expect(repo.findById).toHaveBeenCalledWith(changeId);
    expect(repo.save).toHaveBeenCalledWith(existing);
    expect(existing.status).toBe('SUBMITTED');
    expect(result).toEqual(expect.objectContaining({
      success: true,
      newState: 'SUBMITTED',
      eventsEmitted: ['CompensationChangeSubmitted'],
    }));
    expect(result.data).toEqual(expect.objectContaining({
      changeId: changeId.value,
      status: 'SUBMITTED',
    }));
  });

  it('approves a change that has been submitted for approval', async () => {
    const existing = change('PENDING_APPROVAL');
    const repo = {
      findById: vi.fn(async () => existing),
      save: vi.fn(async () => undefined),
    };
    const handler = new ApproveCompensationChangeHandler(
      repo as never,
      new CompensationEventsPublisher(),
      { getAllowedActions: vi.fn(() => []) } as never,
    );

    const result = await handler.handle(command('ApproveCompensationChange', 'CompensationChange', {
      changeId,
      approvedBy: approverId,
    }, changeId));

    expect(existing.status).toBe('APPROVED');
    expect(existing.approvedBy?.value).toBe(approverId.value);
    expect(result).toEqual(expect.objectContaining({
      success: true,
      newState: 'APPROVED',
      eventsEmitted: ['CompensationChangeApproved'],
    }));
  });

  it('regression: approving directly from DRAFT still fails because it skips the approval-pending gate', async () => {
    const existing = change('DRAFT');
    const repo = {
      findById: vi.fn(async () => existing),
      save: vi.fn(async () => undefined),
    };
    const handler = new ApproveCompensationChangeHandler(
      repo as never,
      new CompensationEventsPublisher(),
      { getAllowedActions: vi.fn(() => []) } as never,
    );

    await expect(handler.handle(command('ApproveCompensationChange', 'CompensationChange', {
      changeId,
      approvedBy: approverId,
    }, changeId))).rejects.toThrow('Cannot approve CompensationChange from state DRAFT');

    expect(repo.save).not.toHaveBeenCalled();
    expect(existing.status).toBe('DRAFT');
  });

  it('regression: submitting a change that is not in DRAFT is rejected by the aggregate guard', async () => {
    const existing = change('PENDING_APPROVAL');
    const repo = {
      findById: vi.fn(async () => existing),
      save: vi.fn(async () => undefined),
    };
    const handler = new SubmitCompensationChangeHandler(
      repo as never,
      new CompensationEventsPublisher(),
      { getAllowedActions: vi.fn(() => []) } as never,
    );

    await expect(handler.handle(command('SubmitCompensationChange', 'CompensationChange', { changeId }, changeId)))
      .rejects.toThrow('Cannot submit CompensationChange from state PENDING_APPROVAL');

    expect(repo.save).not.toHaveBeenCalled();
  });
});
