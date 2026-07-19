import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { BenefitsEventsPublisher } from '../events/benefits-events.publisher.js';
import { CarrierReconciliationRun } from '../aggregates/carrier-reconciliation-run.aggregate.js';
import { CreateCarrierReconciliationRunHandler } from './create-carrier-reconciliation-run.handler.js';
import { DetectCarrierReconciliationVarianceHandler } from './detect-carrier-reconciliation-variance.handler.js';
import { ReconcileCarrierReconciliationRunHandler } from './reconcile-carrier-reconciliation-run.handler.js';
import { FailCarrierReconciliationRunHandler } from './fail-carrier-reconciliation-run.handler.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actorId = new Uuid('00000000-0000-0000-0000-000000000002');
const commandId = new Uuid('00000000-0000-0000-0000-000000000003');
const correlationId = new Uuid('00000000-0000-0000-0000-000000000004');
const carrierId = new Uuid('00000000-0000-0000-0000-000000000005');
const runId = new Uuid('00000000-0000-0000-0000-000000000006');

function command(commandName: string, payload: unknown, aggregateId?: Uuid): HrCommandEnvelope<unknown> {
  return {
    commandId,
    commandName,
    commandSchemaVersion: 1,
    tenantId,
    actor: {
      actorType: 'USER',
      actorId,
      roles: ['BENEFITS_ADMIN'],
      permissions: ['benefits:write'],
      mfaAuthenticated: true,
    },
    aggregateType: 'CarrierReconciliationRun',
    aggregateId,
    idempotencyKey: `${commandName}-key`,
    correlationId,
    reason: 'carrier reconciliation run lifecycle test',
    payload,
    metadata: {
      requestHash: `${commandName}-hash`,
      clientType: 'HR_ADMIN',
      hrDataSensitivity: 'LOW',
    },
  };
}

function run(status: CarrierReconciliationRun['status']) {
  return new CarrierReconciliationRun({
    id: runId,
    tenantId,
    carrierId,
    periodStart: new Date('2026-01-01T00:00:00.000Z'),
    periodEnd: new Date('2026-01-31T23:59:59.999Z'),
    totalPremium: 100000,
    totalCollected: 98000,
    varianceAmount: 0,
    currency: 'USD',
    status,
    aggregateVersion: 1,
  });
}

describe('CarrierReconciliationRun lifecycle command handlers', () => {
  it('creates a run and immediately starts it, so CarrierReconciliationStarted is reachable', async () => {
    const repo = { save: vi.fn(async () => undefined) };
    const handler = new CreateCarrierReconciliationRunHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => ['DetectVariance', 'Reconcile', 'Fail']) } as never,
    );

    const result = await handler.handle(command('CreateCarrierReconciliationRun', {
      runId,
      carrierId,
      periodStart: new Date('2026-01-01T00:00:00.000Z'),
      periodEnd: new Date('2026-01-31T23:59:59.999Z'),
      totalPremium: 100000,
      totalCollected: 98000,
      varianceAmount: 0,
      currency: 'USD',
    }));

    const saved = repo.save.mock.calls[0]?.[0] as CarrierReconciliationRun;
    expect(saved.status).toBe('IN_PROGRESS');
    expect(result).toEqual(expect.objectContaining({
      newState: 'IN_PROGRESS',
      eventsEmitted: ['CarrierReconciliationStarted'],
    }));
  });

  it('records a detected variance on an IN_PROGRESS run', async () => {
    const existing = run('IN_PROGRESS');
    const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
    const handler = new DetectCarrierReconciliationVarianceHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => ['Reconcile', 'Fail']) } as never,
    );

    const result = await handler.handle(command('DetectCarrierReconciliationVariance', { runId, varianceAmount: 2000 }, runId));

    expect(existing.status).toBe('VARIANCE_DETECTED');
    expect(existing.varianceAmount).toBe(2000);
    expect(result).toEqual(expect.objectContaining({
      newState: 'VARIANCE_DETECTED',
      eventsEmitted: ['CarrierReconciliationVarianceDetected'],
    }));
    // BenefitsCarrierConsumer escalates off `runId`/`varianceAmount` in this payload.
    expect(result.data).toEqual(expect.objectContaining({ runId: runId.value, varianceAmount: 2000 }));
  });

  it('idempotently returns success (without re-detecting or saving) for a command retry against a run that already has VARIANCE_DETECTED', async () => {
    const existing = run('VARIANCE_DETECTED');
    existing.varianceAmount = 2000;
    const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
    const handler = new DetectCarrierReconciliationVarianceHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => ['Reconcile', 'Fail']) } as never,
    );

    const result = await handler.handle(command('DetectCarrierReconciliationVariance', { runId, varianceAmount: 2000 }, runId));

    expect(repo.save).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      success: true,
      newState: 'VARIANCE_DETECTED',
      eventsEmitted: [],
    }));
  });

  it('rejects detecting variance on a PENDING (not yet started) run', async () => {
    const existing = run('PENDING');
    const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
    const handler = new DetectCarrierReconciliationVarianceHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => []) } as never,
    );

    await expect(handler.handle(command('DetectCarrierReconciliationVariance', { runId, varianceAmount: 2000 }, runId))).rejects.toThrow(
      'Cannot detect variance for CarrierReconciliationRun from state PENDING',
    );
  });

  it('reconciles a clean IN_PROGRESS run', async () => {
    const existing = run('IN_PROGRESS');
    const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
    const handler = new ReconcileCarrierReconciliationRunHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => []) } as never,
    );

    const result = await handler.handle(command('ReconcileCarrierReconciliationRun', { runId }, runId));

    expect(existing.status).toBe('RECONCILED');
    expect(result.eventsEmitted).toEqual(['CarrierReconciliationCompleted']);
  });

  it('reconciles a VARIANCE_DETECTED run once the variance is resolved', async () => {
    const existing = run('VARIANCE_DETECTED');
    const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
    const handler = new ReconcileCarrierReconciliationRunHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => []) } as never,
    );

    const result = await handler.handle(command('ReconcileCarrierReconciliationRun', { runId }, runId));

    expect(existing.status).toBe('RECONCILED');
    expect(result.eventsEmitted).toEqual(['CarrierReconciliationCompleted']);
  });

  it('idempotently returns success (without re-invoking reconcile or saving) for a command retry against an already-RECONCILED run', async () => {
    const existing = run('RECONCILED');
    const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
    const handler = new ReconcileCarrierReconciliationRunHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => []) } as never,
    );

    const result = await handler.handle(command('ReconcileCarrierReconciliationRun', { runId }, runId));

    expect(repo.save).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      success: true,
      newState: 'RECONCILED',
      eventsEmitted: [],
    }));
  });

  it('fails an IN_PROGRESS run', async () => {
    const existing = run('IN_PROGRESS');
    const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
    const handler = new FailCarrierReconciliationRunHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => []) } as never,
    );

    const result = await handler.handle(command('FailCarrierReconciliationRun', { runId, reason: 'carrier file unparseable' }, runId));

    expect(existing.status).toBe('FAILED');
    expect(result).toEqual(expect.objectContaining({
      newState: 'FAILED',
      eventsEmitted: ['CarrierReconciliationFailed'],
    }));
    expect(result.data).toEqual(expect.objectContaining({ reason: 'carrier file unparseable' }));
  });

  it('idempotently returns success (without re-invoking fail or saving) for a command retry against an already-FAILED run', async () => {
    const existing = run('FAILED');
    const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
    const handler = new FailCarrierReconciliationRunHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => []) } as never,
    );

    const result = await handler.handle(command('FailCarrierReconciliationRun', { runId, reason: 'retry' }, runId));

    expect(repo.save).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      success: true,
      newState: 'FAILED',
      eventsEmitted: [],
    }));
  });

  it('rejects failing an already-RECONCILED (terminal) run', async () => {
    const existing = run('RECONCILED');
    const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
    const handler = new FailCarrierReconciliationRunHandler(
      repo as never,
      new BenefitsEventsPublisher(),
      { getAllowedActions: vi.fn(() => []) } as never,
    );

    await expect(handler.handle(command('FailCarrierReconciliationRun', { runId }, runId))).rejects.toThrow(
      'Cannot fail CarrierReconciliationRun from state RECONCILED',
    );
  });
});
