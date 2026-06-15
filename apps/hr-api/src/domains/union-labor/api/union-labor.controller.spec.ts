import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';
import { UnionLaborController } from './union-labor.controller.js';
import type { CommandBus } from '../../../platform/command-bus/command-bus.js';
import type { UnionRecognitionRepository } from '../repositories/union-recognition.repository.js';
import type { GrievanceRepository } from '../repositories/grievance.repository.js';
import type { CollectiveBargainingSessionRepository } from '../repositories/collective-bargaining-session.repository.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const actorId = '00000000-0000-0000-0000-000000000010';
const bargainingUnitId = '00000000-0000-0000-0000-000000000100';
const unionRecognitionId = '00000000-0000-0000-0000-000000000200';
const grievanceId = '00000000-0000-0000-0000-000000000400';
const workerId = '00000000-0000-0000-0000-000000000500';

function actor(): HrActor {
  return {
    actorType: 'USER',
    actorId: new Uuid(actorId),
    roles: ['HR_ADMIN'],
    permissions: ['UNION_LABOR_WRITE', 'UNION_LABOR_READ'],
    email: 'hr.admin@example.com',
    mfaAuthenticated: true,
  };
}

function request(): Request {
  return {
    tenantId,
    actor: actor(),
    headers: {},
  } as unknown as Request;
}

function makeController() {
  const commandBus = { execute: vi.fn(async () => ({ success: true })) } as unknown as CommandBus;
  const unionRecognitionRepo = {
    findById: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as UnionRecognitionRepository;
  const grievanceRepo = {
    findById: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as GrievanceRepository;
  const cbsRepo = {
    findById: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as CollectiveBargainingSessionRepository;

  const controller = new UnionLaborController(commandBus, unionRecognitionRepo, grievanceRepo, cbsRepo);

  return { controller, commandBus, unionRecognitionRepo, grievanceRepo, cbsRepo };
}

describe('UnionLaborController', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('records union recognition through authenticated command envelopes', async () => {
    const { controller, commandBus } = makeController();
    const effectiveDate = new Date('2026-07-01T00:00:00.000Z');
    const expirationDate = new Date('2027-06-30T00:00:00.000Z');

    await controller.createRecognition({
      unionName: 'Nurses Guild',
      bargainingUnitId,
      effectiveDate,
      expirationDate,
      agreementDocument: 'agreement-doc-001',
    }, request());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CreateUnionRecognition',
      aggregateType: 'UnionRecognition',
      tenantId: new Uuid(tenantId),
      actor: expect.objectContaining({ actorId: new Uuid(actorId) }),
      payload: expect.objectContaining({
        unionName: 'Nurses Guild',
        bargainingUnitId,
        effectiveDate,
        expirationDate,
        agreementDocument: 'agreement-doc-001',
      }),
    }));
  });

  it('opens collective bargaining sessions for a recognized union', async () => {
    const { controller, commandBus } = makeController();
    const sessionDate = new Date('2026-08-15T09:00:00.000Z');

    await controller.createSession({
      unionRecognitionId,
      sessionDate,
      location: 'Cairo HQ',
      agenda: 'Annual agreement renewal',
      minutes: 'Opening agenda captured',
    }, request());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CreateCollectiveBargainingSession',
      aggregateType: 'CollectiveBargainingSession',
      tenantId: new Uuid(tenantId),
      payload: expect.objectContaining({
        unionRecognitionId,
        sessionDate,
        location: 'Cairo HQ',
        agenda: 'Annual agreement renewal',
      }),
    }));
  });

  it('files and resolves grievances with aggregate state guards', async () => {
    const { controller, commandBus, grievanceRepo } = makeController();
    (grievanceRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(grievanceId),
      workerId: new Uuid(workerId),
      status: 'UNDER_INVESTIGATION',
      aggregateVersion: 3,
    });

    await controller.createGrievance({
      workerId,
      grievanceType: 'WORKING_CONDITIONS',
      description: 'Unsafe workstation assignment',
      resolution: 'Ergonomic review completed',
    }, request());
    await controller.resolveGrievance(grievanceId, request());

    expect(commandBus.execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      commandName: 'CreateGrievance',
      aggregateType: 'Grievance',
      payload: expect.objectContaining({
        workerId,
        grievanceType: 'WORKING_CONDITIONS',
        description: 'Unsafe workstation assignment',
      }),
    }));
    expect(commandBus.execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      commandName: 'ResolveGrievance',
      aggregateType: 'Grievance',
      aggregateId: new Uuid(grievanceId),
      expectedState: 'UNDER_INVESTIGATION',
      expectedVersion: 3,
      payload: {
        grievanceId: new Uuid(grievanceId),
      },
    }));
  });

  it('lists labor records by the authenticated tenant only', async () => {
    const { controller, unionRecognitionRepo, grievanceRepo, cbsRepo } = makeController();
    (unionRecognitionRepo.findByTenant as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: new Uuid(unionRecognitionId) }]);
    (grievanceRepo.findByTenant as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: new Uuid(grievanceId) }]);
    (cbsRepo.findByTenant as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await expect(controller.getRecognitionsByTenant(tenantId, request())).resolves.toHaveLength(1);
    await expect(controller.getGrievancesByTenant(tenantId, request())).resolves.toHaveLength(1);
    await expect(controller.getSessionsByTenant(tenantId, request())).resolves.toEqual([]);
    await expect(controller.getGrievancesByTenant('00000000-0000-0000-0000-000000000999', request())).rejects.toThrow('Tenant mismatch');
  });
});
