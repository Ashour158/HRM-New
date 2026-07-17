import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor, HrCommandEnvelope } from '@hcm/command-contracts';
import { I9Case } from '../aggregates/i9-case.aggregate.js';
import { EverifyCase } from '../aggregates/everify-case.aggregate.js';
import { CreateI9CaseHandler } from './create-i9-case.handler.js';
import {
  CompleteI9CaseSection1Handler,
  CompleteI9CaseSection2Handler,
  RejectI9CaseHandler,
} from './i9-case-lifecycle.handlers.js';
import {
  SubmitEverifyCaseHandler,
  RecordEverifyResultHandler,
  ContestEverifyTentativeNonconfirmationHandler,
} from './everify-case-lifecycle.handlers.js';
import type { I9CaseRepository } from '../repositories/i9-case.repository.js';
import type { EverifyCaseRepository } from '../repositories/everify-case.repository.js';
import type { I9EverifyEventsPublisher } from '../events/i9-everify-events.publisher.js';
import type { EverifyAdapter } from '../../../integrations/adapters/everify.adapter.js';
import type { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actorId = new Uuid('00000000-0000-0000-0000-000000000010');
const workerId = new Uuid('00000000-0000-0000-0000-000000000020');
const i9CaseId = new Uuid('00000000-0000-0000-0000-000000000030');
const everifyCaseId = new Uuid('00000000-0000-0000-0000-000000000040');

function actor(): HrActor {
  return {
    actorType: 'USER',
    actorId,
    roles: ['HR_ADMIN'],
    permissions: ['I9_WRITE'],
    email: 'i9.admin@example.com',
    mfaAuthenticated: true,
  };
}

function envelope<T>(commandName: string, aggregateType: string, aggregateId: Uuid, payload: T): HrCommandEnvelope<T> {
  return {
    commandId: Uuid.generate(),
    commandName,
    commandSchemaVersion: 1,
    tenantId,
    actor: actor(),
    aggregateType,
    aggregateId,
    idempotencyKey: `${commandName}-${Date.now()}`,
    correlationId: Uuid.generate(),
    reason: 'spec',
    payload,
    metadata: { requestHash: 'hash', clientType: 'HR_ADMIN' },
  };
}

function fsm() {
  return {
    getAllowedActionsFromState: vi.fn(() => ['Next']),
  } as unknown as FsmFramework;
}

function eventsPublisher() {
  return { publishUncommitted: vi.fn(async () => undefined) } as unknown as I9EverifyEventsPublisher;
}

describe('I9/E-Verify command handlers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates an I9 case in DRAFT with a computed Section 2 due date', async () => {
    const repo = { save: vi.fn() } as unknown as I9CaseRepository;
    const handler = new CreateI9CaseHandler(repo, eventsPublisher());

    const result = await handler.handle(
      envelope('CreateI9Case', 'I9Case', i9CaseId, {
        i9CaseId,
        workerId,
        startDate: new Date('2026-07-01T00:00:00.000Z'),
      }),
    );

    expect(result.success).toBe(true);
    expect(result.newState).toBe('DRAFT');
    expect(result.eventsEmitted).toContain('I9CaseCreated');
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'DRAFT', workerId }));
  });

  it('completes Section 1 and reports lateness relative to the start date', async () => {
    const i9Case = new I9Case({
      id: i9CaseId,
      tenantId,
      workerId,
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      status: 'DRAFT',
      aggregateVersion: 0,
    });
    const repo = {
      findById: vi.fn(async () => i9Case),
      save: vi.fn(),
    } as unknown as I9CaseRepository;
    const handler = new CompleteI9CaseSection1Handler(repo, fsm(), eventsPublisher());

    const result = await handler.handle(
      envelope('CompleteI9CaseSection1', 'I9Case', i9CaseId, {
        i9CaseId,
        citizenshipStatus: 'US_CITIZEN',
        section1CompletedAt: new Date('2026-07-05T00:00:00.000Z'),
      }),
    );

    expect(result.success).toBe(true);
    expect(result.newState).toBe('SECTION1_COMPLETED');
    expect(result.data).toEqual(expect.objectContaining({ section1LateFlag: true }));
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'SECTION1_COMPLETED' }));
  });

  it('completes Section 2 and rejects the case', async () => {
    const i9Case = new I9Case({
      id: i9CaseId,
      tenantId,
      workerId,
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      status: 'SECTION1_COMPLETED',
      aggregateVersion: 1,
    });
    const repo = {
      findById: vi.fn(async () => i9Case),
      save: vi.fn(),
    } as unknown as I9CaseRepository;
    const section2Handler = new CompleteI9CaseSection2Handler(repo, fsm(), eventsPublisher());

    const section2Result = await section2Handler.handle(
      envelope('CompleteI9CaseSection2', 'I9Case', i9CaseId, {
        i9CaseId,
        documentType: 'LIST_A',
        documentDescriptions: ['US Passport'],
        reviewerId: Uuid.generate(),
      }),
    );
    expect(section2Result.newState).toBe('SECTION2_VERIFIED');

    const rejectHandler = new RejectI9CaseHandler(repo, fsm(), eventsPublisher());
    const rejectResult = await rejectHandler.handle(
      envelope('RejectI9Case', 'I9Case', i9CaseId, {
        i9CaseId,
        reason: 'Document did not reasonably appear genuine',
      }),
    );
    expect(rejectResult.newState).toBe('REJECTED');
    expect(rejectResult.eventsEmitted).toContain('I9CaseRejected');
  });

  it('submits an E-Verify case via the adapter and advances the I9 case', async () => {
    const i9Case = new I9Case({
      id: i9CaseId,
      tenantId,
      workerId,
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      status: 'SECTION2_VERIFIED',
      documentType: 'LIST_A',
      aggregateVersion: 2,
    });
    const i9CaseRepo = {
      findById: vi.fn(async () => i9Case),
      save: vi.fn(),
    } as unknown as I9CaseRepository;
    const everifyCaseRepo = { save: vi.fn() } as unknown as EverifyCaseRepository;
    const everifyAdapter = {
      submitCase: vi.fn(async () => ({
        success: true,
        adapterName: 'everify-case-submission',
        operationId: 'op-1',
        timestamp: new Date(),
        caseNumber: 'MOCK-EV-123',
        determination: 'CONFIRMED',
        details: { mock: true, reason: 'EVERIFY_CREDENTIALS_NOT_CONFIGURED' },
      })),
    } as unknown as EverifyAdapter;
    const handler = new SubmitEverifyCaseHandler(i9CaseRepo, everifyCaseRepo, everifyAdapter, fsm(), eventsPublisher());

    const result = await handler.handle(
      envelope('SubmitEverifyCase', 'I9Case', i9CaseId, {
        i9CaseId,
        firstName: 'Jordan',
        lastName: 'Rivera',
      }),
    );

    expect(everifyAdapter.submitCase).toHaveBeenCalled();
    expect(result.newState).toBe('EVERIFY_SUBMITTED');
    expect(everifyCaseRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'SUBMITTED', caseNumber: 'MOCK-EV-123', simulatedDetermination: 'CONFIRMED' }),
    );
    expect(i9CaseRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'EVERIFY_SUBMITTED' }));
  });

  it('fails the SubmitEverifyCase command when the adapter reports failure', async () => {
    const i9Case = new I9Case({
      id: i9CaseId,
      tenantId,
      workerId,
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      status: 'SECTION2_VERIFIED',
      aggregateVersion: 2,
    });
    const i9CaseRepo = { findById: vi.fn(async () => i9Case), save: vi.fn() } as unknown as I9CaseRepository;
    const everifyCaseRepo = { save: vi.fn() } as unknown as EverifyCaseRepository;
    const everifyAdapter = {
      submitCase: vi.fn(async () => ({
        success: false,
        adapterName: 'everify-case-submission',
        operationId: 'op-2',
        timestamp: new Date(),
        error: 'endpoint unreachable',
      })),
    } as unknown as EverifyAdapter;
    const handler = new SubmitEverifyCaseHandler(i9CaseRepo, everifyCaseRepo, everifyAdapter, fsm(), eventsPublisher());

    await expect(
      handler.handle(
        envelope('SubmitEverifyCase', 'I9Case', i9CaseId, {
          i9CaseId,
          firstName: 'Jordan',
          lastName: 'Rivera',
        }),
      ),
    ).rejects.toThrow(/E-Verify submission failed/);
    expect(i9CaseRepo.save).not.toHaveBeenCalled();
  });

  it('records an E-Verify result and mirrors it onto the I9 case, then supports contest -> confirm', async () => {
    const i9Case = new I9Case({
      id: i9CaseId,
      tenantId,
      workerId,
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      status: 'EVERIFY_SUBMITTED',
      everifyCaseId,
      aggregateVersion: 3,
    });
    const everifyCase = new EverifyCase({
      id: everifyCaseId,
      tenantId,
      workerId,
      i9CaseId,
      status: 'SUBMITTED',
      aggregateVersion: 1,
    });
    const i9CaseRepo = {
      findById: vi.fn(async () => i9Case),
      save: vi.fn(),
    } as unknown as I9CaseRepository;
    const everifyCaseRepo = {
      findById: vi.fn(async () => everifyCase),
      save: vi.fn(),
    } as unknown as EverifyCaseRepository;

    const recordHandler = new RecordEverifyResultHandler(i9CaseRepo, everifyCaseRepo, fsm(), eventsPublisher());
    const tncResult = await recordHandler.handle(
      envelope('RecordEverifyResult', 'I9Case', i9CaseId, {
        everifyCaseId,
        result: 'TENTATIVE_NONCONFIRMATION',
      }),
    );
    expect(tncResult.newState).toBe('EVERIFY_TNC');
    expect(everifyCase.status).toBe('TENTATIVE_NONCONFIRMATION');

    const contestHandler = new ContestEverifyTentativeNonconfirmationHandler(i9CaseRepo, everifyCaseRepo, fsm(), eventsPublisher());
    const contestResult = await contestHandler.handle(
      envelope('ContestEverifyTentativeNonconfirmation', 'I9Case', i9CaseId, { everifyCaseId }),
    );
    expect(contestResult.newState).toBe('EVERIFY_TNC_CONTESTED');

    const finalResult = await recordHandler.handle(
      envelope('RecordEverifyResult', 'I9Case', i9CaseId, {
        everifyCaseId,
        result: 'CONFIRMED',
        recordedBy: actorId,
      }),
    );
    expect(finalResult.newState).toBe('EVERIFY_CONFIRMED');
    expect(everifyCase.status).toBe('CONFIRMED');
    expect(everifyCase.resultRecordedBy).toBe(actorId);
  });

  it('falls back to the adapter-reported simulated determination when RecordEverifyResult omits an explicit result', async () => {
    const i9Case = new I9Case({
      id: i9CaseId,
      tenantId,
      workerId,
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      status: 'EVERIFY_SUBMITTED',
      everifyCaseId,
      aggregateVersion: 3,
    });
    const everifyCase = new EverifyCase({
      id: everifyCaseId,
      tenantId,
      workerId,
      i9CaseId,
      status: 'SUBMITTED',
      simulatedDetermination: 'CONFIRMED',
      aggregateVersion: 1,
    });
    const i9CaseRepo = { findById: vi.fn(async () => i9Case), save: vi.fn() } as unknown as I9CaseRepository;
    const everifyCaseRepo = { findById: vi.fn(async () => everifyCase), save: vi.fn() } as unknown as EverifyCaseRepository;
    const handler = new RecordEverifyResultHandler(i9CaseRepo, everifyCaseRepo, fsm(), eventsPublisher());

    const result = await handler.handle(
      envelope('RecordEverifyResult', 'I9Case', i9CaseId, { everifyCaseId }),
    );

    expect(result.newState).toBe('EVERIFY_CONFIRMED');
  });
});
