import { randomUUID } from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';
import { PayrollCloseWorkflowService } from './payroll-close-workflow.service.js';
import { PayrollCycleCloseJobService, type StartCloseToPayInput } from './payroll-cycle-close-job.service.js';
import { PayrollArtifactService } from './payroll-artifact.service.js';
import { PayrollGlPostingService } from './payroll-gl-posting.service.js';
import type { PayrollCycleRow, PayrollCyclePreview, PayrollPayslip } from './payroll-cycle-calculation.service.js';
import type { PayrollCloseToPayReadiness } from './payroll-cycle-governance.service.js';
import type {
  PayrollCycleCloseJobEmployeeError,
  PayrollCycleCloseJobRecord,
  PayrollCycleCloseJobStatus,
} from '../repositories/payroll-cycle-close-job.repository.js';

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

function buildRow(index: number, overrides: Partial<PayrollCycleRow> = {}): PayrollCycleRow {
  const workerId = new Uuid(`550e8400-e29b-41d4-a716-4466554${(40000 + index).toString().padStart(5, '0')}`).value;
  return {
    workerId,
    employeeId: `EMP-${index.toString().padStart(3, '0')}`,
    name: `Worker ${index}`,
    email: `worker${index}@example.com`,
    baseGrossSalary: 10000,
    earningAmount: 0,
    taxableEarningAmount: null,
    nonTaxableEarningAmount: null,
    grossSalary: 10000,
    taxAmount: 1000,
    employeeInsuranceAmount: 500,
    employerInsuranceAmount: 700,
    policyDeductionAmount: 0,
    netSalary: 8500,
    currency: 'EGP',
    explainability: [],
    ...overrides,
  };
}

function buildPreview(rowCount: number, overrides: Partial<PayrollCyclePreview> = {}): PayrollCyclePreview {
  const rows = Array.from({ length: rowCount }, (_, index) => buildRow(index + 1));
  return {
    id: '2026-05',
    name: 'May 2026 Payroll',
    year: 2026,
    month: 5,
    calendarDays: 31,
    periodStart: '2026-05-01',
    periodEnd: '2026-05-31',
    payDate: '2026-05-31',
    employeeCount: rows.length,
    totalGross: rows.reduce((total, row) => total + (row.grossSalary ?? 0), 0),
    totalTax: rows.reduce((total, row) => total + (row.taxAmount ?? 0), 0),
    totalEmployeeInsurance: rows.reduce((total, row) => total + (row.employeeInsuranceAmount ?? 0), 0),
    totalEmployerInsurance: rows.reduce((total, row) => total + (row.employerInsuranceAmount ?? 0), 0),
    totalPolicyDeductions: 0,
    totalNet: rows.reduce((total, row) => total + (row.netSalary ?? 0), 0),
    currency: 'EGP',
    rows,
    ...overrides,
  };
}

const PASSING_READINESS: PayrollCloseToPayReadiness = { canClose: true, blockingIssueCount: 0, warningIssueCount: 0, issues: [] };

/**
 * A minimal in-memory stand-in for the real CommandBus that implements the same idempotency
 * short-circuit semantics (cache hit on a repeated idempotencyKey returns the prior result
 * without re-applying the command) so tests can prove the close-to-pay job's deterministic
 * idempotency keys make retries/resumes safe - without needing a real Postgres+Redis backed
 * CommandBus in a unit test.
 */
function buildFakeCommandBus(options: { failLineForWorkerId?: string } = {}) {
  const cache = new Map<string, unknown>();
  const callCountByCommand = new Map<string, number>();
  const cycles = new Map<string, { status: string; aggregateVersion: number }>();
  const runs = new Map<string, { status: string; aggregateVersion: number }>();
  const inputs = new Map<string, { status: string; aggregateVersion: number; workerId: string; inputType: string; amount: number; currency: string; description: string }>();
  const lines = new Map<string, { status: string; aggregateVersion: number; workerId: string; lineType: string; description: string; amount: number; currency: string; ruleSetId?: string; explanation?: string }>();

  function bump<T extends { aggregateVersion: number }>(store: Map<string, T>, id: string): T {
    const record = store.get(id);
    if (!record) throw new Error(`Fake bus: unknown aggregate ${id}`);
    record.aggregateVersion += 1;
    return record;
  }

  const execute = vi.fn(async (command: any) => {
    if (cache.has(command.idempotencyKey)) {
      return cache.get(command.idempotencyKey);
    }
    callCountByCommand.set(command.commandName, (callCountByCommand.get(command.commandName) ?? 0) + 1);

    let result: any;
    switch (command.commandName) {
      case 'CreatePayrollCycle': {
        const id = randomUUID();
        cycles.set(id, { status: 'DRAFT', aggregateVersion: 0 });
        result = { success: true, data: { payrollCycleId: id }, newState: 'DRAFT' };
        break;
      }
      case 'OpenPayrollCycle':
      case 'StartPayrollInputCollection':
      case 'StartPayrollValidation':
      case 'StartPayrollCalculation':
      case 'StartPayrollReview':
      case 'ApprovePayrollCycle':
      case 'ClosePayrollCycle': {
        const id = command.aggregateId.value;
        const nextState: Record<string, string> = {
          OpenPayrollCycle: 'OPEN',
          StartPayrollInputCollection: 'INPUT_COLLECTION',
          StartPayrollValidation: 'VALIDATION',
          StartPayrollCalculation: 'CALCULATION',
          StartPayrollReview: 'REVIEW',
          ApprovePayrollCycle: 'APPROVED',
          ClosePayrollCycle: 'CLOSED',
        };
        const record = bump(cycles, id);
        record.status = nextState[command.commandName];
        result = { success: true, data: {}, newState: record.status };
        break;
      }
      case 'CreatePayrollInput': {
        const id = randomUUID();
        inputs.set(id, {
          status: 'PENDING',
          aggregateVersion: 0,
          workerId: command.payload.workerId.value,
          inputType: command.payload.inputType,
          amount: command.payload.amount,
          currency: command.payload.currency,
          description: command.payload.description,
        });
        result = { success: true, data: { payrollInputId: id } };
        break;
      }
      case 'SubmitPayrollInput':
      case 'ApprovePayrollInput': {
        const id = command.aggregateId.value;
        const record = bump(inputs, id);
        record.status = command.commandName === 'SubmitPayrollInput' ? 'SUBMITTED' : 'APPROVED';
        result = { success: true, data: {} };
        break;
      }
      case 'StartPayrollCalculationRun': {
        const id = randomUUID();
        runs.set(id, { status: 'PENDING', aggregateVersion: 0 });
        result = { success: true, data: { payrollCalculationRunId: id } };
        break;
      }
      case 'ValidatePayrollCalculationRun':
      case 'FinalizePayrollCalculationRun': {
        const id = command.aggregateId.value;
        const record = bump(runs, id);
        record.status = command.commandName === 'ValidatePayrollCalculationRun' ? 'VALIDATED' : 'FINALIZED';
        result = { success: true, data: {} };
        break;
      }
      case 'CalculatePayrollResultLine': {
        const workerId = command.payload.workerId.value;
        if (options.failLineForWorkerId && workerId === options.failLineForWorkerId) {
          throw new Error(`Simulated calculation failure for worker ${workerId}`);
        }
        const id = randomUUID();
        lines.set(id, {
          status: 'CALCULATED',
          aggregateVersion: 0,
          workerId,
          lineType: command.payload.lineType,
          description: command.payload.description,
          amount: command.payload.amount,
          currency: command.payload.currency,
          ruleSetId: command.payload.ruleSetId,
        });
        result = { success: true, data: { payrollResultLineId: id } };
        break;
      }
      case 'ExplainPayrollResultLine':
      case 'ReviewPayrollResultLine':
      case 'LockPayrollResultLine': {
        const id = command.aggregateId.value;
        const record = bump(lines, id);
        if (command.commandName === 'ExplainPayrollResultLine') {
          record.status = 'EXPLAINED';
          record.explanation = command.payload.explanation;
        } else if (command.commandName === 'ReviewPayrollResultLine') {
          record.status = 'REVIEWED';
        } else {
          record.status = 'LOCKED';
        }
        result = { success: true, data: {} };
        break;
      }
      case 'GeneratePayrollPayslipArtifacts':
      case 'CreatePayrollPaymentBatch':
      case 'CreatePayrollGlPosting':
        result = { success: true, data: {} };
        break;
      default:
        result = { success: true, data: {} };
    }

    cache.set(command.idempotencyKey, result);
    return result;
  });

  return { execute, cycles, runs, inputs, lines, callCountByCommand };
}

function buildFakeRepos(bus: ReturnType<typeof buildFakeCommandBus>) {
  const payrollCycleRepo = {
    findById: vi.fn(async (id: Uuid) => {
      const record = bus.cycles.get(id.value);
      return record ? { status: record.status, aggregateVersion: record.aggregateVersion } : undefined;
    }),
  };
  const calculationRunRepo = {
    findById: vi.fn(async (id: Uuid) => {
      const record = bus.runs.get(id.value);
      return record ? { status: record.status, aggregateVersion: record.aggregateVersion } : undefined;
    }),
  };
  const payrollInputRepo = {
    findById: vi.fn(async (id: Uuid) => {
      const record = bus.inputs.get(id.value);
      return record ? { status: record.status, aggregateVersion: record.aggregateVersion, workerId: new Uuid(record.workerId) } : undefined;
    }),
    findByPayrollCycle: vi.fn(async () => [...bus.inputs.values()].map((record) => ({
      workerId: new Uuid(record.workerId),
      inputType: record.inputType,
      amount: record.amount,
      currency: record.currency,
      status: record.status,
      description: record.description,
    }))),
  };
  const resultLineRepo = {
    findById: vi.fn(async (id: Uuid) => {
      const record = bus.lines.get(id.value);
      return record ? { status: record.status, aggregateVersion: record.aggregateVersion, workerId: new Uuid(record.workerId) } : undefined;
    }),
    findByPayrollCycle: vi.fn(async () => [...bus.lines.entries()].map(([id, record]) => ({
      id: new Uuid(id),
      workerId: new Uuid(record.workerId),
      lineType: record.lineType,
      description: record.description,
      amount: record.amount,
      currency: record.currency,
      ruleSetId: record.ruleSetId,
      explanation: record.explanation,
      status: record.status,
    }))),
  };
  const workerRepo = { findByStatusForTenant: async () => [], searchForTenant: async () => [] };
  return { payrollCycleRepo, calculationRunRepo, payrollInputRepo, resultLineRepo, workerRepo };
}

function buildFakeJobRepo() {
  const jobs = new Map<string, PayrollCycleCloseJobRecord>();
  const progressHistory: Array<{ jobId: string; processedEmployees?: number; currentBatch?: number; errors?: PayrollCycleCloseJobEmployeeError[] }> = [];

  const create = vi.fn(async (input: any) => {
    const id = Uuid.generate();
    const record: PayrollCycleCloseJobRecord = {
      id,
      tenantId: input.tenantId,
      status: 'RUNNING' as PayrollCycleCloseJobStatus,
      year: input.year,
      month: input.month,
      workLocationCode: input.workLocationCode,
      closeCycle: input.closeCycle,
      batchSize: input.batchSize,
      totalEmployees: input.totalEmployees,
      processedEmployees: 0,
      totalBatches: input.totalBatches,
      currentBatch: 0,
      errors: [],
      requestedBy: input.requestedBy,
      startedAt: new Date(),
      updatedAt: new Date(),
    };
    jobs.set(id.value, record);
    return record;
  });

  const updateProgress = vi.fn(async (_tenantId: Uuid, id: Uuid, patch: any) => {
    const record = jobs.get(id.value);
    if (!record) return;
    if (patch.processedEmployees !== undefined) record.processedEmployees = patch.processedEmployees;
    if (patch.currentBatch !== undefined) record.currentBatch = patch.currentBatch;
    if (patch.totalBatches !== undefined) record.totalBatches = patch.totalBatches;
    if (patch.totalEmployees !== undefined) record.totalEmployees = patch.totalEmployees;
    if (patch.payrollCycleId !== undefined) record.payrollCycleId = patch.payrollCycleId;
    if (patch.payrollCalculationRunId !== undefined) record.payrollCalculationRunId = patch.payrollCalculationRunId;
    if (patch.errors !== undefined) record.errors = patch.errors;
    progressHistory.push({ jobId: id.value, processedEmployees: patch.processedEmployees, currentBatch: patch.currentBatch, errors: patch.errors });
  });

  const markSucceeded = vi.fn(async (_tenantId: Uuid, id: Uuid, result: Record<string, unknown>) => {
    const record = jobs.get(id.value);
    if (!record) return;
    record.status = 'SUCCEEDED';
    record.result = result;
    record.finishedAt = new Date();
  });

  const markFailed = vi.fn(async (_tenantId: Uuid, id: Uuid, errorMessage: string) => {
    const record = jobs.get(id.value);
    if (!record) return;
    record.status = 'FAILED';
    record.errorMessage = errorMessage;
    record.finishedAt = new Date();
  });

  const findById = vi.fn(async (_tenantId: Uuid, id: Uuid) => jobs.get(id.value));

  return { create, updateProgress, markSucceeded, markFailed, findById, jobs, progressHistory };
}

function buildService(bus: ReturnType<typeof buildFakeCommandBus>, options: { canClose?: boolean; readinessIssues?: PayrollCloseToPayReadiness['issues'] } = {}) {
  const repos = buildFakeRepos(bus);
  const hcmSetupService = { getSetup: vi.fn(async () => ({ locations: [{ code: 'CAIRO_HQ', active: true, currency: 'EGP' }], statutoryPayrollPacks: [] })) };
  const workflow = new PayrollCloseWorkflowService(
    bus as never,
    hcmSetupService as never,
    repos.workerRepo as never,
    repos.payrollCycleRepo as never,
    repos.calculationRunRepo as never,
    repos.payrollInputRepo as never,
    repos.resultLineRepo as never,
  );
  const jobRepo = buildFakeJobRepo();
  const payrollInputOrchestration = {
    buildInputDrafts: vi.fn((row: PayrollCycleRow, ids: { payrollCycleId: string }) => (
      row.grossSalary && row.grossSalary > 0
        ? [{ workerId: row.workerId, payrollCycleId: ids.payrollCycleId, inputType: 'BASE_GROSS_PAY', amount: row.grossSalary, currency: row.currency, description: `${row.employeeId} gross` }]
        : []
    )),
    buildPaymentBatch: vi.fn((preview: PayrollCyclePreview, rows: unknown[]) => ({
      batchId: `BATCH-${preview.id}`,
      payrollCycleId: preview.id,
      periodStart: preview.periodStart,
      periodEnd: preview.periodEnd,
      payDate: preview.payDate,
      ready: true,
      readyCount: rows.length,
      blockedCount: 0,
      totalNet: preview.totalNet,
      currency: preview.currency,
      rows,
    })),
    renderPayslipHtml: vi.fn(() => '<html></html>'),
  };
  const payrollCalculation = {
    buildBankTransferRows: vi.fn(() => []),
    buildResultLineDrafts: vi.fn((row: PayrollCycleRow, ids: { payrollCycleId: string; calculationRunId: string }) => [{
      workerId: row.workerId,
      payrollCycleId: ids.payrollCycleId,
      calculationRunId: ids.calculationRunId,
      lineType: 'NET_PAY',
      description: `${row.employeeId} net pay`,
      amount: row.netSalary ?? 0,
      currency: row.currency,
      ruleSetId: 'SYSTEM',
      calculationStep: 'NET',
      inputSnapshotHash: 'hash',
      explanation: 'gross - deductions',
    }]),
    buildPayslipsFromResultLines: vi.fn((input: { resultLines: Array<{ workerId: string; amount: number; currency: string }> }): PayrollPayslip[] => (
      input.resultLines.map((line) => ({
        id: randomUUID(),
        workerId: line.workerId,
        employeeId: line.workerId,
        employeeName: line.workerId,
        payPeriodStart: '2026-05-01',
        payPeriodEnd: '2026-05-31',
        payDate: '2026-05-31',
        grossPay: line.amount,
        netPay: line.amount,
        deductions: 0,
        taxes: 0,
        currency: line.currency,
        lines: [],
      }))
    )),
  };
  const payrollApprovedInputProjection = { applyApprovedInputs: vi.fn((preview: PayrollCyclePreview) => preview) };
  const payrollArtifact = new PayrollArtifactService();
  const payrollGlPosting = new PayrollGlPostingService();
  const persistedReadiness = {
    buildPersistedCycleCloseReadiness: vi.fn(async () => ({
      canClose: options.canClose ?? true,
      blockingIssueCount: options.readinessIssues?.filter((issue) => issue.blocking).length ?? 0,
      warningIssueCount: 0,
      issues: options.readinessIssues ?? [],
    } satisfies PayrollCloseToPayReadiness)),
  };

  const service = new PayrollCycleCloseJobService(
    jobRepo as never,
    workflow,
    hcmSetupService as never,
    repos.payrollInputRepo as never,
    repos.resultLineRepo as never,
    payrollCalculation as never,
    payrollInputOrchestration as never,
    payrollApprovedInputProjection as never,
    payrollArtifact,
    payrollGlPosting,
    persistedReadiness as never,
  );

  return { service, jobRepo, bus };
}

function buildInput(overrides: Partial<StartCloseToPayInput> = {}): StartCloseToPayInput {
  const preview = overrides.preview ?? buildPreview(5);
  return {
    tenantId: TENANT_ID,
    actor: actor(),
    year: 2026,
    month: 5,
    closeCycle: true,
    massUpdateRows: [],
    preview,
    readiness: PASSING_READINESS,
    employees: preview.rows.map((row) => ({
      workerId: row.workerId,
      employeeId: row.employeeId,
      name: row.name,
      email: row.email,
      grossSalary: row.grossSalary ?? 0,
      currency: row.currency,
    })),
    ...overrides,
  };
}

describe('PayrollCycleCloseJobService batching and progress', () => {
  it('processes employees in the configured batch size and reports progress after each batch', async () => {
    const bus = buildFakeCommandBus();
    const { service, jobRepo } = buildService(bus);
    const input = buildInput({ preview: buildPreview(5), batchSize: 2 });

    const started = await service.startJob(input);
    expect(started.totalBatches).toBe(3); // 5 employees / batch size 2 -> batches of 2,2,1
    await service.run(new Uuid(started.jobId), input, 2);

    const job = jobRepo.jobs.get(started.jobId);
    expect(job?.status).toBe('SUCCEEDED');

    // Progress checkpoints for the calculation phase (the last phase to update currentBatch)
    // should reflect batches of size 2, not one checkpoint per employee and not a single
    // checkpoint for the whole run.
    const calculationCheckpoints = jobRepo.progressHistory.filter((entry) => entry.jobId === started.jobId && entry.currentBatch !== undefined);
    const batchNumbers = calculationCheckpoints.map((entry) => entry.currentBatch);
    expect(Math.max(...(batchNumbers as number[]))).toBe(3);
    expect(job?.result?.resultLineCount).toBe(5);
  });

  it('produces identical final totals whether processed in small batches or a single batch (parity with the old synchronous path)', async () => {
    const preview = buildPreview(9);

    const busSmallBatches = buildFakeCommandBus();
    const smallBatchRun = buildService(busSmallBatches);
    const inputSmall = buildInput({ preview });
    const startedSmall = await smallBatchRun.service.startJob(inputSmall);
    await smallBatchRun.service.run(new Uuid(startedSmall.jobId), inputSmall, 2);
    const smallBatchResult = smallBatchRun.jobRepo.jobs.get(startedSmall.jobId)?.result;

    // batchSize >= employeeCount reproduces the pre-refactor "one big loop, no chunking"
    // behavior (a single batch), which is exactly what the old synchronous endpoint did.
    const busSingleBatch = buildFakeCommandBus();
    const singleBatchRun = buildService(busSingleBatch);
    const inputSingle = buildInput({ preview });
    const startedSingle = await singleBatchRun.service.startJob(inputSingle);
    expect(startedSingle.totalBatches).toBe(1);
    await singleBatchRun.service.run(new Uuid(startedSingle.jobId), inputSingle, 100);
    const singleBatchResult = singleBatchRun.jobRepo.jobs.get(startedSingle.jobId)?.result;

    expect(smallBatchResult?.totalGross).toBe(singleBatchResult?.totalGross);
    expect(smallBatchResult?.totalNet).toBe(singleBatchResult?.totalNet);
    expect(smallBatchResult?.employeeCount).toBe(singleBatchResult?.employeeCount);
    expect(smallBatchResult?.resultLineCount).toBe(singleBatchResult?.resultLineCount);
    expect(smallBatchResult?.payrollInputCount).toBe(singleBatchResult?.payrollInputCount);
    expect(smallBatchResult?.totalGross).toBe(preview.totalGross);
    expect(smallBatchResult?.totalNet).toBe(preview.totalNet);
  });

  it('captures a per-employee calculation failure without aborting the rest of the run', async () => {
    const preview = buildPreview(4);
    const failingWorkerId = preview.rows[1].workerId;
    const bus = buildFakeCommandBus({ failLineForWorkerId: failingWorkerId });
    const { service, jobRepo } = buildService(bus);
    const input = buildInput({ preview });

    const started = await service.startJob(input);
    await service.run(new Uuid(started.jobId), input, 2);

    const job = jobRepo.jobs.get(started.jobId);
    // The run as a whole still succeeds - three of four employees calculated fine.
    expect(job?.status).toBe('SUCCEEDED');
    expect(job?.result?.resultLineCount).toBe(3);
    expect(job?.errors).toHaveLength(1);
    expect(job?.errors[0]).toMatchObject({ workerId: failingWorkerId, stage: 'CALCULATION' });
  });

  it('fails the job (with prior progress preserved) when final close readiness is blocked', async () => {
    const bus = buildFakeCommandBus();
    const { service, jobRepo } = buildService(bus, {
      canClose: false,
      readinessIssues: [{ code: 'MISSING_GL_MAPPING', severity: 'ERROR', blocking: true, message: 'GL mapping missing' }],
    });
    const input = buildInput({ preview: buildPreview(2), closeCycle: true });

    const started = await service.startJob(input);
    await service.run(new Uuid(started.jobId), input, 50);

    const job = jobRepo.jobs.get(started.jobId);
    expect(job?.status).toBe('FAILED');
    expect(job?.errorMessage).toContain('GL mapping missing');
    // The cycle was actually created and progressed before the final gate blocked it - that
    // id remains visible on the job record so the caller isn't left with zero information.
    expect(job?.payrollCycleId).toBeDefined();
    expect(bus.callCountByCommand.get('ApprovePayrollCycle')).toBeUndefined();
    expect(bus.callCountByCommand.get('ClosePayrollCycle')).toBeUndefined();
  });

  it('reuses the same idempotency keys when a job is resumed, so retried commands are not re-applied', async () => {
    const bus = buildFakeCommandBus();
    const { service, jobRepo } = buildService(bus);
    const input = buildInput({ preview: buildPreview(3) });

    const started = await service.startJob(input);
    const jobId = new Uuid(started.jobId);
    await service.run(jobId, input, 50);

    const callsAfterFirstRun = new Map(bus.callCountByCommand);
    expect(callsAfterFirstRun.get('CalculatePayrollResultLine')).toBe(3);

    // Simulate a resumed/retried run of the exact same job (same jobId -> same
    // idempotencyNamespace -> same deterministic keys for every command).
    await service.run(jobId, input, 50);

    // No command should have executed additional times: every idempotencyKey was already
    // cached from the first run, so the CommandBus's fast idempotency lookup short-circuited
    // the entire pipeline on the second pass.
    for (const [commandName, count] of callsAfterFirstRun.entries()) {
      expect(bus.callCountByCommand.get(commandName)).toBe(count);
    }
    const job = jobRepo.jobs.get(started.jobId);
    expect(job?.status).toBe('SUCCEEDED');
    expect(job?.result?.resultLineCount).toBe(3);
  });
});
