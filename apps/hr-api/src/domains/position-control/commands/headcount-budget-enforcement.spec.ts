import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Uuid, ConflictError } from '@hcm/shared-kernel';
import type { HrActor, HrCommandEnvelope } from '@hcm/command-contracts';
import { HeadcountRequest } from '../aggregates/headcount-request.aggregate.js';
import { HeadcountBudget } from '../aggregates/headcount-budget.aggregate.js';
import type { HeadcountRequestRepository } from '../repositories/headcount-request.repository.js';
import type { HeadcountBudgetRepository } from '../repositories/headcount-budget.repository.js';
import { ApproveHeadcountRequestHandler } from './approve-headcount-request.handler.js';
import { ConfigureHeadcountBudgetHandler } from './configure-headcount-budget.handler.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const requestedBy = new Uuid('00000000-0000-0000-0000-000000000010');
const approverId = new Uuid('00000000-0000-0000-0000-000000000020');
const departmentId = new Uuid('00000000-0000-0000-0000-000000000401');
const requestId = new Uuid('00000000-0000-0000-0000-000000000500');
const budgetId = new Uuid('00000000-0000-0000-0000-000000000600');
const fiscalYear = 2026;

function actor(roles: string[] = ['POSITION_ADMIN']): HrActor {
  return {
    actorType: 'USER',
    actorId: approverId,
    roles,
    permissions: ['POSITION_WRITE'],
    email: 'position.admin@example.com',
    mfaAuthenticated: true,
  };
}

function envelope<T>(commandName: string, payload: T, aggregateType: string, aggregateId: Uuid): HrCommandEnvelope<T> {
  return {
    commandId: Uuid.generate(),
    commandName,
    commandSchemaVersion: 1,
    tenantId,
    actor: actor(),
    aggregateType,
    aggregateId,
    idempotencyKey: `${commandName}-${Date.now()}-${Math.random()}`,
    correlationId: Uuid.generate(),
    reason: 'spec',
    payload,
    metadata: { requestHash: 'test-hash', clientType: 'HR_ADMIN' },
  };
}

function buildRequest(overrides: Partial<{ departmentId: Uuid | undefined; positionsRequested: number }> = {}): HeadcountRequest {
  // NOTE: use `in` rather than `=== undefined` so callers can explicitly
  // request no department (`{ departmentId: undefined }`) to distinguish
  // "no override supplied" from "override to no department".
  const departmentOverride = 'departmentId' in overrides ? overrides.departmentId : departmentId;
  return HeadcountRequest.restore({
    id: requestId,
    tenantId,
    requestNumber: 'HC-2026-0001',
    departmentId: departmentOverride,
    justification: 'Growth hire',
    requestedBy,
    status: 'UNDER_REVIEW',
    positionsRequested: overrides.positionsRequested ?? 10,
    aggregateVersion: 2,
  });
}

/** In-memory fake HeadcountRequestRepository backed by a single mutable request. */
function fakeHeadcountRepo(initial: HeadcountRequest, currentApprovedTotal = 0) {
  let current = initial;
  return {
    findById: vi.fn(async () => current),
    save: vi.fn(async (r: HeadcountRequest) => {
      current = r;
    }),
    sumApprovedPositionsByDepartment: vi.fn(async () => currentApprovedTotal),
    get current() {
      return current;
    },
  };
}

/** In-memory fake HeadcountBudgetRepository backed by a single mutable budget (or none). */
function fakeBudgetRepo(initial?: HeadcountBudget) {
  let current = initial;
  return {
    findById: vi.fn(async () => current),
    findByDepartmentAndYear: vi.fn(async () => current),
    findAll: vi.fn(async () => (current ? [current] : [])),
    save: vi.fn(async (b: HeadcountBudget) => {
      current = b;
    }),
    get current() {
      return current;
    },
  };
}

describe('HeadcountBudget enforcement', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('ConfigureHeadcountBudgetHandler', () => {
    it('creates a new budget when none exists for the department/fiscal year', async () => {
      const budgetRepo = fakeBudgetRepo(undefined);
      const handler = new ConfigureHeadcountBudgetHandler(budgetRepo as unknown as HeadcountBudgetRepository);

      const result = await handler.handle(
        envelope('ConfigureHeadcountBudget', { departmentId: departmentId.value, fiscalYear, ceiling: 10 }, 'headcountBudget', budgetId),
      );

      expect(result.success).toBe(true);
      expect((result.data as { ceiling: number }).ceiling).toBe(10);
      expect(result.eventsEmitted).toContain('HeadcountBudgetSet');
      expect(budgetRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ departmentId, fiscalYear, ceiling: 10 }),
      );
      expect(budgetRepo.current?.ceiling).toBe(10);
    });

    it('re-sets (upserts) the ceiling on an existing budget instead of creating a duplicate', async () => {
      const existing = HeadcountBudget.restore({
        id: budgetId,
        tenantId,
        departmentId,
        fiscalYear,
        ceiling: 10,
        setBy: requestedBy,
        aggregateVersion: 0,
      });
      const budgetRepo = fakeBudgetRepo(existing);
      const handler = new ConfigureHeadcountBudgetHandler(budgetRepo as unknown as HeadcountBudgetRepository);

      const result = await handler.handle(
        envelope('ConfigureHeadcountBudget', { departmentId: departmentId.value, fiscalYear, ceiling: 15 }, 'headcountBudget', budgetId),
      );

      expect(result.success).toBe(true);
      expect(result.eventsEmitted).toContain('HeadcountBudgetCeilingUpdated');
      expect(budgetRepo.current?.ceiling).toBe(15);
      expect(budgetRepo.current?.version).toBe(1);
      expect(budgetRepo.current?.id.value).toBe(budgetId.value);
      // Only one budget row should ever exist for this department/year — updateCeiling
      // mutates the existing aggregate rather than a second one being created.
      expect(budgetRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('ApproveHeadcountRequestHandler with a configured budget', () => {
    function buildBudget(ceiling: number): HeadcountBudget {
      return HeadcountBudget.restore({
        id: budgetId,
        tenantId,
        departmentId,
        fiscalYear,
        ceiling,
        setBy: requestedBy,
        aggregateVersion: 0,
      });
    }

    it('approves when the projected total is under the ceiling', async () => {
      const headcountRepo = fakeHeadcountRepo(buildRequest(), 5);
      const budgetRepo = fakeBudgetRepo(buildBudget(10));
      const handler = new ApproveHeadcountRequestHandler(
        headcountRepo as unknown as HeadcountRequestRepository,
        budgetRepo as unknown as HeadcountBudgetRepository,
      );

      const result = await handler.handle(
        envelope('ApproveHeadcountRequest', { requestId: requestId.value, positionsApproved: 3, fiscalYear }, 'headcountRequest', requestId),
      );

      expect(result.success).toBe(true);
      expect(headcountRepo.current.status).toBe('APPROVED');
      expect(headcountRepo.save).toHaveBeenCalled();
    });

    it('approves when the projected total lands exactly at the ceiling', async () => {
      const headcountRepo = fakeHeadcountRepo(buildRequest(), 7);
      const budgetRepo = fakeBudgetRepo(buildBudget(10));
      const handler = new ApproveHeadcountRequestHandler(
        headcountRepo as unknown as HeadcountRequestRepository,
        budgetRepo as unknown as HeadcountBudgetRepository,
      );

      const result = await handler.handle(
        envelope('ApproveHeadcountRequest', { requestId: requestId.value, positionsApproved: 3, fiscalYear }, 'headcountRequest', requestId),
      );

      expect(result.success).toBe(true);
      expect(headcountRepo.current.status).toBe('APPROVED');
      expect(headcountRepo.current.positionsApproved).toBe(3);
    });

    it('fails closed and rejects when the projected total would exceed the ceiling', async () => {
      const headcountRepo = fakeHeadcountRepo(buildRequest(), 7);
      const budgetRepo = fakeBudgetRepo(buildBudget(10));
      const handler = new ApproveHeadcountRequestHandler(
        headcountRepo as unknown as HeadcountRequestRepository,
        budgetRepo as unknown as HeadcountBudgetRepository,
      );

      const command = envelope('ApproveHeadcountRequest', { requestId: requestId.value, positionsApproved: 4, fiscalYear }, 'headcountRequest', requestId);

      const thrown: unknown = await handler.handle(command).then(
        () => undefined,
        (err) => err,
      );

      expect(thrown).toBeInstanceOf(ConflictError);
      const message = (thrown as ConflictError).message;
      // Message must clearly state the org unit, requested count, current approved
      // total, and the budget ceiling so an approver understands why it was blocked.
      expect(message).toContain(departmentId.value);
      expect(message).toContain('4 position(s)');
      expect(message).toContain('2026');
      expect(message).toContain('ceiling of 10');
      expect(message).toContain('currently 7 approved');

      // The request must not have been mutated or persisted — approval never happened.
      expect(headcountRepo.current.status).toBe('UNDER_REVIEW');
      expect(headcountRepo.save).not.toHaveBeenCalled();
    });

    it('includes org unit, requested count, current total, and ceiling in the rejection error details', async () => {
      const headcountRepo = fakeHeadcountRepo(buildRequest(), 7);
      const budgetRepo = fakeBudgetRepo(buildBudget(10));
      const handler = new ApproveHeadcountRequestHandler(
        headcountRepo as unknown as HeadcountRequestRepository,
        budgetRepo as unknown as HeadcountBudgetRepository,
      );

      const thrown: unknown = await handler
        .handle(
          envelope('ApproveHeadcountRequest', { requestId: requestId.value, positionsApproved: 4, fiscalYear }, 'headcountRequest', requestId),
        )
        .then(
          () => undefined,
          (err) => err,
        );

      expect(thrown).toBeInstanceOf(ConflictError);
      const conflict = thrown as ConflictError;
      expect(conflict.details).toMatchObject({
        departmentId: departmentId.value,
        fiscalYear,
        requestedApproval: 4,
        currentApprovedTotal: 7,
        budgetCeiling: 10,
        projectedTotal: 11,
      });
    });
  });

  describe('ApproveHeadcountRequestHandler without an enforceable budget', () => {
    it('approves unconstrained when no budget is configured for the department/fiscal year', async () => {
      const headcountRepo = fakeHeadcountRepo(buildRequest(), 999);
      const budgetRepo = fakeBudgetRepo(undefined);
      const handler = new ApproveHeadcountRequestHandler(
        headcountRepo as unknown as HeadcountRequestRepository,
        budgetRepo as unknown as HeadcountBudgetRepository,
      );

      const result = await handler.handle(
        envelope('ApproveHeadcountRequest', { requestId: requestId.value, positionsApproved: 10, fiscalYear }, 'headcountRequest', requestId),
      );

      expect(result.success).toBe(true);
      expect(headcountRepo.current.status).toBe('APPROVED');
    });

    it('skips the budget check entirely when the request has no departmentId', async () => {
      const headcountRepo = fakeHeadcountRepo(buildRequest({ departmentId: undefined }), 0);
      const budgetRepo = fakeBudgetRepo(undefined);
      const handler = new ApproveHeadcountRequestHandler(
        headcountRepo as unknown as HeadcountRequestRepository,
        budgetRepo as unknown as HeadcountBudgetRepository,
      );

      const result = await handler.handle(
        envelope('ApproveHeadcountRequest', { requestId: requestId.value, positionsApproved: 5, fiscalYear }, 'headcountRequest', requestId),
      );

      expect(result.success).toBe(true);
      expect(budgetRepo.findByDepartmentAndYear).not.toHaveBeenCalled();
    });
  });

  describe('Pre-existing SoD guard still applies alongside the budget check', () => {
    it('still rejects when the approver is the requester, regardless of budget', async () => {
      const request = HeadcountRequest.restore({
        id: requestId,
        tenantId,
        requestNumber: 'HC-2026-0002',
        departmentId,
        justification: 'Growth hire',
        requestedBy: approverId, // same as the approving actor
        status: 'UNDER_REVIEW',
        positionsRequested: 10,
        aggregateVersion: 2,
      });
      const headcountRepo = fakeHeadcountRepo(request, 0);
      const budgetRepo = fakeBudgetRepo(buildBudgetHelper(100));
      const handler = new ApproveHeadcountRequestHandler(
        headcountRepo as unknown as HeadcountRequestRepository,
        budgetRepo as unknown as HeadcountBudgetRepository,
      );

      await expect(
        handler.handle(
          envelope('ApproveHeadcountRequest', { requestId: requestId.value, positionsApproved: 1, fiscalYear }, 'headcountRequest', requestId),
        ),
      ).rejects.toThrow(/Segregation of duties|SoD/i);
    });

    function buildBudgetHelper(ceiling: number): HeadcountBudget {
      return HeadcountBudget.restore({
        id: budgetId,
        tenantId,
        departmentId,
        fiscalYear,
        ceiling,
        setBy: requestedBy,
        aggregateVersion: 0,
      });
    }
  });
});
