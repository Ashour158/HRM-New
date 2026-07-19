import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import type { CaseSeverity } from '@hcm/policy-engines';
import type { HrActor, HrCommandEnvelope } from '@hcm/command-contracts';
import { DisciplinaryAction } from '../aggregates/disciplinary-action.aggregate.js';
import type { DisciplinaryActionRepository } from '../repositories/disciplinary-action.repository.js';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { registerDisciplinaryActionFsm } from '../fsm/disciplinary-action.fsm.js';
import { EmployeeRelationsEventsPublisher } from '../events/employee-relations-events.publisher.js';
import { ExecuteDisciplinaryActionHandler } from './execute-disciplinary-action.handler.js';
import { RecordDisciplinaryActionLegalReviewHandler } from './record-disciplinary-action-legal-review.handler.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const workerId = new Uuid('00000000-0000-0000-0000-000000000100');
const erCaseId = new Uuid('00000000-0000-0000-0000-000000000200');
const approverId = new Uuid('00000000-0000-0000-0000-000000000300');
const legalReviewerId = new Uuid('00000000-0000-0000-0000-000000000400');
const actionId = new Uuid('00000000-0000-0000-0000-000000000500');

function actor(): HrActor {
  return {
    actorType: 'USER',
    actorId: approverId,
    roles: ['EMPLOYEE_RELATIONS_ADMIN'],
    permissions: ['EMPLOYEE_RELATIONS_WRITE'],
    email: 'er.admin@example.com',
    mfaAuthenticated: true,
  };
}

function envelope<T>(payload: T): HrCommandEnvelope<T> {
  return {
    commandId: Uuid.generate(),
    commandName: 'test',
    commandSchemaVersion: 1,
    tenantId,
    actor: actor(),
    aggregateType: 'DisciplinaryAction',
    aggregateId: actionId,
    idempotencyKey: `test-${Date.now()}-${Math.random()}`,
    correlationId: Uuid.generate(),
    reason: 'spec',
    payload,
    metadata: { requestHash: 'test-hash', clientType: 'HR_ADMIN' },
  };
}

/** Drafts and approves a DisciplinaryAction at the given severity (real aggregate methods, no mocks). */
function draftAndApprove(severity: CaseSeverity): DisciplinaryAction {
  const action = DisciplinaryAction.draft(
    {
      id: actionId,
      tenantId,
      workerId,
      erCaseId,
      actionType: 'WRITTEN_WARNING',
      severity,
      description: 'Policy breach confirmed after investigation',
      effectiveDate: new Date('2026-07-01T00:00:00.000Z'),
    },
    Uuid.generate(),
  );
  action.approve(approverId, Uuid.generate());
  return action;
}

/** In-memory fake repo backed by a single mutable aggregate reference (mirrors country-policy-review-gate.spec.ts's fakePackRepo). */
function fakeRepo(initial: DisciplinaryAction) {
  let current = initial;
  return {
    findById: vi.fn(async () => current),
    save: vi.fn(async (a: DisciplinaryAction) => {
      current = a;
    }),
    get current() {
      return current;
    },
  };
}

describe('DisciplinaryAction severity-driven legal-review escalation gate', () => {
  let fsm: FsmFramework;
  let publisher: EmployeeRelationsEventsPublisher;

  beforeEach(() => {
    fsm = new FsmFramework();
    registerDisciplinaryActionFsm(fsm);
    publisher = new EmployeeRelationsEventsPublisher();
  });

  describe('aggregate invariants (fail closed even if a handler is bypassed)', () => {
    it('a LOW-severity action finalizes (executes) without any legal-review gate', () => {
      const action = draftAndApprove('LOW');
      expect(action.requiresLegalReview).toBe(false);

      expect(() => action.execute(Uuid.generate())).not.toThrow();

      expect(action.status).toBe('EXECUTED');
    });

    it('a MEDIUM-severity action also finalizes without a gate (threshold defaults to HIGH)', () => {
      const action = draftAndApprove('MEDIUM');
      expect(action.requiresLegalReview).toBe(false);

      expect(() => action.execute(Uuid.generate())).not.toThrow();
      expect(action.status).toBe('EXECUTED');
    });

    it('a HIGH-severity action is blocked from executing until legal review is recorded', () => {
      const action = draftAndApprove('HIGH');
      expect(action.requiresLegalReview).toBe(true);
      expect(action.canFinalize).toBe(false);

      expect(() => action.execute(Uuid.generate())).toThrow(ValidationError);
      expect(() => action.execute(Uuid.generate())).toThrow(/legal review/i);
      expect(action.status).toBe('APPROVED'); // unchanged — blocked, not half-transitioned

      action.recordLegalReview(legalReviewerId, Uuid.generate());
      expect(action.canFinalize).toBe(true);

      expect(() => action.execute(Uuid.generate())).not.toThrow();
      expect(action.status).toBe('EXECUTED');
    });

    it('recordLegalReview is rejected once the action has reached a final disposition', () => {
      const action = draftAndApprove('HIGH');
      action.recordLegalReview(legalReviewerId, Uuid.generate());
      action.execute(Uuid.generate());
      action.appeal(Uuid.generate());
      action.revoke(Uuid.generate());

      expect(() => action.recordLegalReview(legalReviewerId, Uuid.generate())).toThrow(ValidationError);
    });
  });

  describe('command handlers (fail closed through the real dispatch path)', () => {
    it('ExecuteDisciplinaryAction succeeds immediately for LOW severity', async () => {
      const action = draftAndApprove('LOW');
      const repo = fakeRepo(action);
      const handler = new ExecuteDisciplinaryActionHandler(repo as unknown as DisciplinaryActionRepository, fsm, publisher);

      const result = await handler.handle(envelope({ disciplinaryActionId: actionId }));

      expect(result.success).toBe(true);
      expect(result.newState).toBe('EXECUTED');
      expect(repo.current.status).toBe('EXECUTED');
    });

    it('ExecuteDisciplinaryAction fails closed for HIGH severity without a recorded legal review', async () => {
      const action = draftAndApprove('HIGH');
      const repo = fakeRepo(action);
      const handler = new ExecuteDisciplinaryActionHandler(repo as unknown as DisciplinaryActionRepository, fsm, publisher);

      await expect(handler.handle(envelope({ disciplinaryActionId: actionId }))).rejects.toThrow(ValidationError);
      expect(repo.current.status).toBe('APPROVED');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('RecordDisciplinaryActionLegalReview unblocks ExecuteDisciplinaryAction for HIGH severity', async () => {
      const action = draftAndApprove('HIGH');
      const repo = fakeRepo(action);
      const reviewHandler = new RecordDisciplinaryActionLegalReviewHandler(repo as unknown as DisciplinaryActionRepository, fsm, publisher);
      const executeHandler = new ExecuteDisciplinaryActionHandler(repo as unknown as DisciplinaryActionRepository, fsm, publisher);

      // Still blocked before the review is recorded.
      await expect(executeHandler.handle(envelope({ disciplinaryActionId: actionId }))).rejects.toThrow(ValidationError);

      const reviewResult = await reviewHandler.handle(envelope({ disciplinaryActionId: actionId, reviewedBy: legalReviewerId }));
      expect(reviewResult.success).toBe(true);
      expect((reviewResult.data as { canFinalize: boolean }).canFinalize).toBe(true);
      expect(repo.current.legalReviewCompletedAt).toBeInstanceOf(Date);
      expect(repo.current.legalReviewCompletedBy?.value).toBe(legalReviewerId.value);

      const executeResult = await executeHandler.handle(envelope({ disciplinaryActionId: actionId }));
      expect(executeResult.success).toBe(true);
      expect(executeResult.newState).toBe('EXECUTED');
      expect(repo.current.status).toBe('EXECUTED');
    });
  });
});
