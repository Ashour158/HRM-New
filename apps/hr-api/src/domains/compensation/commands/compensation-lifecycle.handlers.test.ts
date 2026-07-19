import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { CompensationEventsPublisher } from '../events/compensation-events.publisher.js';

import { CompensationPlan } from '../aggregates/compensation-plan.aggregate.js';
import { CompensationBand } from '../aggregates/compensation-band.aggregate.js';
import { CompensationChange } from '../aggregates/compensation-change.aggregate.js';
import { BonusCycle } from '../aggregates/bonus-cycle.aggregate.js';
import { EquityGrant } from '../aggregates/equity-grant.aggregate.js';
import { VariableCompPlan } from '../aggregates/variable-comp-plan.aggregate.js';
import { PayScale } from '../aggregates/pay-scale.aggregate.js';
import { TotalCompensationStatement } from '../aggregates/total-compensation-statement.aggregate.js';

import { SuspendCompensationPlanHandler } from './suspend-compensation-plan.handler.js';
import { CloseCompensationPlanHandler } from './close-compensation-plan.handler.js';
import { ActivateCompensationBandHandler } from './activate-compensation-band.handler.js';
import { ReviseCompensationBandHandler } from './revise-compensation-band.handler.js';
import { CloseCompensationBandHandler } from './close-compensation-band.handler.js';
import { SubmitCompensationChangeHandler } from './submit-compensation-change.handler.js';
import { SendForApprovalCompensationChangeHandler } from './send-for-approval-compensation-change.handler.js';
import { MakeEffectiveCompensationChangeHandler } from './make-effective-compensation-change.handler.js';
import { RejectCompensationChangeHandler } from './reject-compensation-change.handler.js';
import { CancelCompensationChangeHandler } from './cancel-compensation-change.handler.js';
import { ActivateBonusCycleHandler } from './activate-bonus-cycle.handler.js';
import { StartCalculationBonusCycleHandler } from './start-calculation-bonus-cycle.handler.js';
import { StartReviewBonusCycleHandler } from './start-review-bonus-cycle.handler.js';
import { ApproveBonusCycleHandler } from './approve-bonus-cycle.handler.js';
import { MarkPaidBonusCycleHandler } from './mark-paid-bonus-cycle.handler.js';
import { CloseBonusCycleHandler } from './close-bonus-cycle.handler.js';
import { StartVestingEquityGrantHandler } from './start-vesting-equity-grant.handler.js';
import { RecordVestingEquityGrantHandler } from './record-vesting-equity-grant.handler.js';
import { ExerciseEquityGrantHandler } from './exercise-equity-grant.handler.js';
import { ExpireEquityGrantHandler } from './expire-equity-grant.handler.js';
import { ForfeitEquityGrantHandler } from './forfeit-equity-grant.handler.js';
import { ActivateVariableCompPlanHandler } from './activate-variable-comp-plan.handler.js';
import { CloseVariableCompPlanHandler } from './close-variable-comp-plan.handler.js';
import { ActivatePayScaleHandler } from './activate-pay-scale.handler.js';
import { RevisePayScaleHandler } from './revise-pay-scale.handler.js';
import { ClosePayScaleHandler } from './close-pay-scale.handler.js';
import { GenerateTotalCompensationStatementHandler } from './generate-total-compensation-statement.handler.js';
import { DeliverTotalCompensationStatementHandler } from './deliver-total-compensation-statement.handler.js';
import { AcknowledgeTotalCompensationStatementHandler } from './acknowledge-total-compensation-statement.handler.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actorId = new Uuid('00000000-0000-0000-0000-000000000002');
const commandId = new Uuid('00000000-0000-0000-0000-000000000003');
const correlationId = new Uuid('00000000-0000-0000-0000-000000000004');
const workerId = new Uuid('00000000-0000-0000-0000-000000000005');
const planId = new Uuid('00000000-0000-0000-0000-000000000006');
const bandId = new Uuid('00000000-0000-0000-0000-000000000007');
const changeId = new Uuid('00000000-0000-0000-0000-000000000008');
const cycleId = new Uuid('00000000-0000-0000-0000-000000000009');
const grantId = new Uuid('00000000-0000-0000-0000-00000000000a');
const varPlanId = new Uuid('00000000-0000-0000-0000-00000000000b');
const scaleId = new Uuid('00000000-0000-0000-0000-00000000000c');
const statementId = new Uuid('00000000-0000-0000-0000-00000000000d');

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
      permissions: ['compensation:write'],
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

const fsm = { getAllowedActions: vi.fn(() => []) } as never;
const publisher = new CompensationEventsPublisher();

function plan(status: CompensationPlan['status']) {
  return new CompensationPlan({
    id: planId,
    tenantId,
    name: 'Base Salary Plan',
    planType: 'BASE',
    currency: 'USD',
    status,
    aggregateVersion: 1,
  });
}

function band(status: CompensationBand['status']) {
  return new CompensationBand({
    id: bandId,
    tenantId,
    bandCode: 'ENG-3',
    jobLevel: 'L3',
    jobFamily: 'Engineering',
    minSalary: 80000,
    midSalary: 100000,
    maxSalary: 120000,
    currency: 'USD',
    status,
    aggregateVersion: 1,
  });
}

function change(status: CompensationChange['status']) {
  return new CompensationChange({
    id: changeId,
    tenantId,
    workerId,
    changeType: 'MERIT_INCREASE',
    newAmount: 95000,
    currency: 'USD',
    effectiveDate: new Date('2026-03-01T00:00:00.000Z'),
    status,
    aggregateVersion: 1,
  });
}

function bonusCycle(status: BonusCycle['status']) {
  return new BonusCycle({
    id: cycleId,
    tenantId,
    cycleName: 'FY2026 Annual Bonus',
    cycleYear: 2026,
    eligibilityDate: new Date('2026-01-01T00:00:00.000Z'),
    paymentDate: new Date('2026-03-15T00:00:00.000Z'),
    totalPoolAmount: 500000,
    currency: 'USD',
    status,
    aggregateVersion: 1,
  });
}

function equityGrant(status: EquityGrant['status'], overrides: Partial<EquityGrant> = {}) {
  return new EquityGrant({
    id: grantId,
    tenantId,
    workerId,
    grantType: 'RSU',
    grantDate: new Date('2025-01-01T00:00:00.000Z'),
    vestingSchedule: [{ date: new Date('2026-01-01T00:00:00.000Z'), percentage: 25, units: 250 }],
    totalUnits: 1000,
    vestedUnits: overrides.vestedUnits ?? 0,
    exercisedUnits: overrides.exercisedUnits ?? 0,
    status,
    aggregateVersion: 1,
  });
}

function variableCompPlan(status: VariableCompPlan['status']) {
  return new VariableCompPlan({
    id: varPlanId,
    tenantId,
    name: 'Sales Commission Plan',
    planType: 'COMMISSION',
    targetPercentage: 10,
    maxPercentage: 20,
    currency: 'USD',
    status,
    aggregateVersion: 1,
  });
}

function payScale(status: PayScale['status']) {
  return new PayScale({
    id: scaleId,
    tenantId,
    scaleCode: 'GS-7',
    grade: 'Grade 7',
    steps: [{ stepNumber: 1, amount: 60000 }],
    currency: 'USD',
    status,
    aggregateVersion: 1,
  });
}

function statement(status: TotalCompensationStatement['status']) {
  return new TotalCompensationStatement({
    id: statementId,
    tenantId,
    workerId,
    statementYear: 2026,
    baseSalary: 100000,
    bonusAmount: 10000,
    equityValue: 20000,
    benefitsValue: 15000,
    totalComp: 145000,
    currency: 'USD',
    status,
    aggregateVersion: 1,
  });
}

describe('Compensation lifecycle command handlers', () => {
  describe('CompensationPlan', () => {
    it('suspends an active plan', async () => {
      const existing = plan('ACTIVE');
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const handler = new SuspendCompensationPlanHandler(repo as never, publisher, fsm);

      const result = await handler.handle(command('SuspendCompensationPlan', 'CompensationPlan', { planId }, planId));

      expect(existing.status).toBe('SUSPENDED');
      expect(result).toEqual(expect.objectContaining({ newState: 'SUSPENDED', eventsEmitted: ['CompensationPlanSuspended'] }));
    });

    it('closes a suspended plan', async () => {
      const existing = plan('SUSPENDED');
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const handler = new CloseCompensationPlanHandler(repo as never, publisher, fsm);

      const result = await handler.handle(command('CloseCompensationPlan', 'CompensationPlan', { planId }, planId));

      expect(existing.status).toBe('CLOSED');
      expect(result).toEqual(expect.objectContaining({ newState: 'CLOSED', eventsEmitted: ['CompensationPlanClosed'] }));
    });
  });

  describe('CompensationBand', () => {
    it('activates a draft band', async () => {
      const existing = band('DRAFT');
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const handler = new ActivateCompensationBandHandler(repo as never, publisher, fsm);

      const result = await handler.handle(command('ActivateCompensationBand', 'CompensationBand', { bandId }, bandId));

      expect(existing.status).toBe('ACTIVE');
      expect(result).toEqual(expect.objectContaining({ newState: 'ACTIVE', eventsEmitted: ['CompensationBandActivated'] }));
    });

    it('revises salary ranges on an active band', async () => {
      const existing = band('ACTIVE');
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const handler = new ReviseCompensationBandHandler(repo as never, publisher, fsm);

      const result = await handler.handle(command('ReviseCompensationBand', 'CompensationBand', {
        bandId, minSalary: 85000, midSalary: 105000, maxSalary: 125000,
      }, bandId));

      expect(existing.status).toBe('REVISED');
      expect(existing.minSalary).toBe(85000);
      expect(result).toEqual(expect.objectContaining({ newState: 'REVISED', eventsEmitted: ['CompensationBandRevised'] }));
    });

    it('closes a revised band', async () => {
      const existing = band('REVISED');
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const handler = new CloseCompensationBandHandler(repo as never, publisher, fsm);

      const result = await handler.handle(command('CloseCompensationBand', 'CompensationBand', { bandId }, bandId));

      expect(existing.status).toBe('CLOSED');
      expect(result).toEqual(expect.objectContaining({ newState: 'CLOSED', eventsEmitted: ['CompensationBandClosed'] }));
    });
  });

  describe('CompensationChange full approval lifecycle (HCM-P0-13)', () => {
    it('submits a draft change', async () => {
      const existing = change('DRAFT');
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const handler = new SubmitCompensationChangeHandler(repo as never, publisher, fsm);

      const result = await handler.handle(command('SubmitCompensationChange', 'CompensationChange', { changeId }, changeId));

      expect(existing.status).toBe('SUBMITTED');
      expect(result).toEqual(expect.objectContaining({ newState: 'SUBMITTED', eventsEmitted: ['CompensationChangeSubmitted'] }));
    });

    it('advances a submitted change to pending approval', async () => {
      const existing = change('SUBMITTED');
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const handler = new SendForApprovalCompensationChangeHandler(repo as never, publisher, fsm);

      const result = await handler.handle(command('SendForApprovalCompensationChange', 'CompensationChange', { changeId }, changeId));

      expect(existing.status).toBe('PENDING_APPROVAL');
      expect(result).toEqual(expect.objectContaining({ newState: 'PENDING_APPROVAL' }));
    });

    it('makes an approved change effective', async () => {
      const existing = change('APPROVED');
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const handler = new MakeEffectiveCompensationChangeHandler(repo as never, publisher, fsm);

      const result = await handler.handle(command('MakeEffectiveCompensationChange', 'CompensationChange', { changeId }, changeId));

      expect(existing.status).toBe('EFFECTIVE');
      expect(result).toEqual(expect.objectContaining({ newState: 'EFFECTIVE', eventsEmitted: ['CompensationChangeEffective'] }));
    });

    it('rejects a change pending approval', async () => {
      const existing = change('PENDING_APPROVAL');
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const handler = new RejectCompensationChangeHandler(repo as never, publisher, fsm);

      const result = await handler.handle(command('RejectCompensationChange', 'CompensationChange', { changeId }, changeId));

      expect(existing.status).toBe('REJECTED');
      expect(result).toEqual(expect.objectContaining({ newState: 'REJECTED', eventsEmitted: ['CompensationChangeRejected'] }));
    });

    it('cancels a submitted change', async () => {
      const existing = change('SUBMITTED');
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const handler = new CancelCompensationChangeHandler(repo as never, publisher, fsm);

      const result = await handler.handle(command('CancelCompensationChange', 'CompensationChange', { changeId }, changeId));

      expect(existing.status).toBe('CANCELLED');
      expect(result).toEqual(expect.objectContaining({ newState: 'CANCELLED', eventsEmitted: ['CompensationChangeCancelled'] }));
    });
  });

  describe('BonusCycle', () => {
    it('activates a draft cycle', async () => {
      const existing = bonusCycle('DRAFT');
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const result = await new ActivateBonusCycleHandler(repo as never, publisher, fsm)
        .handle(command('ActivateBonusCycle', 'BonusCycle', { cycleId }, cycleId));
      expect(existing.status).toBe('ACTIVE');
      expect(result).toEqual(expect.objectContaining({ newState: 'ACTIVE', eventsEmitted: ['BonusCycleActivated'] }));
    });

    it('starts calculation on an active cycle', async () => {
      const existing = bonusCycle('ACTIVE');
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const result = await new StartCalculationBonusCycleHandler(repo as never, publisher, fsm)
        .handle(command('StartCalculationBonusCycle', 'BonusCycle', { cycleId }, cycleId));
      expect(existing.status).toBe('CALCULATION');
      expect(result).toEqual(expect.objectContaining({ newState: 'CALCULATION', eventsEmitted: ['BonusCycleCalculated'] }));
    });

    it('starts review after calculation', async () => {
      const existing = bonusCycle('CALCULATION');
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const result = await new StartReviewBonusCycleHandler(repo as never, publisher, fsm)
        .handle(command('StartReviewBonusCycle', 'BonusCycle', { cycleId }, cycleId));
      expect(existing.status).toBe('REVIEW');
      expect(result).toEqual(expect.objectContaining({ newState: 'REVIEW', eventsEmitted: ['BonusCycleReviewed'] }));
    });

    it('approves a cycle in review', async () => {
      const existing = bonusCycle('REVIEW');
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const result = await new ApproveBonusCycleHandler(repo as never, publisher, fsm)
        .handle(command('ApproveBonusCycle', 'BonusCycle', { cycleId }, cycleId));
      expect(existing.status).toBe('APPROVED');
      expect(result).toEqual(expect.objectContaining({ newState: 'APPROVED', eventsEmitted: ['BonusCycleApproved'] }));
    });

    it('marks an approved cycle as paid', async () => {
      const existing = bonusCycle('APPROVED');
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const result = await new MarkPaidBonusCycleHandler(repo as never, publisher, fsm)
        .handle(command('MarkPaidBonusCycle', 'BonusCycle', { cycleId }, cycleId));
      expect(existing.status).toBe('PAID');
      expect(result).toEqual(expect.objectContaining({ newState: 'PAID', eventsEmitted: ['BonusCyclePaid'] }));
    });

    it('closes a paid cycle', async () => {
      const existing = bonusCycle('PAID');
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const result = await new CloseBonusCycleHandler(repo as never, publisher, fsm)
        .handle(command('CloseBonusCycle', 'BonusCycle', { cycleId }, cycleId));
      expect(existing.status).toBe('CLOSED');
      expect(result).toEqual(expect.objectContaining({ newState: 'CLOSED', eventsEmitted: ['BonusCycleClosed'] }));
    });
  });

  describe('EquityGrant', () => {
    it('starts vesting on a granted award', async () => {
      const existing = equityGrant('GRANTED');
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const handler = new StartVestingEquityGrantHandler(repo as never, publisher, fsm);

      const result = await handler.handle(command('StartVestingEquityGrant', 'EquityGrant', { grantId }, grantId));

      expect(existing.status).toBe('VESTING');
      expect(result).toEqual(expect.objectContaining({ newState: 'VESTING', eventsEmitted: ['EquityGrantVestingStarted'] }));
    });

    it('records vested units while below the total', async () => {
      const existing = equityGrant('VESTING');
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const handler = new RecordVestingEquityGrantHandler(repo as never, publisher, fsm);

      const result = await handler.handle(command('RecordVestingEquityGrant', 'EquityGrant', { grantId, units: 250 }, grantId));

      expect(existing.vestedUnits).toBe(250);
      expect(existing.status).toBe('VESTING');
      expect(result).toEqual(expect.objectContaining({ newState: 'VESTING', eventsEmitted: ['EquityGrantVested'] }));
    });

    it('exercises vested units', async () => {
      const existing = equityGrant('VESTED', { vestedUnits: 1000 });
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const handler = new ExerciseEquityGrantHandler(repo as never, publisher, fsm);

      const result = await handler.handle(command('ExerciseEquityGrant', 'EquityGrant', { grantId, units: 400 }, grantId));

      expect(existing.exercisedUnits).toBe(400);
      expect(existing.status).toBe('EXERCISED');
      expect(result).toEqual(expect.objectContaining({ newState: 'EXERCISED', eventsEmitted: ['EquityGrantExercised'] }));
    });

    it('expires a vested grant', async () => {
      const existing = equityGrant('VESTED', { vestedUnits: 1000 });
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const handler = new ExpireEquityGrantHandler(repo as never, publisher, fsm);

      const result = await handler.handle(command('ExpireEquityGrant', 'EquityGrant', { grantId }, grantId));

      expect(existing.status).toBe('EXPIRED');
      expect(result).toEqual(expect.objectContaining({ newState: 'EXPIRED', eventsEmitted: ['EquityGrantExpired'] }));
    });

    it('forfeits an unvested grant', async () => {
      const existing = equityGrant('VESTING');
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const handler = new ForfeitEquityGrantHandler(repo as never, publisher, fsm);

      const result = await handler.handle(command('ForfeitEquityGrant', 'EquityGrant', { grantId }, grantId));

      expect(existing.status).toBe('FORFEITED');
      expect(result).toEqual(expect.objectContaining({ newState: 'FORFEITED', eventsEmitted: ['EquityGrantForfeited'] }));
    });
  });

  describe('VariableCompPlan', () => {
    it('activates a draft plan', async () => {
      const existing = variableCompPlan('DRAFT');
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const handler = new ActivateVariableCompPlanHandler(repo as never, publisher, fsm);

      const result = await handler.handle(command('ActivateVariableCompPlan', 'VariableCompPlan', { planId: varPlanId }, varPlanId));

      expect(existing.status).toBe('ACTIVE');
      expect(result).toEqual(expect.objectContaining({ newState: 'ACTIVE', eventsEmitted: ['VariableCompPlanActivated'] }));
    });

    it('closes an active plan', async () => {
      const existing = variableCompPlan('ACTIVE');
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const handler = new CloseVariableCompPlanHandler(repo as never, publisher, fsm);

      const result = await handler.handle(command('CloseVariableCompPlan', 'VariableCompPlan', { planId: varPlanId }, varPlanId));

      expect(existing.status).toBe('CLOSED');
      expect(result).toEqual(expect.objectContaining({ newState: 'CLOSED', eventsEmitted: ['VariableCompPlanClosed'] }));
    });
  });

  describe('PayScale', () => {
    it('activates a draft scale', async () => {
      const existing = payScale('DRAFT');
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const handler = new ActivatePayScaleHandler(repo as never, publisher, fsm);

      const result = await handler.handle(command('ActivatePayScale', 'PayScale', { scaleId }, scaleId));

      expect(existing.status).toBe('ACTIVE');
      expect(result).toEqual(expect.objectContaining({ newState: 'ACTIVE', eventsEmitted: ['PayScaleActivated'] }));
    });

    it('revises the grade-step progression', async () => {
      const existing = payScale('ACTIVE');
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const handler = new RevisePayScaleHandler(repo as never, publisher, fsm);

      const result = await handler.handle(command('RevisePayScale', 'PayScale', {
        scaleId, steps: [{ stepNumber: 1, amount: 65000 }, { stepNumber: 2, amount: 70000 }],
      }, scaleId));

      expect(existing.status).toBe('REVISED');
      expect(existing.steps).toHaveLength(2);
      expect(result).toEqual(expect.objectContaining({ newState: 'REVISED', eventsEmitted: ['PayScaleRevised'] }));
    });

    it('closes a revised scale', async () => {
      const existing = payScale('REVISED');
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const handler = new ClosePayScaleHandler(repo as never, publisher, fsm);

      const result = await handler.handle(command('ClosePayScale', 'PayScale', { scaleId }, scaleId));

      expect(existing.status).toBe('CLOSED');
      expect(result).toEqual(expect.objectContaining({ newState: 'CLOSED', eventsEmitted: ['PayScaleClosed'] }));
    });
  });

  describe('TotalCompensationStatement', () => {
    it('generates a draft statement', async () => {
      const existing = statement('DRAFT');
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const handler = new GenerateTotalCompensationStatementHandler(repo as never, publisher, fsm);

      const result = await handler.handle(command('GenerateTotalCompensationStatement', 'TotalCompensationStatement', { statementId }, statementId));

      expect(existing.status).toBe('GENERATED');
      expect(result).toEqual(expect.objectContaining({ newState: 'GENERATED', eventsEmitted: ['TotalCompStatementGenerated'] }));
    });

    it('delivers a generated statement', async () => {
      const existing = statement('GENERATED');
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const handler = new DeliverTotalCompensationStatementHandler(repo as never, publisher, fsm);

      const result = await handler.handle(command('DeliverTotalCompensationStatement', 'TotalCompensationStatement', { statementId }, statementId));

      expect(existing.status).toBe('DELIVERED');
      expect(result).toEqual(expect.objectContaining({ newState: 'DELIVERED', eventsEmitted: ['TotalCompStatementDelivered'] }));
    });

    it('acknowledges a delivered statement', async () => {
      const existing = statement('DELIVERED');
      const repo = { findById: vi.fn(async () => existing), save: vi.fn(async () => undefined) };
      const handler = new AcknowledgeTotalCompensationStatementHandler(repo as never, publisher, fsm);

      const result = await handler.handle(command('AcknowledgeTotalCompensationStatement', 'TotalCompensationStatement', { statementId }, statementId));

      expect(existing.status).toBe('ACKNOWLEDGED');
      expect(result).toEqual(expect.objectContaining({ newState: 'ACKNOWLEDGED', eventsEmitted: ['TotalCompStatementAcknowledged'] }));
    });
  });
});
