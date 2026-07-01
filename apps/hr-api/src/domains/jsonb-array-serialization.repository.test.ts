import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BenefitsEnrollmentRepository } from './benefits/repositories/benefits-enrollment.repository.ts';
import { CountryPolicyImpactSimulationRepository } from './country-policy/repositories/country-policy-impact-simulation.repository.ts';
import { CountryPolicyPackRepository } from './country-policy/repositories/country-policy-pack.repository.ts';
import { LegalHoldRepository } from './compliance/repositories/legal-hold.repository.ts';
import { EquityGrantRepository } from './compensation/repositories/equity-grant.repository.ts';
import { PayScaleRepository } from './compensation/repositories/pay-scale.repository.ts';
import { EngagementSurveyRepository } from './engagement/repositories/engagement-survey.repository.ts';
import { InterviewPlanRepository } from './recruiting/repositories/interview-plan.repository.ts';
import { CalculatedFieldRepository } from './reporting/repositories/calculated-field.repository.ts';
import { ReportScheduleRepository } from './reporting/repositories/report-schedule.repository.ts';
import { CareerPathRepository } from './skills-talent/repositories/career-path.repository.ts';
import { SkillProfileRepository } from './skills-talent/repositories/skill-profile.repository.ts';
import { SuccessionPlanRepository } from './skills-talent/repositories/succession-plan.repository.ts';
import { CoverageGapRepository } from './workforce-management/repositories/coverage-gap.repository.ts';
import { OpenShiftRepository } from './workforce-management/repositories/open-shift.repository.ts';

type Row = Record<string, unknown>;

const dbHarness = vi.hoisted(() => {
  const state = {
    inserted: [] as Row[],
    updated: [] as Row[],
    existing: undefined as Row | undefined,
  };

  function selectChain(): any {
    const chain: any = {};
    chain.select = vi.fn(() => chain);
    chain.selectAll = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.execute = vi.fn(async () => []);
    chain.executeTakeFirst = vi.fn(async () => state.existing);
    return chain;
  }

  function insertChain(): any {
    const chain: any = {};
    chain.values = vi.fn((row: Row) => {
      state.inserted.push(row);
      return chain;
    });
    chain.execute = vi.fn(async () => undefined);
    return chain;
  }

  function updateChain(): any {
    const chain: any = {};
    chain.set = vi.fn((row: Row) => {
      state.updated.push(row);
      return chain;
    });
    chain.where = vi.fn(() => chain);
    chain.execute = vi.fn(async () => undefined);
    return chain;
  }

  return {
    state,
    createDb: () => ({
      selectFrom: vi.fn(() => selectChain()),
      insertInto: vi.fn(() => insertChain()),
      updateTable: vi.fn(() => updateChain()),
    }),
  };
});

vi.mock('@hcm/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hcm/database')>();
  return {
    ...actual,
    createKyselyInstance: vi.fn(() => dbHarness.createDb()),
    getPool: vi.fn(() => ({})),
  };
});

function uuid(value = '00000000-0000-4000-8000-000000000001'): { value: string } {
  return { value };
}

function rowFromPrivateToRow(repository: unknown, entity: Row): Row {
  return (repository as { toRow(entity: Row): Row }).toRow(entity);
}

function expectJsonArrayString(row: Row, column: string): void {
  const value = row[column];
  expect(typeof value, `${column} should be serialized before reaching pg`).toBe('string');
  expect(Array.isArray(value)).toBe(false);
  expect(Array.isArray(JSON.parse(value as string)), `${column} should parse as a JSON array`).toBe(true);
}

async function insertedRowFromSave(repository: { save(entity: any): Promise<void> }, entity: Row): Promise<Row> {
  dbHarness.state.inserted = [];
  dbHarness.state.updated = [];
  dbHarness.state.existing = undefined;
  await repository.save(entity);
  const row = dbHarness.state.inserted.at(-1);
  expect(row).toBeDefined();
  return row as Row;
}

describe('jsonb array repository serialization', () => {
  beforeEach(() => {
    dbHarness.state.inserted = [];
    dbHarness.state.updated = [];
    dbHarness.state.existing = undefined;
  });

  it('serializes skills-talent array jsonb columns before persistence', () => {
    expectJsonArrayString(
      rowFromPrivateToRow(new CareerPathRepository(), {
        id: uuid('00000000-0000-4000-8000-000000000101'),
        tenantId: uuid(),
        title: 'Clinical leader path',
        currentRole: 'Nurse',
        targetRole: 'Head Nurse',
        requiredSkills: ['triage', 'leadership'],
        milestones: [{ milestoneId: 'm1', title: 'Shadowing', requiredSkills: ['leadership'] }],
        status: 'DRAFT',
        aggregateVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      'required_skills',
    );
    expectJsonArrayString(
      rowFromPrivateToRow(new CareerPathRepository(), {
        id: uuid('00000000-0000-4000-8000-000000000101'),
        tenantId: uuid(),
        title: 'Clinical leader path',
        currentRole: 'Nurse',
        targetRole: 'Head Nurse',
        requiredSkills: ['triage', 'leadership'],
        milestones: [{ milestoneId: 'm1', title: 'Shadowing', requiredSkills: ['leadership'] }],
        status: 'DRAFT',
        aggregateVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      'milestones',
    );
    expectJsonArrayString(
      rowFromPrivateToRow(new SkillProfileRepository(), {
        id: uuid('00000000-0000-4000-8000-000000000102'),
        tenantId: uuid(),
        workerId: uuid('00000000-0000-4000-8000-000000000202'),
        skills: [{ skillId: 'phlebotomy', proficiency: 4 }],
        status: 'ACTIVE',
        aggregateVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      'skills',
    );
    expectJsonArrayString(
      rowFromPrivateToRow(new SuccessionPlanRepository(), {
        id: uuid('00000000-0000-4000-8000-000000000103'),
        tenantId: uuid(),
        positionId: uuid('00000000-0000-4000-8000-000000000203'),
        successorCandidates: ['00000000-0000-4000-8000-000000000303'],
        readinessLevels: {},
        status: 'DRAFT',
        aggregateVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      'successor_candidates',
    );
  });

  it('serializes workforce-management required skill arrays before persistence', () => {
    const shared = {
      id: uuid('00000000-0000-4000-8000-000000000104'),
      tenantId: uuid(),
      departmentId: uuid('00000000-0000-4000-8000-000000000204'),
      workplaceCode: 'CAIRO_HQ',
      shiftDate: '2026-07-01',
      startTime: '08:00',
      endTime: '16:00',
      requiredSkills: ['ICU'],
      filledByWorkerId: undefined,
      status: 'OPEN',
      aggregateVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expectJsonArrayString(rowFromPrivateToRow(new CoverageGapRepository(), shared), 'required_skills');
    expectJsonArrayString(
      rowFromPrivateToRow(new OpenShiftRepository(), { ...shared, bidDeadline: '2026-06-30T12:00:00Z' }),
      'required_skills',
    );
  });

  it('serializes engagement survey questions before persistence', () => {
    expectJsonArrayString(
      rowFromPrivateToRow(new EngagementSurveyRepository(), {
        id: uuid('00000000-0000-4000-8000-000000000105'),
        tenantId: uuid(),
        title: 'Pulse',
        surveyType: 'PULSE',
        questions: [{ code: 'q1', text: 'How are you feeling?' }],
        anonymous: true,
        startDate: null,
        endDate: null,
        results: null,
        status: 'DRAFT',
        aggregateVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      'questions',
    );
  });

  it('serializes recruiting interviewers before persistence', async () => {
    const row = await insertedRowFromSave(new InterviewPlanRepository(), {
      id: uuid('00000000-0000-4000-8000-000000000106'),
      tenantId: uuid(),
      candidateId: uuid('00000000-0000-4000-8000-000000000206'),
      requisitionId: uuid('00000000-0000-4000-8000-000000000306'),
      interviewers: [uuid('00000000-0000-4000-8000-000000000406')],
      scheduledAt: new Date(),
      format: 'PANEL',
      status: 'SCHEDULED',
      version: 0,
    });
    expectJsonArrayString(row, 'interviewers');
  });

  it('serializes additional confirmed array jsonb columns before persistence', async () => {
    expectJsonArrayString(
      rowFromPrivateToRow(new BenefitsEnrollmentRepository(), {
        id: uuid('00000000-0000-4000-8000-000000000107'),
        tenantId: uuid(),
        workerId: uuid('00000000-0000-4000-8000-000000000207'),
        programId: uuid('00000000-0000-4000-8000-000000000307'),
        coverageLevel: 'FAMILY',
        dependents: [{ name: 'Dependent One', relationship: 'CHILD' }],
        effectiveDate: '2026-07-01',
        status: 'ACTIVE',
        aggregateVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      'dependents',
    );
    expectJsonArrayString(
      rowFromPrivateToRow(new PayScaleRepository(), {
        id: uuid('00000000-0000-4000-8000-000000000108'),
        tenantId: uuid(),
        scaleCode: 'NURSE_G5',
        grade: 'G5',
        steps: [{ step: 1, min: 1000, max: 2000 }],
        currency: 'EGP',
        status: 'DRAFT',
        aggregateVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      'steps',
    );
    expectJsonArrayString(
      rowFromPrivateToRow(new EquityGrantRepository(), {
        id: uuid('00000000-0000-4000-8000-000000000109'),
        tenantId: uuid(),
        workerId: uuid('00000000-0000-4000-8000-000000000209'),
        grantType: 'RSU',
        grantDate: '2026-07-01',
        vestingSchedule: [{ date: '2027-07-01', units: 100 }],
        totalUnits: 100,
        vestedUnits: 0,
        exercisedUnits: 0,
        strikePrice: undefined,
        status: 'DRAFT',
        aggregateVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      'vesting_schedule',
    );
    expectJsonArrayString(
      await insertedRowFromSave(new LegalHoldRepository(), {
        id: uuid('00000000-0000-4000-8000-000000000110'),
        tenantId: uuid(),
        holdName: 'Investigation hold',
        description: 'Hold records',
        reason: 'Investigation',
        affectedWorkerIds: [uuid('00000000-0000-4000-8000-000000000210')],
        placedBy: uuid('00000000-0000-4000-8000-000000000310'),
        placedAt: new Date(),
        releasedBy: undefined,
        releasedAt: undefined,
        status: 'ACTIVE',
        aggregateVersion: 0,
      }),
      'affected_worker_ids',
    );
    expectJsonArrayString(
      await insertedRowFromSave(new ReportScheduleRepository(), {
        id: uuid('00000000-0000-4000-8000-000000000111'),
        tenantId: uuid(),
        reportDefinitionId: uuid('00000000-0000-4000-8000-000000000211'),
        frequency: 'MONTHLY',
        recipients: ['hr@example.com'],
        nextRunAt: new Date(),
        lastRunAt: undefined,
        status: 'ACTIVE',
        aggregateVersion: 0,
      }),
      'recipients',
    );
    expectJsonArrayString(
      await insertedRowFromSave(new CalculatedFieldRepository(), {
        id: uuid('00000000-0000-4000-8000-000000000112'),
        tenantId: uuid(),
        fieldName: 'absence_rate',
        expression: 'absence_days / scheduled_days',
        dataType: 'NUMBER',
        sourceFields: ['absence_days', 'scheduled_days'],
        status: 'DRAFT',
        aggregateVersion: 0,
      }),
      'source_fields',
    );
  });

  it('serializes country-policy array jsonb columns before persistence', async () => {
    expectJsonArrayString(
      await insertedRowFromSave(new CountryPolicyPackRepository(), {
        id: uuid('00000000-0000-4000-8000-000000000113'),
        tenantId: uuid(),
        countryCode: 'EG',
        countryPackVersion: '2026.1',
        effectiveFrom: new Date(),
        effectiveUntil: undefined,
        status: 'DRAFT',
        sections: {},
        requiredApprovals: ['LEGAL', 'PAYROLL'],
        sourceEvidence: {},
        recalculationRequired: false,
        uploadedBy: undefined,
        uploadedAt: undefined,
        publishedAt: undefined,
        publishedBy: undefined,
        supersededBy: undefined,
        rollbackReason: undefined,
        aggregateVersion: 0,
      }),
      'required_approvals',
    );

    const row = await insertedRowFromSave(new CountryPolicyImpactSimulationRepository(), {
      id: uuid('00000000-0000-4000-8000-000000000114'),
      tenantId: uuid(),
      policyPackId: uuid('00000000-0000-4000-8000-000000000214'),
      impactedWorkers: ['00000000-0000-4000-8000-000000000314'],
      impactedPayrollRuns: ['payroll-2026-07'],
      impactedTaxAssignments: ['tax-assignment-1'],
      impactedLeaveBalances: ['leave-balance-1'],
      impactedBenefits: ['benefit-1'],
      riskLevel: 'LOW',
      results: {},
      status: 'COMPLETED',
      aggregateVersion: 0,
    });
    expectJsonArrayString(row, 'impacted_workers');
    expectJsonArrayString(row, 'impacted_payroll_runs');
    expectJsonArrayString(row, 'impacted_tax_assignments');
    expectJsonArrayString(row, 'impacted_leave_balances');
    expectJsonArrayString(row, 'impacted_benefits');
  });
});
