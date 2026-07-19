import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { ApprovalWorkflowRule } from '../../domains/hcm-setup/hcm-setup.types.js';
import { ApprovalChainController } from './approval-chain.controller.js';
import type { CommandBus } from '../command-bus/command-bus.js';
import type { HcmSetupService } from '../../domains/hcm-setup/hcm-setup.service.js';
import type { ApprovalWorkflowService } from './approval-workflow.service.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const actorId = '00000000-0000-0000-0000-000000000101';

function request(): Request {
  return {
    tenantId,
    actor: {
      actorType: 'USER',
      actorId: new Uuid(actorId),
      roles: ['HR_ADMIN'],
      permissions: ['WORKFLOW_MANAGE'],
      mfaAuthenticated: true,
      email: 'admin@example.com',
    },
  } as unknown as Request;
}

function baseRule(overrides: Partial<ApprovalWorkflowRule> = {}): ApprovalWorkflowRule {
  return {
    code: 'COMP_CHANGE_APPROVAL',
    label: 'Compensation change approval',
    active: true,
    commandName: 'ApproveCompensationChange',
    steps: [
      { code: 'HR_REVIEW', label: 'HR review', active: true, order: 1, mode: 'SEQUENTIAL', approverType: 'ROLE', approverRole: 'HR_ADMIN' },
    ],
    ...overrides,
  };
}

function buildController() {
  const hcmSetup = {
    updateSetup: vi.fn(async (_tenantId: Uuid, update: { approvalWorkflowRules?: ApprovalWorkflowRule[] }) => update),
  } as unknown as HcmSetupService;
  const controller = new ApprovalChainController(
    {} as unknown as CommandBus,
    hcmSetup,
    {} as unknown as ApprovalWorkflowService,
  );
  return { controller, hcmSetup };
}

describe('ApprovalChainController approval-config condition validation', () => {
  it('rejects a condition with a missing/blank field path', async () => {
    const { controller } = buildController();
    const rules = [baseRule({ conditions: [{ field: '   ', operator: 'EQUALS', value: 'x' }] })];

    await expect(controller.saveApprovalConfig({ rules }, request())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a condition with an unsupported operator', async () => {
    const { controller } = buildController();
    const rules = [baseRule({
      conditions: [{ field: 'newAnnualSalary', operator: 'STARTS_WITH' as never, value: 'x' }],
    })];

    await expect(controller.saveApprovalConfig({ rules }, request())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a condition with an undefined comparison value', async () => {
    const { controller } = buildController();
    const rules = [baseRule({
      conditions: [{ field: 'newAnnualSalary', operator: 'EQUALS', value: undefined }],
    })];

    await expect(controller.saveApprovalConfig({ rules }, request())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an unsupported conditionLogic value instead of silently defaulting to ALL', async () => {
    const { controller } = buildController();
    const rules = [baseRule({
      conditions: [{ field: 'newAnnualSalary', operator: 'EQUALS', value: 1 }],
      conditionLogic: 'XOR' as never,
    })];

    await expect(controller.saveApprovalConfig({ rules }, request())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts valid conditions and normalizes the field path/logic', async () => {
    const { controller, hcmSetup } = buildController();
    const rules = [baseRule({
      conditions: [{ field: '  newAnnualSalary  ', operator: 'GREATER_THAN', value: 10000 }],
    })];

    await controller.saveApprovalConfig({ rules }, request());

    expect(hcmSetup.updateSetup).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        approvalWorkflowRules: [
          expect.objectContaining({
            conditionLogic: 'ALL',
            conditions: [{ field: 'newAnnualSalary', operator: 'GREATER_THAN', value: 10000 }],
          }),
        ],
      }),
    );
  });
});
