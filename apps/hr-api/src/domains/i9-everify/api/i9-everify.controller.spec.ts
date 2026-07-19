import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';
import { I9EverifyController } from './i9-everify.controller.js';
import type { CommandBus } from '../../../platform/command-bus/command-bus.js';
import type { I9CaseRepository } from '../repositories/i9-case.repository.js';
import type { EverifyCaseRepository } from '../repositories/everify-case.repository.js';
import { I9Case } from '../aggregates/i9-case.aggregate.js';
import { EverifyCase } from '../aggregates/everify-case.aggregate.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const actorId = '00000000-0000-0000-0000-000000000010';
const workerId = '00000000-0000-0000-0000-000000000020';
const i9CaseId = '00000000-0000-0000-0000-000000000030';
const everifyCaseId = '00000000-0000-0000-0000-000000000040';
const reviewerId = '00000000-0000-0000-0000-000000000050';

function actor(roles: string[] = ['HR_ADMIN']): HrActor {
  return {
    actorType: 'USER',
    actorId: new Uuid(actorId),
    roles,
    permissions: ['GLOBAL_HR_READ', 'GLOBAL_HR_WRITE'],
    email: 'compliance.officer@example.com',
    mfaAuthenticated: true,
  };
}

function request(roles: string[] = ['HR_ADMIN']): Request {
  return {
    tenantId,
    actor: actor(roles),
    headers: {},
  } as unknown as Request;
}

function makeI9Case(overrides: Partial<ConstructorParameters<typeof I9Case>[0]> = {}): I9Case {
  return new I9Case({
    id: new Uuid(i9CaseId),
    tenantId: new Uuid(tenantId),
    workerId: new Uuid(workerId),
    startDate: new Date('2026-07-01T00:00:00.000Z'),
    status: 'DRAFT',
    aggregateVersion: 0,
    ...overrides,
  });
}

function makeEverifyCase(overrides: Partial<ConstructorParameters<typeof EverifyCase>[0]> = {}): EverifyCase {
  return new EverifyCase({
    id: new Uuid(everifyCaseId),
    tenantId: new Uuid(tenantId),
    workerId: new Uuid(workerId),
    i9CaseId: new Uuid(i9CaseId),
    status: 'SUBMITTED',
    aggregateVersion: 1,
    ...overrides,
  });
}

function makeController() {
  const commandBus = { execute: vi.fn(async () => ({ success: true })) } as unknown as CommandBus;
  const i9CaseRepo = {
    findById: vi.fn(),
    findByWorker: vi.fn(),
    findByTenant: vi.fn(),
    save: vi.fn(),
  } as unknown as I9CaseRepository;
  const everifyCaseRepo = {
    findById: vi.fn(),
    findByI9Case: vi.fn(),
    findByWorker: vi.fn(),
    save: vi.fn(),
  } as unknown as EverifyCaseRepository;

  const controller = new I9EverifyController(commandBus, i9CaseRepo, everifyCaseRepo);

  return { controller, commandBus, i9CaseRepo, everifyCaseRepo };
}

describe('I9EverifyController', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('dispatches CompleteI9CaseSection1 against the loaded I9 case', async () => {
    const { controller, commandBus, i9CaseRepo } = makeController();
    (i9CaseRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(makeI9Case({ status: 'DRAFT', aggregateVersion: 0 }));

    await controller.completeI9CaseSection1(
      i9CaseId,
      { citizenshipStatus: 'US_CITIZEN' },
      request(),
    );

    expect(i9CaseRepo.findById).toHaveBeenCalledWith(new Uuid(i9CaseId));
    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CompleteI9CaseSection1',
      aggregateType: 'I9Case',
      aggregateId: new Uuid(i9CaseId),
      expectedState: 'DRAFT',
      expectedVersion: 0,
      subjectWorkerId: new Uuid(workerId),
      payload: expect.objectContaining({
        i9CaseId: new Uuid(i9CaseId),
        citizenshipStatus: 'US_CITIZEN',
      }),
    }));
  });

  it('dispatches CompleteI9CaseSection2 with document review fields', async () => {
    const { controller, commandBus, i9CaseRepo } = makeController();
    (i9CaseRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeI9Case({ status: 'SECTION1_COMPLETED', aggregateVersion: 1 }),
    );

    await controller.completeI9CaseSection2(
      i9CaseId,
      {
        documentType: 'LIST_A',
        documentDescriptions: ['US Passport'],
        reviewerId,
      },
      request(),
    );

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CompleteI9CaseSection2',
      aggregateType: 'I9Case',
      aggregateId: new Uuid(i9CaseId),
      expectedState: 'SECTION1_COMPLETED',
      expectedVersion: 1,
      payload: expect.objectContaining({
        i9CaseId: new Uuid(i9CaseId),
        documentType: 'LIST_A',
        documentDescriptions: ['US Passport'],
        reviewerId,
      }),
    }));
  });

  it('dispatches RejectI9Case with the rejection reason', async () => {
    const { controller, commandBus, i9CaseRepo } = makeController();
    (i9CaseRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeI9Case({ status: 'SECTION2_VERIFIED', aggregateVersion: 2 }),
    );

    await controller.rejectI9Case(i9CaseId, { reason: 'Documents did not establish work authorization' }, request());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'RejectI9Case',
      aggregateType: 'I9Case',
      aggregateId: new Uuid(i9CaseId),
      expectedState: 'SECTION2_VERIFIED',
      expectedVersion: 2,
      payload: { i9CaseId: new Uuid(i9CaseId), reason: 'Documents did not establish work authorization' },
    }));
  });

  it('throws when completing section 1 for an I9 case that does not exist in this tenant', async () => {
    const { controller, i9CaseRepo } = makeController();
    (i9CaseRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await expect(
      controller.completeI9CaseSection1(i9CaseId, { citizenshipStatus: 'US_CITIZEN' }, request()),
    ).rejects.toThrow('I9 case not found');
  });

  it('rejects access from an actor without an I9/E-Verify admin role', async () => {
    const { controller, i9CaseRepo } = makeController();
    (i9CaseRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(makeI9Case());

    await expect(
      controller.completeI9CaseSection1(i9CaseId, { citizenshipStatus: 'US_CITIZEN' }, request(['EMPLOYEE'])),
    ).rejects.toThrow('Only HR or compliance administrators can access I9/E-Verify records');
  });

  it('looks up an I9 case scoped to the authenticated tenant and maps it through the DTO', async () => {
    const { controller, i9CaseRepo } = makeController();
    (i9CaseRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeI9Case({ status: 'SECTION2_VERIFIED', aggregateVersion: 2 }),
    );

    const result = await controller.getI9Case(i9CaseId, request());

    expect(i9CaseRepo.findById).toHaveBeenCalledWith(new Uuid(i9CaseId));
    expect(result).toEqual(expect.objectContaining({ i9CaseId, workerId, status: 'SECTION2_VERIFIED' }));
  });

  it('does not leak another tenant\'s I9 case: a cross-tenant id resolves to undefined, not a record', async () => {
    // I9CaseRepository.findById scopes every query to the ambient tenant read
    // from AsyncLocalStorage (set by TenantInterceptor per request), never to
    // anything client-supplied. A cross-tenant id therefore comes back as
    // `undefined` from the repository itself; the controller must surface that
    // as "not found" rather than falling through to some other unscoped lookup.
    const { controller, i9CaseRepo } = makeController();
    (i9CaseRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await expect(controller.getI9Case(i9CaseId, request())).resolves.toBeUndefined();
    expect(i9CaseRepo.findById).toHaveBeenCalledWith(new Uuid(i9CaseId));
    expect(i9CaseRepo.findByTenant).not.toHaveBeenCalled();
  });

  it('lists I9 cases for a worker', async () => {
    const { controller, i9CaseRepo } = makeController();
    (i9CaseRepo.findByWorker as ReturnType<typeof vi.fn>).mockResolvedValue([makeI9Case()]);

    const result = await controller.getI9CasesByWorker(workerId, request());

    expect(i9CaseRepo.findByWorker).toHaveBeenCalledWith(new Uuid(workerId));
    expect(result).toHaveLength(1);
  });

  it('dispatches SubmitEverifyCase against the loaded I9 case', async () => {
    const { controller, commandBus, i9CaseRepo } = makeController();
    (i9CaseRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeI9Case({ status: 'SECTION2_VERIFIED', aggregateVersion: 2 }),
    );

    await controller.submitEverifyCase(
      { i9CaseId, firstName: 'Jane', lastName: 'Doe' },
      request(),
    );

    expect(i9CaseRepo.findById).toHaveBeenCalledWith(new Uuid(i9CaseId));
    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'SubmitEverifyCase',
      aggregateType: 'I9Case',
      aggregateId: new Uuid(i9CaseId),
      expectedState: 'SECTION2_VERIFIED',
      expectedVersion: 2,
      payload: expect.objectContaining({ i9CaseId: new Uuid(i9CaseId), firstName: 'Jane', lastName: 'Doe' }),
    }));
  });

  it('dispatches RecordEverifyResult against the loaded E-Verify case', async () => {
    const { controller, commandBus, everifyCaseRepo } = makeController();
    (everifyCaseRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeEverifyCase({ status: 'SUBMITTED', aggregateVersion: 1 }),
    );

    await controller.recordEverifyResult(everifyCaseId, { result: 'CONFIRMED' }, request());

    expect(everifyCaseRepo.findById).toHaveBeenCalledWith(new Uuid(everifyCaseId));
    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'RecordEverifyResult',
      aggregateType: 'EverifyCase',
      aggregateId: new Uuid(everifyCaseId),
      expectedState: 'SUBMITTED',
      expectedVersion: 1,
      subjectWorkerId: new Uuid(workerId),
      payload: expect.objectContaining({ everifyCaseId: new Uuid(everifyCaseId), result: 'CONFIRMED' }),
    }));
  });

  it('dispatches ContestEverifyTentativeNonconfirmation against the loaded E-Verify case', async () => {
    const { controller, commandBus, everifyCaseRepo } = makeController();
    (everifyCaseRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeEverifyCase({ status: 'TENTATIVE_NONCONFIRMATION', aggregateVersion: 2 }),
    );

    await controller.contestEverifyTnc(everifyCaseId, request());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'ContestEverifyTentativeNonconfirmation',
      aggregateType: 'EverifyCase',
      aggregateId: new Uuid(everifyCaseId),
      expectedState: 'TENTATIVE_NONCONFIRMATION',
      expectedVersion: 2,
      payload: { everifyCaseId: new Uuid(everifyCaseId) },
    }));
  });

  it('looks up an E-Verify case scoped to the authenticated tenant and maps it through the DTO', async () => {
    const { controller, everifyCaseRepo } = makeController();
    (everifyCaseRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeEverifyCase({ status: 'CONFIRMED', aggregateVersion: 3, result: 'CONFIRMED' }),
    );

    const result = await controller.getEverifyCase(everifyCaseId, request());

    expect(everifyCaseRepo.findById).toHaveBeenCalledWith(new Uuid(everifyCaseId));
    expect(result).toEqual(expect.objectContaining({ everifyCaseId, workerId, i9CaseId, status: 'CONFIRMED' }));
  });

  it('does not leak another tenant\'s E-Verify case: a cross-tenant id resolves to undefined, not a record', async () => {
    const { controller, everifyCaseRepo } = makeController();
    (everifyCaseRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await expect(controller.getEverifyCase(everifyCaseId, request())).resolves.toBeUndefined();
    expect(everifyCaseRepo.findById).toHaveBeenCalledWith(new Uuid(everifyCaseId));
  });
});
