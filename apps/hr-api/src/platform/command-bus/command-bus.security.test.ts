import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { AccessControlService } from '@hcm/access-control';
import { CommandBus, requiredPolicyAreaForCommand } from './command-bus.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const workerId = new Uuid('550e8400-e29b-41d4-a716-446655440001');

const governedPolicyCases = [
  ['leave', 'LEAVE', 'SubmitAbsenceRequest', 'AbsenceRequest'],
  ['attendance', 'ATTENDANCE', 'RecordTimeClockEvent', 'TimeClockEvent'],
  ['payroll', 'PAYROLL', 'ClosePayrollCycle', 'PayrollCycle'],
  ['access governance', 'ACCESS_GOVERNANCE', 'CreateRole', 'AccessGovernanceRole'],
  ['compliance', 'COMPLIANCE', 'RequirePolicyAcknowledgement', 'PolicyAcknowledgement'],
  ['country policy', 'COUNTRY_POLICY', 'PublishCountryPolicyPack', 'CountryPolicyPack'],
  ['global HR policy', 'GLOBAL_HR', 'CreateWorkAuthorizationCase', 'WorkAuthorizationCase'],
  ['benefits', 'BENEFITS', 'SubmitBenefitsEnrollment', 'BenefitsEnrollment'],
  ['onboarding', 'ACCESS_GOVERNANCE', 'StartOnboarding', 'OnboardingPlan'],
  ['performance', 'ACCESS_GOVERNANCE', 'CreateGoal', 'Goal'],
  ['service delivery', 'ACCESS_GOVERNANCE', 'OpenHrServiceCase', 'HrServiceCase'],
  ['reporting', 'ACCESS_GOVERNANCE', 'CreateReportDefinition', 'ReportDefinition'],
] as const;

function makeCommand(overrides: Partial<HrCommandEnvelope<unknown>> = {}): HrCommandEnvelope<unknown> {
  return {
    commandId: new Uuid('550e8400-e29b-41d4-a716-446655440011'),
    commandName: 'UpdateWorkerPersonalData',
    commandSchemaVersion: 1,
    tenantId,
    actor: {
      actorType: 'USER',
      actorId: new Uuid('550e8400-e29b-41d4-a716-446655440012'),
      roles: ['EMPLOYEE'],
      permissions: ['WORKER_UPDATE'],
      mfaAuthenticated: true,
    },
    aggregateType: 'WorkerProfile',
    aggregateId: workerId,
    expectedState: 'ACTIVE',
    expectedVersion: 2,
    subjectWorkerId: workerId,
    idempotencyKey: 'idem-key',
    correlationId: new Uuid('550e8400-e29b-41d4-a716-446655440013'),
    reason: 'test',
    payload: { workerId },
    metadata: { requestHash: 'hash', clientType: 'EMPLOYEE_PORTAL' },
    ...overrides,
  };
}

function commandBusWith(overrides: Record<string, unknown> = {}) {
  return Object.assign(Object.create(CommandBus.prototype), {
    accessControl: new AccessControlService(),
    ...overrides,
  }) as Record<string, (...args: unknown[]) => Promise<unknown>>;
}

function commandResult(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    data: { workerId: workerId.value, status: 'SUBMITTED' },
    commandId: new Uuid('550e8400-e29b-41d4-a716-446655440011'),
    correlationId: new Uuid('550e8400-e29b-41d4-a716-446655440013'),
    aggregateId: workerId,
    newState: 'SUBMITTED',
    newVersion: 3,
    allowedNextActions: [],
    fieldAccessDecisions: {},
    eventsEmitted: ['AbsenceRequestSubmitted'],
    auditRecordId: new Uuid('550e8400-e29b-41d4-a716-446655440014'),
    ...overrides,
  };
}

function readCommandHandlerNames(): string[] {
  const root = join(process.cwd(), 'src', 'domains');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      if (statSync(fullPath).isDirectory()) {
        walk(fullPath);
      } else if (fullPath.endsWith('.handler.ts')) {
        files.push(fullPath);
      }
    }
  };
  walk(root);
  return files.flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    return [...source.matchAll(/@CommandHandler\(['"`]([^'"`]+)['"`]\)/g)].map((match) => match[1]);
  }).sort();
}

describe('CommandBus security gates', () => {
  it('rejects command actors whose actorId is not a UUID', async () => {
    const bus = commandBusWith();
    const command = makeCommand({
      actor: {
        actorType: 'SYSTEM',
        actorId: { value: 'system-api-key' } as never,
        roles: ['SYSTEM_ACTOR'],
        permissions: [],
        mfaAuthenticated: true,
      },
    });

    await expect(bus.stepAuthenticateActor(command)).rejects.toMatchObject({
      errorCode: 'UNAUTHENTICATED_ACTOR',
    });
  });

  it('does not skip FSM evaluation when an expected aggregate could not be loaded', async () => {
    const bus = commandBusWith();

    await expect(bus.stepEvaluateFsm(makeCommand(), undefined)).rejects.toMatchObject({
      errorCode: 'AGGREGATE_NOT_LOADED',
    });
  });

  it('normalizes aggregate versions from database rows before FSM conflict checks', async () => {
    const bus = commandBusWith({
      fsmFramework: {
        getAllowedActions: () => ['UpdateWorkerPersonalData'],
      },
    });

    await expect(bus.stepEvaluateFsm(makeCommand({
      expectedState: 'ACTIVE',
      expectedVersion: 1,
    }), { version: '1' } as never)).resolves.toBeUndefined();
  });

  it('loads stateful aggregates from the declared table registry beyond the worker/payroll slice', async () => {
    const selectedTables: string[] = [];
    const executeTakeFirst = async () => ({
      id: workerId.value,
      status: 'NEW',
      aggregate_version: 3,
    });
    const query = {
      select: () => query,
      where: () => query,
      executeTakeFirst,
    };
    const tx = {
      selectFrom: (table: string) => {
        selectedTables.push(table);
        return query;
      },
    };
    const bus = commandBusWith();

    const aggregate = await bus.stepLoadAggregate(tx, makeCommand({
      aggregateType: 'Candidate',
      expectedState: 'NEW',
      expectedVersion: 3,
    }));

    expect(selectedTables).toEqual(['hr_recruiting.candidates']);
    expect(aggregate).toMatchObject({ version: 3 });
  });

  it('writes handler-emitted canonical event names to the outbox', async () => {
    const inserted: Array<{ table: string; row: Record<string, unknown> }> = [];
    const tx = {
      insertInto: (table: string) => ({
        values: (row: Record<string, unknown>) => ({
          execute: async () => {
            inserted.push({ table, row });
          },
        }),
      }),
    };
    const bus = commandBusWith();

    await bus.stepWriteOutbox(tx, makeCommand({
      commandName: 'SuspendWorker',
      aggregateType: 'WorkerProfile',
    }), {
      success: true,
      data: { workerId: workerId.value, status: 'SUSPENDED' },
      commandId: new Uuid('550e8400-e29b-41d4-a716-446655440011'),
      correlationId: new Uuid('550e8400-e29b-41d4-a716-446655440013'),
      aggregateId: workerId,
      newState: 'SUSPENDED',
      newVersion: 3,
      allowedNextActions: [],
      fieldAccessDecisions: {},
      eventsEmitted: ['WorkerSuspended'],
      auditRecordId: new Uuid('550e8400-e29b-41d4-a716-446655440014'),
    });

    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      table: 'outbox_events',
      row: { event_name: 'WorkerSuspended' },
    });
  });

  it('requires an applied benefits policy for benefits enrollment and life-event commands', () => {
    expect(requiredPolicyAreaForCommand({
      aggregateType: 'BenefitsEnrollment',
      commandName: 'SubmitBenefitsEnrollment',
    })).toBe('BENEFITS');
    expect(requiredPolicyAreaForCommand({
      aggregateType: 'BenefitsLifeEvent',
      commandName: 'ApproveBenefitsLifeEvent',
    })).toBe('BENEFITS');
  });

  it('does not classify generic enrollment or life-event commands as benefits policy commands', () => {
    expect(requiredPolicyAreaForCommand({
      aggregateType: 'LearningEnrollment',
      commandName: 'SubmitEnrollment',
    })).toBe('ACCESS_GOVERNANCE');
    expect(requiredPolicyAreaForCommand({
      aggregateType: 'EmployeeLifeEvent',
      commandName: 'ApproveLifeEvent',
    })).toBe('ACCESS_GOVERNANCE');
  });

  it('requires applied access governance for saved report execution commands', () => {
    expect(requiredPolicyAreaForCommand({
      aggregateType: 'ReportDefinition',
      commandName: 'RunReportDefinition',
    })).toBe('ACCESS_GOVERNANCE');
  });

  it('rejects stale expected state when the stored aggregate state has moved', async () => {
    const executeTakeFirst = async () => ({
      id: workerId.value,
      status: 'SCREENING',
      aggregate_version: 3,
    });
    const query = {
      select: () => query,
      where: () => query,
      executeTakeFirst,
    };
    const tx = {
      selectFrom: () => query,
    };
    const bus = commandBusWith();

    await expect(bus.stepLoadAggregate(tx, makeCommand({
      aggregateType: 'Candidate',
      expectedState: 'NEW',
      expectedVersion: 3,
    }))).rejects.toMatchObject({
      errorCode: 'AGGREGATE_STATE_CONFLICT',
    });
  });

  it('blocks employee mutation of payroll-sensitive fields at the command field policy gate', async () => {
    const bus = commandBusWith();
    const command = makeCommand({
      payload: {
        workerId,
        compensation: {
          grossSalaryAmount: 25_000,
          bankAccount: { iban: 'EG380019000500000000263180002' },
        },
      },
    });

    await expect(bus.stepEvaluateFieldPolicy(command)).rejects.toMatchObject({
      errorCode: 'FIELD_POLICY_DENIED',
    });
  });

  it('blocks direct command execution when an applied access policy hides the action', async () => {
    const query = {
      select: () => query,
      where: () => query,
      executeTakeFirst: async () => ({
        config: {
          policyGovernance: {
            allowedActionOverrides: [{
              id: 'deny-worker-update',
              active: true,
              aggregateType: 'WorkerProfile',
              action: 'UpdateWorkerPersonalData',
              roles: ['HR_ADMIN'],
              effect: 'HIDE',
              reason: 'Employees cannot update this worker section during policy freeze.',
            }],
            fieldAccessOverrides: [],
          },
        },
      }),
    };
    const bus = commandBusWith({
      db: {
        selectFrom: () => query,
      },
    });

    const command = makeCommand({
      actor: {
        actorType: 'USER',
        actorId: new Uuid('550e8400-e29b-41d4-a716-446655440017'),
        roles: ['HR_ADMIN'],
        permissions: ['WORKER_UPDATE'],
        mfaAuthenticated: true,
      },
    });

    await expect(bus.stepEvaluateRbac(command)).resolves.toBeUndefined();
    await expect(bus.stepEvaluateRuntimeAccessGovernance(command)).rejects.toMatchObject({
      errorCode: 'RUNTIME_POLICY_ACTION_DENIED',
    });
  });

  it('blocks direct command execution when an applied field policy denies a payload field', async () => {
    const query = {
      select: () => query,
      where: () => query,
      executeTakeFirst: async () => ({
        config: {
          policyGovernance: {
            allowedActionOverrides: [],
            fieldAccessOverrides: [{
              id: 'deny-bank-account',
              active: true,
              resourceType: 'WorkerProfile',
              fieldPath: 'homeAddress.line1',
              roles: ['EMPLOYEE'],
              decision: 'DENIED',
              reason: 'Home address changes require administrator review.',
            }],
          },
        },
      }),
    };
    const bus = commandBusWith({
      db: {
        selectFrom: () => query,
      },
    });

    const command = makeCommand({
      payload: {
        workerId,
        homeAddress: {
          line1: '12 Nile Street',
        },
      },
    });

    await expect(bus.stepEvaluateFieldPolicy(command)).resolves.toBeUndefined();
    await expect(bus.stepEvaluateRuntimeAccessGovernance(command)).rejects.toMatchObject({
      errorCode: 'RUNTIME_POLICY_FIELD_DENIED',
    });
  });

  it('blocks worker mutations while the subject worker has an active legal hold', async () => {
    const executeTakeFirst = async () => ({ id: workerId.value, legal_hold_status: 'ACTIVE' });
    const query = {
      select: () => query,
      where: () => query,
      executeTakeFirst,
    };
    const bus = commandBusWith({
      db: {
        selectFrom: () => query,
      },
    });

    await expect(bus.stepEvaluateLegalAndPolicy(makeCommand())).rejects.toMatchObject({
      errorCode: 'LEGAL_HOLD_BLOCKED',
    });
  });

  it('hydrates self-service employment status using the command tenant', async () => {
    const conditions: Array<[string, string, string]> = [];
    const query = {
      select: () => query,
      where: (field: string, operator: string, value: string) => {
        conditions.push([field, operator, value]);
        return query;
      },
      executeTakeFirst: async () => ({ status: 'ACTIVE' }),
    };
    const bus = commandBusWith({
      db: {
        selectFrom: () => query,
      },
    });

    const status = await bus.resolveActorEmploymentStatus(makeCommand(), 'EMPLOYEE');

    expect(status).toBe('ACTIVE');
    expect(conditions).toContainEqual(['tenant_id', '=', tenantId.value]);
  });

  it('validates manager subject access inside the command tenant', async () => {
    const conditions: Array<[string, string, string]> = [];
    const managerId = new Uuid('550e8400-e29b-41d4-a716-446655440015');
    const query = {
      select: () => query,
      where: (field: string, operator: string, value: string) => {
        conditions.push([field, operator, value]);
        return query;
      },
      executeTakeFirst: async () => ({ id: workerId.value }),
    };
    const bus = commandBusWith({
      db: {
        selectFrom: () => query,
      },
    });

    await bus.stepValidateSubjectWorkerAccess(makeCommand({
      actor: {
        actorType: 'USER',
        actorId: managerId,
        roles: ['MANAGER'],
        permissions: ['WORKER_UPDATE'],
        mfaAuthenticated: true,
      },
      subjectWorkerId: workerId,
    }));

    expect(conditions).toContainEqual(['tenant_id', '=', tenantId.value]);
  });

  it('maps workforce planning users to administrative command access for WFM mutations', async () => {
    const bus = commandBusWith();

    await expect(bus.stepEvaluateRbac(makeCommand({
      commandName: 'CreateShiftSchedule',
      actor: {
        actorType: 'USER',
        actorId: new Uuid('550e8400-e29b-41d4-a716-446655440016'),
        roles: ['WORKFORCE_PLANNING_ADMIN'],
        permissions: [],
        mfaAuthenticated: true,
      },
      aggregateType: 'ShiftSchedule',
      aggregateId: undefined,
      expectedState: undefined,
      expectedVersion: undefined,
      payload: {},
    }))).resolves.toBeUndefined();
  });

  it('blocks statically allowed commands when applied allowed-action overrides hide the command action', async () => {
    const query = {
      select: () => query,
      where: () => query,
      executeTakeFirst: async () => ({ status: 'ACTIVE' }),
    };
    const bus = commandBusWith({
      db: {
        selectFrom: () => query,
      },
      hcmSetup: {
        getSetup: async () => ({
          policyGovernance: {
            allowedActionOverrides: [
              {
                id: 'deny-submit-absence',
                active: true,
                aggregateType: 'AbsenceRequest',
                action: 'SubmitAbsenceRequest',
                roles: ['HR_ADMIN'],
                effect: 'HIDE',
                reason: 'Leave submissions are temporarily paused.',
              },
            ],
            fieldAccessOverrides: [],
          },
        }),
      },
    });

    const command = makeCommand({
      commandName: 'SubmitAbsenceRequest',
      aggregateType: 'AbsenceRequest',
      actor: {
        actorType: 'USER',
        actorId: new Uuid('550e8400-e29b-41d4-a716-446655440018'),
        roles: ['HR_ADMIN'],
        permissions: ['ABSENCE_ADMIN'],
        mfaAuthenticated: true,
      },
      payload: { workerId },
    });

    await expect(bus.stepEvaluateRbac(command)).resolves.toBeUndefined();
    await expect(bus.stepEvaluateRuntimeAccessGovernance(command)).rejects.toMatchObject({
      errorCode: 'RUNTIME_POLICY_ACTION_DENIED',
    });
  });

  it.each([
    ['leave', 'CreateAbsenceRequest', 'AbsenceRequest'],
    ['attendance', 'RecordTimeClockEvent', 'TimeClockEvent'],
    ['payroll', 'ApprovePayrollCycle', 'PayrollCycle'],
    ['access governance', 'CreateRole', 'AccessGovernanceRole'],
    ['compliance', 'RequirePolicyAcknowledgement', 'PolicyAcknowledgement'],
    ['country policy', 'ValidateCountryPolicyPack', 'CountryPolicyPack'],
    ['global HR policy', 'CreateWorkAuthorizationCase', 'WorkAuthorizationCase'],
    ['benefits', 'SubmitBenefitsEnrollment', 'BenefitsEnrollment'],
    ['onboarding', 'StartOnboarding', 'OnboardingPlan'],
    ['performance', 'CreateGoal', 'Goal'],
    ['service delivery', 'OpenHrServiceCase', 'HrServiceCase'],
    ['reporting', 'CreateReportDefinition', 'ReportDefinition'],
  ])('consumes applied access policy overrides before %s command execution', async (_domain, commandName, aggregateType) => {
    const bus = commandBusWith({
      hcmSetup: {
        getSetup: async () => ({
          policyGovernance: {
            allowedActionOverrides: [
              {
                id: `deny-${commandName}`,
                active: true,
                aggregateType,
                action: commandName,
                roles: ['HR_ADMIN'],
                effect: 'HIDE',
                reason: `Runtime policy blocks ${commandName}`,
              },
            ],
            fieldAccessOverrides: [],
          },
        }),
      },
    });

    await expect(bus.stepEvaluateRuntimeAccessGovernance(makeCommand({
      commandName,
      aggregateType,
      actor: {
        actorType: 'USER',
        actorId: new Uuid('550e8400-e29b-41d4-a716-446655440019'),
        roles: ['HR_ADMIN'],
        permissions: ['SYSTEM_ADMIN'],
        mfaAuthenticated: true,
      },
      payload: {},
    }))).rejects.toMatchObject({
      errorCode: 'RUNTIME_POLICY_ACTION_DENIED',
    });
  });

  it.each([
    ...governedPolicyCases,
    ['employee setup', 'EMPLOYEE_SETUP', 'CreateWorker', 'WorkerProfile'],
    ['DEI analytics', 'DEI_ANALYTICS', 'PublishPayEquityReview', 'PayEquityReview'],
    ['engagement', 'ENGAGEMENT', 'AwardRecognitionRecord', 'RecognitionRecord'],
  ])('maps %s governed commands to an applied policy prerequisite', (_domain, area, commandName, aggregateType) => {
    expect(requiredPolicyAreaForCommand(makeCommand({ commandName, aggregateType }))).toBe(area);
  });

  it('maps every registered domain command handler to a runtime policy prerequisite', () => {
    const unmapped = readCommandHandlerNames().filter((commandName) => (
      !requiredPolicyAreaForCommand(makeCommand({ commandName, aggregateType: 'UnmappedAggregate' }))
    ));

    expect(unmapped).toEqual([]);
  });

  it.each(governedPolicyCases)('fails closed for %s commands when matching applied runtime policy evidence is missing', async (
    _domain,
    area,
    commandName,
    aggregateType,
  ) => {
    const unrelatedArea = area === 'ACCESS_GOVERNANCE' ? 'LEAVE' : 'ACCESS_GOVERNANCE';
    const bus = commandBusWith({
      hcmSetup: {
        getSetup: async () => ({
          runtimePolicyRevisions: [{
            area: unrelatedArea,
            revisionId: `policy-${unrelatedArea}`,
            status: 'APPLIED',
            appliedAt: '2026-06-07T10:00:00.000Z',
            engineName: 'PolicyApplicationEngine',
            engineVersion: '1.0.0',
          }],
        }),
      },
    });

    await expect(bus.stepEnforceAppliedPolicyRevision(makeCommand({
      commandName,
      aggregateType,
      payload: { workerId },
    }))).rejects.toMatchObject({
      errorCode: 'REQUIRED_POLICY_REVISION_NOT_APPLIED',
      errorMessage: expect.stringContaining(`${area} commands require an applied Policy Center revision`),
    });
  });

  it.each(governedPolicyCases)('allows %s commands when matching applied runtime policy evidence exists', async (
    _domain,
    area,
    commandName,
    aggregateType,
  ) => {
    const bus = commandBusWith({
      hcmSetup: {
        getSetup: async () => ({
          runtimePolicyRevisions: [{
            area,
            revisionId: `policy-${area}`,
            status: 'APPLIED',
            appliedAt: '2026-06-07T10:00:00.000Z',
            engineName: 'PolicyApplicationEngine',
            engineVersion: '1.0.0',
          }],
        }),
      },
    });

    await expect(bus.stepEnforceAppliedPolicyRevision(makeCommand({
      commandName,
      aggregateType,
      payload: { workerId },
    }))).resolves.toMatchObject({
      serviceArea: area,
      policyRevisionId: `policy-${area}`,
      decision: 'ALLOWED',
      commandName,
      aggregateType,
      subjectWorkerId: workerId.value,
    });
  });

  it.each([
    ['attendance', 'ATTENDANCE', 'RecordTimeClockEvent', 'TimeClockEvent'],
    ['leave approval', 'LEAVE', 'ApproveAbsenceRequest', 'AbsenceRequest'],
    ['payroll deduction', 'PAYROLL', 'CorrectPayrollInput', 'PayrollInput'],
    ['payroll approval', 'PAYROLL', 'ApprovePayrollCycle', 'PayrollCycle'],
    ['benefits', 'BENEFITS', 'SubmitBenefitsEnrollment', 'BenefitsEnrollment'],
  ])('fails closed for conflicting applied %s policy evidence', async (
    _domain,
    area,
    commandName,
    aggregateType,
  ) => {
    const bus = commandBusWith({
      hcmSetup: {
        getSetup: async () => ({
          runtimePolicyRevisions: [
            {
              area,
              revisionId: `${area}-revision-a`,
              status: 'APPLIED',
              appliedAt: '2026-06-07T10:00:00.000Z',
              engineName: 'PolicyApplicationEngine',
              engineVersion: '1.0.0',
            },
            {
              area,
              revisionId: `${area}-revision-b`,
              status: 'APPLIED',
              appliedAt: '2026-06-08T10:00:00.000Z',
              engineName: 'PolicyApplicationEngine',
              engineVersion: '1.0.0',
            },
          ],
        }),
      },
    });

    await expect(bus.stepEnforceAppliedPolicyRevision(makeCommand({
      commandName,
      aggregateType,
      payload: { workerId, deductionAmount: 25 },
    }))).rejects.toMatchObject({
      errorCode: 'CONFLICTING_POLICY_REVISIONS_APPLIED',
      errorDetails: {
        policyDecisionEvidence: expect.objectContaining({
          serviceArea: area,
          decision: 'DENIED',
          commandName,
          aggregateType,
          conflictingPolicyRevisionIds: [`${area}-revision-a`, `${area}-revision-b`],
        }),
      },
    });
  });

  it.each([
    ['GLOBAL_HR', 'CreateWorkAuthorizationCase', 'WorkAuthorizationCase'],
    ['DEI_ANALYTICS', 'ReviewDeiReport', 'DeiReport'],
    ['ENGAGEMENT', 'PublishEngagementSurvey', 'EngagementSurvey'],
  ])('fails closed for %s commands until a first-class applied policy revision exists', async (area, commandName, aggregateType) => {
    const bus = commandBusWith({
      hcmSetup: {
        getSetup: async () => ({
          runtimePolicyRevisions: [{
            area: 'ACCESS_GOVERNANCE',
            revisionId: 'generic-access',
            status: 'APPLIED',
            appliedAt: '2026-06-07T10:00:00.000Z',
            engineName: 'PolicyApplicationEngine',
            engineVersion: '1.0.0',
          }],
        }),
      },
    });

    await expect(bus.stepEnforceAppliedPolicyRevision(makeCommand({
      commandName,
      aggregateType,
      payload: {},
    }))).rejects.toMatchObject({
      errorCode: 'REQUIRED_POLICY_REVISION_NOT_APPLIED',
      errorMessage: expect.stringContaining(`${area} commands require an applied Policy Center revision`),
    });
  });

  it.each([
    ['GLOBAL_HR', 'CreateWorkAuthorizationCase', 'WorkAuthorizationCase'],
    ['DEI_ANALYTICS', 'ReviewDeiReport', 'DeiReport'],
    ['ENGAGEMENT', 'PublishEngagementSurvey', 'EngagementSurvey'],
  ])('allows %s commands when the matching first-class runtime policy is applied', async (area, commandName, aggregateType) => {
    const bus = commandBusWith({
      hcmSetup: {
        getSetup: async () => ({
          runtimePolicyRevisions: [{
            area,
            revisionId: `policy-${area}`,
            status: 'APPLIED',
            appliedAt: '2026-06-07T10:00:00.000Z',
            engineName: 'PolicyApplicationEngine',
            engineVersion: '1.0.0',
          }],
        }),
      },
    });

    await expect(bus.stepEnforceAppliedPolicyRevision(makeCommand({
      commandName,
      aggregateType,
      payload: {},
    }))).resolves.toMatchObject({
      serviceArea: area,
      policyRevisionId: `policy-${area}`,
      decision: 'ALLOWED',
      commandName,
      aggregateType,
    });
  });

  it('writes the same applied policy decision evidence to audit and the Policy Center evidence ledger', async () => {
    const inserted: Array<{ table: string; row: Record<string, unknown> }> = [];
    const tx = {
      insertInto: (table: string) => ({
        values: (row: Record<string, unknown>) => ({
          execute: async () => {
            inserted.push({ table, row });
          },
        }),
      }),
    };
    const evidence = {
      serviceArea: 'LEAVE',
      policyRevisionId: '550e8400-e29b-41d4-a716-446655440099',
      engineName: 'PolicyApplicationEngine',
      engineVersion: '1.0.0',
      scopeMatch: { tenantId: tenantId.value },
      decision: 'ALLOWED',
      reason: 'Applied policy revision authorizes SubmitAbsenceRequest.',
      commandName: 'SubmitAbsenceRequest',
      aggregateType: 'AbsenceRequest',
      subjectWorkerId: workerId.value,
      sourceRecordId: workerId.value,
    };
    const bus = commandBusWith();

    await bus.stepWriteAuditRecord(tx, makeCommand({
      commandName: 'SubmitAbsenceRequest',
      aggregateType: 'AbsenceRequest',
      payload: { workerId },
    }), commandResult(), evidence);
    await bus.stepWritePolicyDecisionEvidence(tx, makeCommand({
      commandName: 'SubmitAbsenceRequest',
      aggregateType: 'AbsenceRequest',
      payload: { workerId },
    }), commandResult(), evidence);

    expect(inserted).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'audit_log',
        row: expect.objectContaining({
          payload: expect.objectContaining({
            policyDecisionEvidence: [evidence],
          }),
        }),
      }),
      expect.objectContaining({
        table: 'hr_platform.admin_policy_decision_evidence',
        row: expect.objectContaining({
          tenant_id: tenantId.value,
          policy_revision_id: evidence.policyRevisionId,
          service_area: 'LEAVE',
          decision: 'ALLOWED',
          subject_worker_id: workerId.value,
          source_record_id: workerId.value,
        }),
      }),
    ]));
  });

  it('keeps bootstrap policy decision evidence in command/audit payloads without writing invalid FK rows', async () => {
    const inserted: Array<{ table: string; row: Record<string, unknown> }> = [];
    const tx = {
      insertInto: (table: string) => ({
        values: (row: Record<string, unknown>) => ({
          execute: async () => {
            inserted.push({ table, row });
          },
        }),
      }),
    };
    const evidence = {
      serviceArea: 'BENEFITS',
      policyRevisionId: 'SYSTEM_BOOTSTRAP_BENEFITS',
      engineName: 'BootstrapPolicyRuntime',
      engineVersion: '1.0.0',
      scopeMatch: { tenantId: tenantId.value },
      decision: 'ALLOWED',
      reason: 'Bootstrap runtime policy authorizes SubmitBenefitsEnrollment.',
      commandName: 'SubmitBenefitsEnrollment',
      aggregateType: 'BenefitsEnrollment',
      subjectWorkerId: workerId.value,
      sourceRecordId: workerId.value,
    };
    const bus = commandBusWith();

    await bus.stepWritePolicyDecisionEvidence(tx, makeCommand({
      commandName: 'SubmitBenefitsEnrollment',
      aggregateType: 'BenefitsEnrollment',
      payload: { workerId },
    }), commandResult(), evidence);

    expect(inserted).toEqual([]);
  });

  it('blocks command payload writes when applied field-access overrides deny the written field', async () => {
    const bus = commandBusWith({
      hcmSetup: {
        getSetup: async () => ({
          policyGovernance: {
            allowedActionOverrides: [],
            fieldAccessOverrides: [
              {
                id: 'deny-hr-home-address',
                active: true,
                resourceType: 'WorkerProfile',
                fieldPath: 'homeAddress.line1',
                roles: ['HR_ADMIN'],
                decision: 'DENIED',
                reason: 'Address updates are locked during audit.',
              },
            ],
          },
        }),
      },
    });

    const command = makeCommand({
      actor: {
        actorType: 'USER',
        actorId: new Uuid('550e8400-e29b-41d4-a716-446655440017'),
        roles: ['HR_ADMIN'],
        permissions: ['WORKER_UPDATE'],
        mfaAuthenticated: true,
      },
      payload: {
        workerId,
        homeAddress: {
          line1: '12 Nile Street',
        },
      },
    });

    await expect(bus.stepEvaluateFieldPolicy(command)).resolves.toBeUndefined();
    await expect(bus.stepEvaluateRuntimeAccessGovernance(command)).rejects.toMatchObject({
      errorCode: 'RUNTIME_POLICY_FIELD_DENIED',
    });
  });

  it('enforces the self-service policy engine before executing employee commands', async () => {
    const bus = commandBusWith();

    await expect(bus.stepEvaluatePolicyEngine(makeCommand({
      commandName: 'ApprovePayrollCycle',
      aggregateType: 'PayrollCycle',
      payload: { workerId },
      metadata: { requestHash: 'hash', clientType: 'EMPLOYEE_PORTAL' },
    }))).rejects.toMatchObject({
      errorCode: 'POLICY_ENGINE_DENIED',
    });
  });

  it('stores event privacy evidence in outbox metadata for notification targeting', async () => {
    const inserted: Array<{ table: string; row: Record<string, unknown> }> = [];
    const tx = {
      insertInto: (table: string) => ({
        values: (row: Record<string, unknown>) => ({
          execute: async () => {
            inserted.push({ table, row });
          },
        }),
      }),
    };
    const bus = commandBusWith();

    const evidence = {
      serviceArea: 'LEAVE',
      policyRevisionId: '550e8400-e29b-41d4-a716-446655440099',
      engineName: 'PolicyApplicationEngine',
      engineVersion: '1.0.0',
      scopeMatch: { tenantId: tenantId.value },
      decision: 'ALLOWED',
      reason: 'Applied policy revision authorizes SubmitAbsenceRequest.',
      commandName: 'SubmitAbsenceRequest',
      aggregateType: 'AbsenceRequest',
      subjectWorkerId: workerId.value,
      sourceRecordId: workerId.value,
    };

    await bus.stepWriteOutbox(tx, makeCommand({
      subjectWorkerId: undefined,
      payload: { workerId },
      metadata: { requestHash: 'hash', clientType: 'EMPLOYEE_PORTAL', hrDataSensitivity: 'LOW' },
    }), {
      success: true,
      data: { workerId: workerId.value, status: 'SUBMITTED' },
      commandId: new Uuid('550e8400-e29b-41d4-a716-446655440011'),
      correlationId: new Uuid('550e8400-e29b-41d4-a716-446655440013'),
      aggregateId: workerId,
      newState: 'SUBMITTED',
      newVersion: 3,
      allowedNextActions: [],
      fieldAccessDecisions: {},
      eventsEmitted: ['AbsenceRequestSubmitted'],
      auditRecordId: new Uuid('550e8400-e29b-41d4-a716-446655440014'),
    }, evidence);

    expect(inserted[0]?.row.metadata).toMatchObject({
      privacy: {
        piiClassification: 'LOW',
        subjectWorkerId: workerId.value,
      },
      policyDecisionEvidence: [evidence],
    });
  });
});
