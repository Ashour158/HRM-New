import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { HrActor } from '@hcm/command-contracts';
import { Email, Uuid } from '@hcm/shared-kernel';
import { WorkerProfile } from '../../hr-core/aggregates/worker-profile.aggregate.js';
import { LegalEntity } from '../aggregates/legal-entity.aggregate.js';
import { ManagerRelationship } from '../aggregates/manager-relationship.aggregate.js';
import { OrgUnit } from '../aggregates/org-unit.aggregate.js';
import { LegalEntityProjection } from '../projections/legal-entity.projection.js';
import { OrganizationController } from './organization.controller.js';
import { Position } from '../../position-control/aggregates/position.aggregate.js';
import { HeadcountRequest } from '../../position-control/aggregates/headcount-request.aggregate.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actorId = new Uuid('00000000-0000-0000-0000-000000000010');
const legalEntityId = new Uuid('00000000-0000-0000-0000-000000000100');
const orgUnitId = new Uuid('00000000-0000-0000-0000-000000000200');
const parentOrgUnitId = new Uuid('00000000-0000-0000-0000-000000000201');
const workerId = new Uuid('00000000-0000-0000-0000-000000000300');
const managerId = new Uuid('00000000-0000-0000-0000-000000000301');
const newManagerId = new Uuid('00000000-0000-0000-0000-000000000302');
const relationshipId = new Uuid('00000000-0000-0000-0000-000000000400');

function actor(overrides: Partial<HrActor> = {}): HrActor {
  return {
    actorType: 'USER',
    actorId,
    roles: ['HR_ADMIN'],
    permissions: ['ORGANIZATION_WRITE'],
    email: 'hr.admin@example.com',
    mfaAuthenticated: true,
    ...overrides,
  };
}

function requestWithActor(requestActor: HrActor | undefined = actor()): Request {
  return {
    tenantId: tenantId.value,
    actor: requestActor,
    headers: {},
  } as unknown as Request;
}

function employeeRequest(): Request {
  return requestWithActor(actor({
    actorId: new Uuid('00000000-0000-0000-0000-000000000012'),
    roles: ['EMPLOYEE'],
    permissions: [],
    email: 'employee@example.com',
  }));
}

function legalEntity(overrides: Partial<LegalEntity> = {}) {
  return LegalEntity.restore({
    id: legalEntityId,
    tenantId,
    name: 'Nile Holding LLC',
    code: 'NILE',
    countryCode: 'EG',
    registrationNumber: 'EG-123',
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    version: 3,
    ...overrides,
  });
}

function orgUnit(overrides: Partial<OrgUnit> = {}) {
  return OrgUnit.restore({
    id: orgUnitId,
    tenantId,
    name: 'People Operations',
    code: 'PEOPLE',
    parentId: parentOrgUnitId,
    legalEntityId,
    level: 2,
    path: '/Corporate/People Operations',
    status: 'ACTIVE',
    createdAt: new Date('2026-01-03T00:00:00.000Z'),
    updatedAt: new Date('2026-01-04T00:00:00.000Z'),
    version: 4,
    ...overrides,
  });
}

function managerRelationship(overrides: Partial<ManagerRelationship> = {}) {
  return ManagerRelationship.restore({
    id: relationshipId,
    tenantId,
    workerId,
    managerId,
    departmentId: orgUnitId,
    isPrimary: true,
    startDate: new Date('2026-02-01T00:00:00.000Z'),
    status: 'ACTIVE',
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    updatedAt: new Date('2026-02-02T00:00:00.000Z'),
    version: 2,
    ...overrides,
  });
}

function worker(overrides: Partial<WorkerProfile> = {}) {
  return new WorkerProfile({
    id: workerId,
    tenantId,
    employeeNumber: 'EMP-001',
    status: 'ACTIVE',
    firstName: 'Mona',
    lastName: 'Saleh',
    email: new Email('mona.saleh@example.com'),
    hireDate: new Date('2024-01-01T00:00:00.000Z'),
    employmentType: 'FULL_TIME',
    aggregateVersion: 1,
    ...overrides,
  });
}

function position(overrides: Partial<Position> = {}) {
  return Position.restore({
    id: new Uuid('00000000-0000-0000-0000-000000000500'),
    tenantId,
    positionCode: 'POS-001',
    title: 'People Partner',
    departmentId: orgUnitId,
    legalEntityId,
    jobFamily: 'People Operations',
    jobLevel: 'G6',
    employmentType: 'FULL_TIME',
    status: 'VACANT',
    ...overrides,
  });
}

function headcountRequest(overrides: Partial<HeadcountRequest> = {}) {
  return HeadcountRequest.restore({
    id: new Uuid('00000000-0000-0000-0000-000000000600'),
    tenantId,
    requestNumber: 'HC-2026-0001',
    departmentId: orgUnitId,
    legalEntityId,
    justification: 'Branch expansion',
    requestedBy: actorId,
    status: 'SUBMITTED',
    positionsRequested: 3,
    ...overrides,
  });
}

function makeController(options?: {
  commandBus?: { execute: ReturnType<typeof vi.fn> };
  legalEntityRepo?: Record<string, ReturnType<typeof vi.fn>>;
  orgUnitRepo?: Record<string, ReturnType<typeof vi.fn>>;
  managerRelationshipRepo?: Record<string, ReturnType<typeof vi.fn>>;
  workerRepo?: Record<string, ReturnType<typeof vi.fn>>;
  personalDataRepo?: Record<string, ReturnType<typeof vi.fn>>;
  positionRepo?: Record<string, ReturnType<typeof vi.fn>>;
  headcountRepo?: Record<string, ReturnType<typeof vi.fn>>;
}) {
  const commandBus = options?.commandBus ?? { execute: vi.fn(async () => ({ success: true })) };
  const legalEntityRepo = options?.legalEntityRepo ?? {
    findByTenant: vi.fn(async () => []),
    findById: vi.fn(async () => undefined),
  };
  const orgUnitRepo = options?.orgUnitRepo ?? {
    findByTenant: vi.fn(async () => []),
    findTree: vi.fn(async () => []),
    findById: vi.fn(async () => undefined),
  };
  const managerRelationshipRepo = options?.managerRelationshipRepo ?? {
    findByTenant: vi.fn(async () => []),
    findByWorker: vi.fn(async () => []),
    findActiveForWorker: vi.fn(async () => undefined),
  };
  const workerRepo = options?.workerRepo ?? {
    findById: vi.fn(async () => undefined),
    searchForTenant: vi.fn(async () => []),
    save: vi.fn(async () => undefined),
  };
  const personalDataRepo = options?.personalDataRepo ?? {
    findByWorkerForTenant: vi.fn(async () => []),
  };
  const positionRepo = options?.positionRepo ?? {
    findAll: vi.fn(async () => []),
  };
  const headcountRepo = options?.headcountRepo ?? {
    findAll: vi.fn(async () => []),
  };

  const controller = new OrganizationController(
    commandBus as never,
    legalEntityRepo as never,
    orgUnitRepo as never,
    managerRelationshipRepo as never,
    workerRepo as never,
    personalDataRepo as never,
    positionRepo as never,
    headcountRepo as never,
    { getAllowedActions: vi.fn(() => ['activate']) } as never,
    new LegalEntityProjection(),
  );

  return {
    controller,
    commandBus,
    legalEntityRepo,
    orgUnitRepo,
    managerRelationshipRepo,
    workerRepo,
    personalDataRepo,
    positionRepo,
    headcountRepo,
  };
}

describe('OrganizationController organization workflow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('exposes both the existing HR route prefix and the public organization API prefix', () => {
    expect(Reflect.getMetadata(PATH_METADATA, OrganizationController)).toEqual([
      'hr/organization',
      'organization',
    ]);
  });

  it('builds legal entity creation commands from the authenticated tenant and actor', async () => {
    const { controller, commandBus } = makeController();

    await controller.createLegalEntity({
      legalEntityId: legalEntityId.value,
      name: 'Nile Holding LLC',
      countryCode: 'EG',
      registrationNumber: 'EG-123',
    }, requestWithActor());

    const command = commandBus.execute.mock.calls[0]?.[0];
    expect(command).toMatchObject({
      commandName: 'CreateLegalEntity',
      aggregateType: 'LegalEntity',
      tenantId,
      actor: actor(),
      metadata: {
        clientType: 'HR_ADMIN',
      },
    });
    expect(command.payload).toMatchObject({
      legalEntityId,
      name: 'Nile Holding LLC',
      countryCode: 'EG',
      registrationNumber: 'EG-123',
    });
  });

  it('builds org unit update commands with department parent changes', async () => {
    const { controller, commandBus } = makeController();

    await controller.updateOrgUnit(orgUnitId.value, {
      name: 'People Experience',
      parentOrgUnitId: parentOrgUnitId.value,
    }, requestWithActor());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'UpdateOrgUnit',
      aggregateType: 'OrgUnit',
      aggregateId: orgUnitId,
      payload: {
        orgUnitId,
        name: 'People Experience',
        parentOrgUnitId,
      },
    }));
  });

  it('maps summary data for legal entities, departments, org chart, and manager display names', async () => {
    const entity = legalEntity();
    const unit = orgUnit();
    const relationship = managerRelationship();
    const employee = worker();
    const manager = worker({
      id: managerId,
      employeeNumber: 'EMP-002',
      firstName: 'Omar',
      lastName: 'Hassan',
      email: new Email('omar.hassan@example.com'),
    });
    const orgChart = [{ id: orgUnitId.value, name: 'People Operations', children: [] }];
    const { controller, legalEntityRepo, orgUnitRepo, managerRelationshipRepo } = makeController({
      legalEntityRepo: {
        findByTenant: vi.fn(async () => [entity]),
        findById: vi.fn(),
      },
      orgUnitRepo: {
        findByTenant: vi.fn(async () => [unit]),
        findTree: vi.fn(async () => orgChart),
        findById: vi.fn(),
      },
      managerRelationshipRepo: {
        findByTenant: vi.fn(async () => [relationship]),
        findByWorker: vi.fn(),
        findActiveForWorker: vi.fn(),
      },
      workerRepo: {
        findById: vi.fn(async (id: Uuid) => id.value === workerId.value ? employee : manager),
        save: vi.fn(),
      },
    });

    const result = await controller.getOrganizationSummary(requestWithActor());

    expect(legalEntityRepo.findByTenant).toHaveBeenCalledWith(tenantId);
    expect(orgUnitRepo.findByTenant).toHaveBeenCalledWith(tenantId);
    expect(orgUnitRepo.findTree).toHaveBeenCalledWith(tenantId);
    expect(managerRelationshipRepo.findByTenant).toHaveBeenCalledWith(tenantId);
    expect(result.legalEntities).toEqual([expect.objectContaining({
      id: legalEntityId.value,
      name: 'Nile Holding LLC',
      status: 'ACTIVE',
    })]);
    expect(result.orgUnits).toEqual([expect.objectContaining({
      id: orgUnitId.value,
      name: 'People Operations',
      parentId: parentOrgUnitId.value,
      legalEntityId: legalEntityId.value,
    })]);
    expect(result.orgChart).toBe(orgChart);
    expect(result.managerRelationships).toEqual([expect.objectContaining({
      workerId: workerId.value,
      workerName: 'Mona Saleh',
      managerId: managerId.value,
      managerName: 'Omar Hassan',
      departmentId: orgUnitId.value,
    })]);
  });

  it('assigns a worker to entity, department, manager, and title and creates the reporting relationship', async () => {
    const existingWorker = worker();
    const { controller, commandBus, workerRepo, managerRelationshipRepo } = makeController({
      workerRepo: {
        findById: vi.fn(async () => existingWorker),
        save: vi.fn(async () => undefined),
      },
      managerRelationshipRepo: {
        findByTenant: vi.fn(),
        findByWorker: vi.fn(),
        findActiveForWorker: vi.fn(async () => undefined),
      },
    });

    const result = await controller.assignWorkerOrganization(workerId.value, {
      legalEntityId: legalEntityId.value,
      departmentId: orgUnitId.value,
      managerId: managerId.value,
      jobTitle: 'People Partner',
    }, requestWithActor());

    expect(workerRepo.save).not.toHaveBeenCalled();
    expect(managerRelationshipRepo.findActiveForWorker).toHaveBeenCalledWith(workerId);
    expect(commandBus.execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      commandName: 'AssignManager',
      aggregateType: 'ManagerRelationship',
      payload: {
        workerId,
        managerId,
        departmentId: orgUnitId,
      },
    }));
    expect(commandBus.execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      commandName: 'UpdateWorkerOrganizationAssignment',
      aggregateType: 'WorkerProfile',
      aggregateId: workerId,
      subjectWorkerId: workerId,
      payload: {
        workerId,
        legalEntityId,
        departmentId: orgUnitId,
        managerId,
        jobTitle: 'People Partner',
      },
    }));
    expect(result).toEqual({
      workerId: workerId.value,
      legalEntityId: legalEntityId.value,
      departmentId: orgUnitId.value,
      managerId: managerId.value,
      jobTitle: 'People Partner',
    });
  });

  it('supports the public body-based organization assignment API', async () => {
    const existingWorker = worker();
    const { controller, commandBus } = makeController({
      workerRepo: {
        findById: vi.fn(async () => existingWorker),
        save: vi.fn(async () => undefined),
      },
      managerRelationshipRepo: {
        findByTenant: vi.fn(),
        findByWorker: vi.fn(),
        findActiveForWorker: vi.fn(async () => undefined),
      },
    });

    const result = await controller.assignWorkerOrganizationByBody({
      workerId: workerId.value,
      legalEntityId: legalEntityId.value,
      departmentId: orgUnitId.value,
      managerId: managerId.value,
      jobTitle: 'People Partner',
    }, requestWithActor());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'UpdateWorkerOrganizationAssignment',
      aggregateType: 'WorkerProfile',
      aggregateId: workerId,
      subjectWorkerId: workerId,
    }));
    expect(result).toEqual({
      workerId: workerId.value,
      legalEntityId: legalEntityId.value,
      departmentId: orgUnitId.value,
      managerId: managerId.value,
      jobTitle: 'People Partner',
    });
  });

  it('updates worker organization assignments through a command with subject worker and expected version', async () => {
    const existingWorker = worker({ aggregateVersion: 7 });
    const { controller, commandBus, workerRepo } = makeController({
      workerRepo: {
        findById: vi.fn(async () => existingWorker),
        save: vi.fn(async () => undefined),
      },
    });

    await controller.assignWorkerOrganization(workerId.value, {
      legalEntityId: legalEntityId.value,
      departmentId: orgUnitId.value,
      jobTitle: 'People Partner',
    }, requestWithActor());

    expect(workerRepo.save).not.toHaveBeenCalled();
    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'UpdateWorkerOrganizationAssignment',
      aggregateType: 'WorkerProfile',
      aggregateId: workerId,
      subjectWorkerId: workerId,
      expectedVersion: 7,
      payload: {
        workerId,
        legalEntityId,
        departmentId: orgUnitId,
        jobTitle: 'People Partner',
      },
    }));
  });

  it('blocks worker assignment when the worker belongs to another tenant and does not save', async () => {
    const otherTenantWorker = worker({ tenantId: new Uuid('00000000-0000-0000-0000-000000000999') });
    const { controller, commandBus, workerRepo } = makeController({
      workerRepo: {
        findById: vi.fn(async () => otherTenantWorker),
        save: vi.fn(async () => undefined),
      },
    });

    await expect(controller.assignWorkerOrganization(workerId.value, {
      legalEntityId: legalEntityId.value,
      departmentId: orgUnitId.value,
      jobTitle: 'People Partner',
    }, requestWithActor())).rejects.toBeInstanceOf(BadRequestException);

    expect(commandBus.execute).not.toHaveBeenCalled();
    expect(workerRepo.save).not.toHaveBeenCalled();
  });

  it('keeps the existing active reporting line until replacement manager assignment succeeds', async () => {
    const existingWorker = worker();
    const existingRelationship = managerRelationship();
    const { controller, commandBus, workerRepo, managerRelationshipRepo } = makeController({
      workerRepo: {
        findById: vi.fn(async () => existingWorker),
        save: vi.fn(async () => undefined),
      },
      managerRelationshipRepo: {
        findByTenant: vi.fn(),
        findByWorker: vi.fn(),
        findActiveForWorker: vi.fn(async () => existingRelationship),
      },
    });

    await controller.assignWorkerOrganization(workerId.value, {
      legalEntityId: legalEntityId.value,
      departmentId: orgUnitId.value,
      managerId: newManagerId.value,
      jobTitle: 'People Partner',
    }, requestWithActor());

    expect(managerRelationshipRepo.findActiveForWorker).toHaveBeenCalledWith(workerId);
    expect(commandBus.execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      commandName: 'AssignManager',
      aggregateType: 'ManagerRelationship',
      payload: {
        workerId,
        managerId: newManagerId,
        departmentId: orgUnitId,
      },
    }));
    expect(commandBus.execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      commandName: 'UpdateWorkerOrganizationAssignment',
      aggregateType: 'WorkerProfile',
      aggregateId: workerId,
      payload: {
        workerId,
        legalEntityId,
        departmentId: orgUnitId,
        managerId: newManagerId,
        jobTitle: 'People Partner',
      },
    }));
    expect(commandBus.execute).toHaveBeenNthCalledWith(3, expect.objectContaining({
      commandName: 'EndManagerRelationship',
      aggregateType: 'ManagerRelationship',
      aggregateId: relationshipId,
      payload: {
        relationshipId,
      },
    }));
    expect(workerRepo.save).not.toHaveBeenCalled();
  });

  it('does not save worker assignment changes when assigning the manager fails validation', async () => {
    const existingWorker = worker({ jobTitle: 'Coordinator' });
    const { controller, workerRepo } = makeController({
      commandBus: {
        execute: vi.fn(async () => ({
          success: false,
          errorCode: 'ORG_VALIDATION_FAILED',
          errorMessage: 'Manager cannot report to this department',
        })),
      },
      workerRepo: {
        findById: vi.fn(async () => existingWorker),
        save: vi.fn(async () => undefined),
      },
      managerRelationshipRepo: {
        findByTenant: vi.fn(),
        findByWorker: vi.fn(),
        findActiveForWorker: vi.fn(async () => undefined),
      },
    });

    await expect(controller.assignWorkerOrganization(workerId.value, {
      legalEntityId: legalEntityId.value,
      departmentId: orgUnitId.value,
      managerId: managerId.value,
      jobTitle: 'People Partner',
    }, requestWithActor())).rejects.toBeInstanceOf(BadRequestException);

    expect(workerRepo.save).not.toHaveBeenCalled();
    expect(existingWorker.jobTitle).toBe('Coordinator');
    expect(existingWorker.managerId).toBeUndefined();
  });

  it('does not end the active reporting line when replacement manager assignment fails validation', async () => {
    const existingWorker = worker({
      legalEntityId,
      departmentId: orgUnitId,
      managerId,
      jobTitle: 'Coordinator',
    });
    const existingRelationship = managerRelationship();
    const { controller, commandBus, workerRepo } = makeController({
      commandBus: {
        execute: vi.fn(async (command) => command.commandName === 'AssignManager'
          ? {
              success: false,
              errorCode: 'ORG_VALIDATION_FAILED',
              errorMessage: 'Replacement manager is invalid',
            }
          : { success: true }),
      },
      workerRepo: {
        findById: vi.fn(async () => existingWorker),
        save: vi.fn(async () => undefined),
      },
      managerRelationshipRepo: {
        findByTenant: vi.fn(),
        findByWorker: vi.fn(),
        findActiveForWorker: vi.fn(async () => existingRelationship),
      },
    });

    await expect(controller.assignWorkerOrganization(workerId.value, {
      legalEntityId: legalEntityId.value,
      departmentId: orgUnitId.value,
      managerId: newManagerId.value,
      jobTitle: 'People Partner',
    }, requestWithActor())).rejects.toBeInstanceOf(BadRequestException);

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'AssignManager',
      payload: expect.objectContaining({ managerId: newManagerId }),
    }));
    expect(commandBus.execute).not.toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'EndManagerRelationship',
    }));
    expect(workerRepo.save).not.toHaveBeenCalled();
  });

  it('clears worker organization assignment fields when explicit null values are provided', async () => {
    const existingWorker = worker({
      legalEntityId,
      departmentId: orgUnitId,
      managerId,
      jobTitle: 'Coordinator',
      aggregateVersion: 8,
    });
    const { controller, commandBus } = makeController({
      workerRepo: {
        findById: vi.fn(async () => existingWorker),
        save: vi.fn(async () => undefined),
      },
      managerRelationshipRepo: {
        findByTenant: vi.fn(),
        findByWorker: vi.fn(),
        findActiveForWorker: vi.fn(async () => managerRelationship()),
      },
    });

    await controller.assignWorkerOrganization(workerId.value, {
      legalEntityId: null,
      departmentId: null,
      managerId: null,
      jobTitle: null,
    } as never, requestWithActor());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'UpdateWorkerOrganizationAssignment',
      aggregateType: 'WorkerProfile',
      aggregateId: workerId,
      expectedVersion: 8,
      payload: {
        workerId,
        legalEntityId: null,
        departmentId: null,
        managerId: null,
        jobTitle: null,
      },
    }));
  });

  it('does not create a duplicate manager relationship when the active reporting line already matches', async () => {
    const existingWorker = worker({
      legalEntityId,
      departmentId: orgUnitId,
      managerId,
      jobTitle: 'People Partner',
    });
    const { controller, commandBus } = makeController({
      workerRepo: {
        findById: vi.fn(async () => existingWorker),
        save: vi.fn(async () => undefined),
      },
      managerRelationshipRepo: {
        findByTenant: vi.fn(),
        findByWorker: vi.fn(),
        findActiveForWorker: vi.fn(async () => managerRelationship()),
      },
    });

    await controller.assignWorkerOrganization(workerId.value, {
      legalEntityId: legalEntityId.value,
      departmentId: orgUnitId.value,
      managerId: managerId.value,
      jobTitle: 'People Partner',
    }, requestWithActor());

    expect(commandBus.execute).not.toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'AssignManager',
    }));
    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'UpdateWorkerOrganizationAssignment',
      payload: expect.objectContaining({
        workerId,
        managerId,
      }),
    }));
  });

  it('replaces the active relationship when assigning a manager directly to a worker with another active manager', async () => {
    const { controller, commandBus, managerRelationshipRepo } = makeController({
      managerRelationshipRepo: {
        findByTenant: vi.fn(),
        findByWorker: vi.fn(),
        findActiveForWorker: vi.fn(async () => managerRelationship()),
      },
    });

    await controller.assignManager({
      workerId: workerId.value,
      managerId: newManagerId.value,
      departmentId: orgUnitId.value,
    }, requestWithActor());

    expect(managerRelationshipRepo.findActiveForWorker).toHaveBeenCalledWith(workerId);
    expect(commandBus.execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      commandName: 'AssignManager',
      payload: {
        workerId,
        managerId: newManagerId,
        departmentId: orgUnitId,
      },
    }));
    expect(commandBus.execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      commandName: 'EndManagerRelationship',
      aggregateId: relationshipId,
      payload: {
        relationshipId,
      },
    }));
  });

  it('throws a non-2xx error when command bus validation rejects organization changes', async () => {
    const { controller } = makeController({
      commandBus: {
        execute: vi.fn(async () => ({
          success: false,
          errorCode: 'ORG_VALIDATION_FAILED',
          errorMessage: 'Department belongs to a different legal entity',
        })),
      },
    });

    await expect(controller.createOrgUnit({
      orgUnitId: orgUnitId.value,
      legalEntityId: legalEntityId.value,
      name: 'People Operations',
    }, requestWithActor())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('builds a connected workforce planning dashboard from workers, positions, headcount, skills, and cost data', async () => {
    const employee = worker({
      departmentId: orgUnitId,
      legalEntityId,
      managerId,
      jobTitle: 'People Partner',
    });
    const relationship = managerRelationship();
    const { controller, workerRepo, personalDataRepo, positionRepo, headcountRepo } = makeController({
      legalEntityRepo: {
        findByTenant: vi.fn(async () => [legalEntity()]),
        findById: vi.fn(),
      },
      orgUnitRepo: {
        findByTenant: vi.fn(async () => [orgUnit({ parentId: undefined, level: 0, path: '/People Operations' })]),
        findTree: vi.fn(async () => []),
        findById: vi.fn(),
      },
      managerRelationshipRepo: {
        findByTenant: vi.fn(async () => [relationship]),
        findByWorker: vi.fn(),
        findActiveForWorker: vi.fn(),
      },
      workerRepo: {
        findById: vi.fn(async () => employee),
        searchForTenant: vi.fn(async () => [employee]),
        save: vi.fn(),
      },
      personalDataRepo: {
        findByWorkerForTenant: vi.fn(async () => [
          { dataCategory: 'COMPENSATION', payload: { grossSalaryAmount: 120000 } },
          { dataCategory: 'SKILLS', payload: { skills: [{ name: 'Data Analysis' }] } },
          { dataCategory: 'BASIC', payload: { dateOfBirth: '1962-01-01', gender: 'FEMALE' } },
          { dataCategory: 'CONTACT', payload: { workLocation: { name: 'Cairo' } } },
          { dataCategory: 'CUSTOM', payload: { grade: 'G6', businessUnit: 'Shared Services', costCenter: 'CC-100' } },
        ] as never),
      },
      positionRepo: {
        findAll: vi.fn(async () => [position()]),
      },
      headcountRepo: {
        findAll: vi.fn(async () => [headcountRequest()]),
      },
    });

    const dashboard = await controller.getWorkforcePlanningDashboard(requestWithActor());

    expect(workerRepo.searchForTenant).toHaveBeenCalledWith('', tenantId, { limit: 5000 });
    expect(personalDataRepo.findByWorkerForTenant).toHaveBeenCalledWith(workerId, tenantId);
    expect(positionRepo.findAll).toHaveBeenCalledWith(tenantId);
    expect(headcountRepo.findAll).toHaveBeenCalledWith(tenantId);
    expect(dashboard.summary).toMatchObject({
      activeHeadcount: 1,
      legalEntities: 1,
      departments: 1,
      totalPositions: 1,
      vacancies: 1,
      pendingHeadcount: 3,
    });
    expect(dashboard.workforceCostPlan).toMatchObject({
      salary: 120000,
      totalAnnualCost: 168000,
    });
    expect(dashboard.headcountPlan).toEqual([
      expect.objectContaining({
        departmentId: orgUnitId.value,
        currentHeadcount: 1,
        vacancies: 1,
        pendingRequests: 3,
        forecastDemand: 5,
      }),
    ]);
    expect(dashboard.skillsGap).toEqual([
      expect.objectContaining({
        skill: 'People Operations',
        required: 1,
        available: 0,
        gap: 1,
        severity: 'MEDIUM',
      }),
    ]);
    expect(dashboard.strategicDashboard).toMatchObject({
      vacancyRiskPercent: 100,
      retirementRisk: 1,
    });
    expect(dashboard.aiForecast).toHaveLength(3);
  });

  it('rejects employee users from workforce planning dashboard data', async () => {
    const { controller, workerRepo } = makeController();

    await expect(controller.getWorkforcePlanningDashboard(employeeRequest())).rejects.toBeInstanceOf(ForbiddenException);
    expect(workerRepo.searchForTenant).not.toHaveBeenCalled();
  });

  it('simulates strategic workforce scenarios using expansion, demand, outsourcing, automation, and AI-agent capacity', async () => {
    const { controller } = makeController({
      workerRepo: {
        findById: vi.fn(),
        searchForTenant: vi.fn(async () => [worker({ departmentId: orgUnitId, legalEntityId })]),
        save: vi.fn(),
      },
      personalDataRepo: {
        findByWorkerForTenant: vi.fn(async () => [
          { dataCategory: 'COMPENSATION', payload: { grossSalaryAmount: 100000 } },
        ] as never),
      },
      positionRepo: {
        findAll: vi.fn(async () => [position()]),
      },
      headcountRepo: {
        findAll: vi.fn(async () => []),
      },
    });

    const scenario = await controller.simulateWorkforceScenario({
      name: 'Three new branches',
      branchExpansionCount: 3,
      rolesPerBranch: 10,
      demandGrowthPercent: 10,
      automationOffsetPercent: 5,
      outsourceHeadcount: 1,
      aiAgentCapacity: 2,
    }, requestWithActor());

    expect(scenario).toMatchObject({
      name: 'Three new branches',
      baseline: {
        headcount: 1,
        annualCost: 140000,
        averageCostPerFte: 140000,
      },
      drivers: {
        expansionHeadcount: 30,
        demandHeadcount: 0,
        adminReduction: 0,
        automationReduction: 0,
        outsourceHeadcount: 1,
        aiAgentCapacity: 2,
      },
      projected: {
        headcount: 28,
        headcountDelta: 27,
      },
    });
    expect(scenario.recommendation).toContain('Open headcount requests');
  });
});
