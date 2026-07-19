/**
 * Regression coverage for the "dropped cascading events" bug.
 *
 * create-worker.handler.ts, terminate-worker.handler.ts, and
 * update-worker-personal-data.handler.ts each touch several aggregates in a
 * single command (WorkerProfile + EmploymentRelationship + N x
 * PersonalDataRecord for create; WorkerProfile + JobAssignment(s) +
 * EmploymentRelationship(s) for terminate; WorkerProfile + PersonalDataRecord
 * for update). Before the fix, `eventsEmitted` on the CommandResult only
 * included the PRIMARY aggregate's (WorkerProfile's) domain events, so every
 * cascading event computed and persisted for the other touched aggregates
 * was silently dropped before it ever reached the outbox-write step --
 * meaning it never became an outbox row and no consumer (audit, IAM
 * provisioning, notifications, projections, ...) ever saw it.
 *
 * These tests exercise the real handlers against mocked repositories to get
 * a real `CommandResult`, then feed that result into the *real*
 * `OutboxStep.write` step (the same pattern used in
 * command-bus.security.test.ts) with a fake `tx` that records every insert.
 * This verifies actual outbox row counts/event names end-to-end, not just
 * that `domainEvents` was read on some aggregate.
 */
import { describe, expect, it, vi } from 'vitest';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid, Email } from '@hcm/shared-kernel';
import { OutboxStep } from '../../../platform/command-bus/steps/outbox.step.js';
import { WorkerProfile } from '../aggregates/worker-profile.aggregate.js';
import { EmploymentRelationship } from '../aggregates/employment-relationship.aggregate.js';
import { JobAssignment } from '../aggregates/job-assignment.aggregate.js';
import { PersonalDataRecord } from '../aggregates/personal-data-record.aggregate.js';
import { CreateWorkerHandler } from './create-worker.handler.js';
import { TerminateWorkerHandler } from './terminate-worker.handler.js';
import { UpdateWorkerPersonalDataHandler } from './update-worker-personal-data.handler.js';

const tenantId = new Uuid('550e8400-e29b-41d4-a716-446655440001');
const workerId = new Uuid('550e8400-e29b-41d4-a716-446655440002');
const actorId = new Uuid('550e8400-e29b-41d4-a716-446655440003');

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
    effectiveDate: options.effectiveDate,
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

function worker(status: WorkerProfile['status']): WorkerProfile {
  return new WorkerProfile({
    id: workerId,
    tenantId,
    employeeNumber: 'EMP-001',
    status,
    firstName: 'Amina',
    lastName: 'Nour',
    email: new Email('amina.nour@example.com'),
    hireDate: new Date('2024-01-01'),
    employmentType: 'FULL_TIME',
  });
}

function fakeOutboxTx() {
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
  return { tx, inserted };
}

const fsm = { getAllowedActionsFromState: vi.fn(() => ['NextAction']) };
const eventPublisher = { publishFromAggregate: vi.fn() };

describe('Cascading domain events reach the outbox for every touched aggregate', () => {
  it('CreateWorker: publishes events for WorkerProfile + EmploymentRelationship + every PersonalDataRecord created, not just WorkerProfile', async () => {
    const workerRepo = {
      findByEmailForTenant: vi.fn().mockResolvedValue(undefined),
      findByEmployeeNumberForTenant: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const employmentRelationshipRepo = { save: vi.fn().mockResolvedValue(undefined) };
    const personalDataRepo = {
      findByPayloadFieldForTenant: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const hcmSetup = {
      getSetup: vi.fn().mockResolvedValue({
        employeeIdPolicy: { mode: 'AUTO', prefix: 'EMP', nextNumber: 1 },
        departments: [],
        jobTitles: [],
        documentRequirements: [],
        genderOptions: [],
        workPhoneEnabled: true,
        locations: [],
        cities: [],
        socialMediaFields: [],
        payrollCalculationPolicy: { taxRatePercent: 15, employeeInsuranceRatePercent: 7 },
        fieldRules: [],
      }),
    };

    const handler = new CreateWorkerHandler(
      workerRepo as never,
      employmentRelationshipRepo as never,
      personalDataRepo as never,
      fsm as never,
      eventPublisher as never,
      hcmSetup as never,
    );

    const cmd = command(
      'CreateWorker',
      'WorkerProfile',
      {
        workerId,
        firstName: 'Amina',
        lastName: 'Hassan',
        email: 'amina.hassan@example.com',
        // Populates BASIC personal-data record.
        phoneNumber: '+201001112233',
        // Populates CONTACT personal-data record.
        address: { line1: '12 Nile St', city: 'Cairo', country: 'EG' },
        // Populates BANKING personal-data record.
        bankAccount: { bankName: 'National Bank', iban: 'EG380019000500000000263180002' },
        // The employment-eligibility hire gate (I-9/E-Verify PR) fails closed
        // on missing work-authorization data.
        workAuthorization: { status: 'AUTHORIZED' },
      },
      { effectiveDate: new Date('2024-01-01') }, // triggers EmploymentRelationship creation
    );

    const result = await handler.handle(cmd);

    // BEFORE the fix this would have been just ['WorkerProfileCreated'] --
    // EmploymentRelationshipCreated and every PersonalDataRecordCreated were
    // computed, saved to the DB, and then silently discarded.
    expect(result.eventsEmitted).toEqual(
      expect.arrayContaining([
        'WorkerProfileCreated',
        'EmploymentRelationshipCreated',
        'PersonalDataRecordCreated', // BASIC
      ]),
    );
    // One WorkerProfileCreated + one EmploymentRelationshipCreated + one
    // PersonalDataRecordCreated per non-empty profile section (BASIC,
    // CONTACT, BANKING, WORK_AUTHORIZATION => 4). WORK_AUTHORIZATION is
    // populated because the payload supplies `workAuthorization` to satisfy
    // the employment-eligibility hire gate (I-9/E-Verify PR).
    expect(result.eventsEmitted).toHaveLength(1 + 1 + 4);
    expect(result.eventsEmitted!.filter((e) => e === 'PersonalDataRecordCreated')).toHaveLength(4);

    // Now prove those events actually reach the outbox (not just that the
    // handler *computed* a bigger array).
    const { tx, inserted } = fakeOutboxTx();
    const outboxStep = new OutboxStep();
    await outboxStep.write(tx as never, cmd, result as never);

    expect(inserted).toHaveLength(result.eventsEmitted!.length);
    expect(inserted.map((row) => row.row.event_name)).toEqual(result.eventsEmitted);
    expect(inserted.filter((row) => row.row.event_name === 'EmploymentRelationshipCreated')).toHaveLength(1);
    expect(inserted.filter((row) => row.row.event_name === 'PersonalDataRecordCreated')).toHaveLength(4);
  });

  it('TerminateWorker: publishes events for WorkerProfile + every active JobAssignment ended + every non-ended EmploymentRelationship ended', async () => {
    const activeWorker = worker('ACTIVE');
    const workerRepo = {
      findByIdForTenant: vi.fn().mockResolvedValue(activeWorker),
      save: vi.fn().mockResolvedValue(undefined),
    };

    const assignment1 = new JobAssignment({
      id: new Uuid('550e8400-e29b-41d4-a716-446655440010'),
      tenantId,
      workerId,
      startDate: new Date('2024-01-01'),
      assignmentType: 'PRIMARY',
      state: 'ACTIVE',
    });
    const assignment2 = new JobAssignment({
      id: new Uuid('550e8400-e29b-41d4-a716-446655440011'),
      tenantId,
      workerId,
      startDate: new Date('2024-01-01'),
      assignmentType: 'SECONDARY',
      state: 'DRAFT', // not ACTIVE -> handler must skip this one
    });
    const jobAssignmentRepo = {
      findByWorkerForTenant: vi.fn().mockResolvedValue([assignment1, assignment2]),
      save: vi.fn().mockResolvedValue(undefined),
    };

    const relationship1 = new EmploymentRelationship({
      id: new Uuid('550e8400-e29b-41d4-a716-446655440012'),
      tenantId,
      workerId,
      relationshipType: 'EMPLOYEE',
      startDate: new Date('2024-01-01'),
      state: 'ACTIVE',
    });
    const relationship2 = new EmploymentRelationship({
      id: new Uuid('550e8400-e29b-41d4-a716-446655440013'),
      tenantId,
      workerId,
      relationshipType: 'CONTRACTOR',
      startDate: new Date('2024-01-01'),
      state: 'ENDED', // already ended -> handler must skip this one
    });
    const employmentRelationshipRepo = {
      findByWorkerForTenant: vi.fn().mockResolvedValue([relationship1, relationship2]),
      save: vi.fn().mockResolvedValue(undefined),
    };

    const handler = new TerminateWorkerHandler(
      workerRepo as never,
      jobAssignmentRepo as never,
      employmentRelationshipRepo as never,
      fsm as never,
      eventPublisher as never,
    );

    const cmd = command(
      'TerminateWorker',
      'WorkerProfile',
      { workerId, terminationDate: new Date('2024-12-31'), reason: 'Resignation' },
      { aggregateId: workerId },
    );

    const result = await handler.handle(cmd);

    // BEFORE the fix this would have been just ['WorkerTerminated'] --
    // JobAssignmentEnded and EmploymentRelationshipEnded were computed,
    // saved to the DB, and then silently discarded.
    expect(result.eventsEmitted).toEqual([
      'WorkerTerminated',
      'JobAssignmentEnded',
      'EmploymentRelationshipEnded',
    ]);

    const { tx, inserted } = fakeOutboxTx();
    const outboxStep = new OutboxStep();
    await outboxStep.write(tx as never, cmd, result as never);

    expect(inserted).toHaveLength(3);
    expect(inserted.map((row) => row.row.event_name)).toEqual([
      'WorkerTerminated',
      'JobAssignmentEnded',
      'EmploymentRelationshipEnded',
    ]);
    // Only the ACTIVE assignment and non-ENDED relationship were touched.
    expect(assignment1.state).toBe('ENDED');
    expect(assignment2.state).toBe('DRAFT');
    expect(relationship1.state).toBe('ENDED');
    expect(jobAssignmentRepo.save).toHaveBeenCalledTimes(1);
    expect(employmentRelationshipRepo.save).toHaveBeenCalledTimes(1);
  });

  it('UpdateWorkerPersonalData: publishes events for WorkerProfile + the touched PersonalDataRecord, not just WorkerProfile', async () => {
    const activeWorker = worker('ACTIVE');
    const workerRepo = {
      findByIdForTenant: vi.fn().mockResolvedValue(activeWorker),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const existingRecord = new PersonalDataRecord({
      id: new Uuid('550e8400-e29b-41d4-a716-446655440020'),
      tenantId,
      workerId,
      dataCategory: 'BASIC',
      dataClassification: 'CONFIDENTIAL',
      payload: { phoneNumber: '+201000000000' },
      consentStatus: 'GRANTED',
      state: 'ACTIVE',
    });
    const personalDataRepo = {
      findByWorkerAndCategory: vi.fn().mockResolvedValue(existingRecord),
      save: vi.fn().mockResolvedValue(undefined),
    };

    const handler = new UpdateWorkerPersonalDataHandler(
      workerRepo as never,
      personalDataRepo as never,
      fsm as never,
      eventPublisher as never,
    );

    const cmd = command(
      'UpdateWorkerPersonalData',
      'WorkerProfile',
      { workerId, firstName: 'Amina Updated', phoneNumber: '+201009998877' },
      { aggregateId: workerId },
    );

    const result = await handler.handle(cmd);

    // BEFORE the fix this would have been just ['PersonalDataUpdated'] --
    // the PersonalDataRecord's own PersonalDataRecordUpdated event was
    // computed, saved to the DB, and then silently discarded.
    expect(result.eventsEmitted).toEqual(['PersonalDataUpdated', 'PersonalDataRecordUpdated']);

    const { tx, inserted } = fakeOutboxTx();
    const outboxStep = new OutboxStep();
    await outboxStep.write(tx as never, cmd, result as never);

    expect(inserted).toHaveLength(2);
    expect(inserted.map((row) => row.row.event_name)).toEqual([
      'PersonalDataUpdated',
      'PersonalDataRecordUpdated',
    ]);
  });
});
