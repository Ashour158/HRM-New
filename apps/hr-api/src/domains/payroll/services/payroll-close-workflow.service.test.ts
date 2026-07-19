import { randomUUID } from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';
import { PayrollCloseWorkflowService, type PayrollWorkflowContext } from './payroll-close-workflow.service.js';

const TENANT_ID = new Uuid('00000000-0000-0000-0000-000000000001');

function actor(): HrActor {
  return {
    actorType: 'USER',
    actorId: new Uuid('550e8400-e29b-41d4-a716-446655440100'),
    roles: ['PAYROLL_ADMIN'],
    permissions: ['PAYROLL_MANAGE'],
    mfaAuthenticated: true,
  };
}

function buildContext(idempotencyNamespace: string): PayrollWorkflowContext {
  return { tenantId: TENANT_ID, actor: actor(), idempotencyNamespace };
}

function buildService() {
  const hcmSetupService = { getSetup: vi.fn(async () => ({ locations: [{ code: 'CAIRO_HQ', active: true, currency: 'EGP' }] })) };
  const workerRepo = { findByStatusForTenant: vi.fn(async () => []), searchForTenant: vi.fn(async () => []) };
  const payrollCycleRepo = { findById: vi.fn() };
  const calculationRunRepo = { findById: vi.fn() };
  const payrollInputRepo = { findById: vi.fn() };
  const resultLineRepo = { findById: vi.fn() };
  const commandBus = { execute: vi.fn() };
  const service = new PayrollCloseWorkflowService(
    commandBus as never,
    hcmSetupService as never,
    workerRepo as never,
    payrollCycleRepo as never,
    calculationRunRepo as never,
    payrollInputRepo as never,
    resultLineRepo as never,
  );
  return { service, commandBus, payrollCycleRepo, calculationRunRepo, payrollInputRepo, resultLineRepo };
}

describe('PayrollCloseWorkflowService idempotency key determinism', () => {
  it('derives the same idempotency key for the same namespace, command, and discriminator', () => {
    const { service } = buildService();
    const jobId = randomUUID();
    const ctxRunOne = buildContext(jobId);
    const ctxRunTwo = buildContext(jobId); // simulates a resumed run of the exact same job

    const keyOne = service.deterministicIdempotencyKey(ctxRunOne, 'CalculatePayrollResultLine', 'worker-1:NET_PAY:NET');
    const keyTwo = service.deterministicIdempotencyKey(ctxRunTwo, 'CalculatePayrollResultLine', 'worker-1:NET_PAY:NET');

    expect(keyOne).toBe(keyTwo);
  });

  it('derives different idempotency keys for different jobs (namespaces), commands, or discriminators', () => {
    const { service } = buildService();
    const ctxJobA = buildContext('job-a');
    const ctxJobB = buildContext('job-b');

    const base = service.deterministicIdempotencyKey(ctxJobA, 'CalculatePayrollResultLine', 'worker-1:NET_PAY:NET');
    expect(service.deterministicIdempotencyKey(ctxJobB, 'CalculatePayrollResultLine', 'worker-1:NET_PAY:NET')).not.toBe(base);
    expect(service.deterministicIdempotencyKey(ctxJobA, 'ExplainPayrollResultLine', 'worker-1:NET_PAY:NET')).not.toBe(base);
    expect(service.deterministicIdempotencyKey(ctxJobA, 'CalculatePayrollResultLine', 'worker-2:NET_PAY:NET')).not.toBe(base);
  });

  it('buildCommand falls back to a fresh random idempotency key when none is supplied (HTTP request path)', () => {
    const { service } = buildService();
    const ctx = buildContext(randomUUID());
    const commandOne = service.buildCommand(ctx, 'CreatePayrollExportJob', 'PayrollExportJob', {});
    const commandTwo = service.buildCommand(ctx, 'CreatePayrollExportJob', 'PayrollExportJob', {});
    expect(commandOne.idempotencyKey).not.toBe(commandTwo.idempotencyKey);
  });

  it('approvePayrollInputThroughWorkflow issues a deterministic CreatePayrollInput key that resolves to the same command twice for the same job', async () => {
    const { service, commandBus, payrollInputRepo } = buildService();
    const jobId = randomUUID();
    const ctx = buildContext(jobId);
    const payrollInputId = randomUUID();

    commandBus.execute.mockImplementation(async (command: { commandName: string; idempotencyKey: string }) => {
      if (command.commandName === 'CreatePayrollInput') return { success: true, data: { payrollInputId } };
      return { success: true, data: {} };
    });
    payrollInputRepo.findById.mockResolvedValue({ status: 'PENDING', aggregateVersion: 0, workerId: new Uuid('550e8400-e29b-41d4-a716-446655440200') });

    const draft = {
      workerId: '550e8400-e29b-41d4-a716-446655440200',
      payrollCycleId: '550e8400-e29b-41d4-a716-446655440300',
      inputType: 'BASE_GROSS_PAY',
      amount: 10000,
      currency: 'EGP',
      description: 'gross pay',
    };

    await service.approvePayrollInputThroughWorkflow(ctx, draft);
    await service.approvePayrollInputThroughWorkflow(buildContext(jobId), draft);

    const createCalls = commandBus.execute.mock.calls
      .map(([command]) => command)
      .filter((command) => command.commandName === 'CreatePayrollInput');
    expect(createCalls).toHaveLength(2);
    // Same job id (idempotencyNamespace) + same worker/inputType discriminator -> identical
    // idempotency key both times, so a real CommandBus would short-circuit the retry.
    expect(createCalls[0].idempotencyKey).toBe(createCalls[1].idempotencyKey);
  });
});
