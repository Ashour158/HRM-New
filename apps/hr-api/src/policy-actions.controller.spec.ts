import { describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import { PolicyActionsController } from './policy-actions.controller.js';
import type { FsmFramework } from './platform/workflow/fsm-framework.js';
import type { WorkerRepository } from './domains/hr-core/repositories/worker.repository.js';
import type { HcmSetupService } from './domains/hcm-setup/hcm-setup.service.js';

describe('PolicyActionsController', () => {
  const fsm = {
    getAllowedActionsFromState: vi.fn(() => []),
  } as unknown as FsmFramework;
  const workerRepo = {
    findByIdForTenant: vi.fn(),
    findByEmailForTenant: vi.fn(),
  } as unknown as WorkerRepository;
  const hcmSetup = {
    getSetup: vi.fn(async () => ({})),
  } as unknown as Pick<HcmSetupService, 'getSetup'>;

  const controller = new PolicyActionsController(fsm, workerRepo, hcmSetup);

  function requestFor(role: string, overrides: Partial<Request['actor']> = {}): Request {
    return {
      tenantId: '00000000-0000-0000-0000-000000000001',
      actor: {
        actorType: 'USER',
        actorId: new Uuid('00000000-0000-0000-0000-000000000010'),
        roles: [role],
        permissions: [],
        mfaAuthenticated: true,
        ...overrides,
      },
    } as unknown as Request;
  }

  it('returns fallback allowed actions for absence requests', async () => {
    const actions = await controller.getAllowedActions('ABSENCE', 'DRAFT', undefined, undefined, requestFor('EMPLOYEE'));

    expect(actions).toEqual([
      expect.objectContaining({
        action: 'SUBMIT_REQUEST',
        label: 'Submit Leave Request',
      }),
    ]);
  });

  it('returns useful fallback actions for benefits and organization modules without FSM state', async () => {
    await expect(controller.getAllowedActions('BENEFITS_PROGRAM', undefined, undefined, undefined, requestFor('HR_ADMIN'))).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'CREATE_PROGRAM', label: 'Create Program' }),
      expect.objectContaining({ action: 'ACTIVATE', label: 'Activate' }),
    ]));
    await expect(controller.getAllowedActions('ORG_UNIT', undefined, undefined, undefined, requestFor('HR_ADMIN'))).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'CREATE_UNIT', label: 'Create Unit' }),
      expect.objectContaining({ action: 'ASSIGN_MANAGER', label: 'Assign Manager' }),
    ]));
  });

  it('formats backend FSM actions as readable labels', async () => {
    vi.mocked(fsm.getAllowedActionsFromState).mockReturnValueOnce(['ActivateWorker']);

    await expect(controller.getAllowedActions('WORKER_PROFILE', 'DRAFT', undefined, undefined, requestFor('HR_ADMIN'))).resolves.toEqual([
      expect.objectContaining({ action: 'ActivateWorker', label: 'Activate Worker' }),
    ]);
  });

  it('does not expose HR organization actions to employee sessions', async () => {
    await expect(controller.getAllowedActions('ORG_UNIT', undefined, undefined, undefined, requestFor('EMPLOYEE'))).resolves.toEqual([]);
  });

  it('applies runtime allowed-action policy overrides from the Policy Center snapshot', async () => {
    vi.mocked(hcmSetup.getSetup).mockResolvedValueOnce({
      policyGovernance: {
        allowedActionOverrides: [
          {
            id: 'block-absence-submit',
            active: true,
            aggregateType: 'ABSENCE',
            action: 'SUBMIT_REQUEST',
            roles: ['EMPLOYEE'],
            effect: 'HIDE',
            reason: 'Self-service leave submission is paused for this department.',
            scope: { departmentIds: ['dept-a'] },
          },
        ],
        fieldAccessOverrides: [],
      },
    } as never);

    const actions = await controller.getAllowedActions(
      'ABSENCE',
      undefined,
      undefined,
      undefined,
      requestFor('EMPLOYEE', { departmentIds: ['dept-a'] } as never),
    );

    expect(actions).toEqual([]);
  });

  it('applies runtime field-access policy overrides from the Policy Center snapshot', async () => {
    vi.mocked(hcmSetup.getSetup).mockResolvedValueOnce({
      policyGovernance: {
        allowedActionOverrides: [],
        fieldAccessOverrides: [
          {
            id: 'hide-manager-salary',
            active: true,
            resourceType: 'worker',
            fieldPath: 'worker.compensation.salary',
            roles: ['MANAGER'],
            decision: 'HIDDEN',
            reason: 'Salary visibility is blocked by compensation governance policy.',
          },
        ],
      },
    } as never);

    const result = await controller.getFieldAccess(
      'worker.compensation.salary',
      'worker',
      '00000000-0000-0000-0000-000000000012',
      'HIGH_SENSITIVITY',
      requestFor('MANAGER'),
    );

    expect(result).toEqual({
      fieldPath: 'worker.compensation.salary',
      decision: 'HIDDEN',
      maskingRule: undefined,
      reason: 'Salary visibility is blocked by compensation governance policy.',
    });
  });

  it('evaluates field-level access from the canonical policy engine', async () => {
    const result = await controller.getFieldAccess(
      'worker.compensation.salary',
      'worker',
      '00000000-0000-0000-0000-000000000012',
      'HIGH_SENSITIVITY',
      requestFor('MANAGER'),
    );

    expect(result).toEqual({
      fieldPath: 'worker.compensation.salary',
      decision: 'MASKED',
      maskingRule: 'SHOW_RANGE',
      reason: 'Field access policy evaluated for worker.compensation.salary on worker.',
    });
  });

  it('resolves employee self field access by tenant-scoped email when actor id is not the worker id', async () => {
    const workerId = new Uuid('00000000-0000-0000-0000-000000000012');
    vi.mocked(workerRepo.findByIdForTenant).mockResolvedValue(undefined);
    vi.mocked(workerRepo.findByEmailForTenant).mockResolvedValue({ id: workerId } as never);

    const result = await controller.getFieldAccess(
      'worker.compensation.salary',
      'worker',
      workerId.value,
      'HIGH_SENSITIVITY',
      requestFor('EMPLOYEE', { email: 'employee@example.com' }),
    );

    expect(workerRepo.findByEmailForTenant).toHaveBeenCalledWith(
      'employee@example.com',
      new Uuid('00000000-0000-0000-0000-000000000001'),
    );
    expect(result.decision).toBe('VISIBLE');
  });
});
