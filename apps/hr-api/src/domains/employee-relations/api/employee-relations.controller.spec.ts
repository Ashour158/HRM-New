import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';
import { EmployeeRelationsController } from './employee-relations.controller.js';
import type { CommandBus } from '../../../platform/command-bus/command-bus.js';
import type { EmployeeRelationsCaseRepository } from '../repositories/employee-relations-case.repository.js';
import type { ErInvestigationRepository } from '../repositories/er-investigation.repository.js';
import type { DisciplinaryActionRepository } from '../repositories/disciplinary-action.repository.js';
import type { AccommodationCaseRepository } from '../repositories/accommodation-case.repository.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const actorId = '00000000-0000-0000-0000-000000000010';
const workerId = '00000000-0000-0000-0000-000000000100';
const investigatorId = '00000000-0000-0000-0000-000000000101';
const erCaseId = '00000000-0000-0000-0000-000000000200';

function actor(): HrActor {
  return {
    actorType: 'USER',
    actorId: new Uuid(actorId),
    roles: ['HR_ADMIN'],
    permissions: ['EMPLOYEE_RELATIONS_WRITE', 'EMPLOYEE_RELATIONS_READ'],
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
  const erCaseRepo = {
    findById: vi.fn(),
    findByTenant: vi.fn(),
    findBySubjectWorker: vi.fn(),
  } as unknown as EmployeeRelationsCaseRepository;
  const erInvestigationRepo = {
    findById: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as ErInvestigationRepository;
  const disciplinaryActionRepo = {
    findById: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as DisciplinaryActionRepository;
  const accommodationCaseRepo = {
    findById: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as AccommodationCaseRepository;

  const controller = new EmployeeRelationsController(
    commandBus,
    erCaseRepo,
    erInvestigationRepo,
    disciplinaryActionRepo,
    accommodationCaseRepo,
  );

  return { controller, commandBus };
}

describe('EmployeeRelationsController', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('opens employee relations cases with subject and assignment context', async () => {
    const { controller, commandBus } = makeController();

    await controller.createErCase({
      caseNumber: 'ER-2026-0001',
      subjectWorkerId: workerId,
      caseType: 'GRIEVANCE',
      severity: 'MEDIUM',
      description: 'Employee relations concern raised by worker',
      openedBy: actorId,
      assignedTo: investigatorId,
    }, request());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CreateEmployeeRelationsCase',
      aggregateType: 'EmployeeRelationsCase',
      tenantId: new Uuid(tenantId),
      actor: expect.objectContaining({ actorId: new Uuid(actorId) }),
      payload: expect.objectContaining({
        caseNumber: 'ER-2026-0001',
        subjectWorkerId: workerId,
        caseType: 'GRIEVANCE',
      }),
    }));
  });

  it('opens investigations against an employee relations case', async () => {
    const { controller, commandBus } = makeController();

    await controller.createErInvestigation({
      erCaseId,
      leadInvestigatorId: investigatorId,
    }, request());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CreateErInvestigation',
      aggregateType: 'ErInvestigation',
      payload: {
        erCaseId,
        leadInvestigatorId: investigatorId,
      },
    }));
  });

  it('records disciplinary actions linked to an employee relations case', async () => {
    const { controller, commandBus } = makeController();
    const effectiveDate = new Date('2026-07-01T00:00:00.000Z');

    await controller.draftDisciplinaryAction({
      workerId,
      erCaseId,
      actionType: 'WRITTEN_WARNING',
      severity: 'HIGH',
      description: 'Policy breach confirmed after investigation',
      effectiveDate,
    }, request());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'DraftDisciplinaryAction',
      aggregateType: 'DisciplinaryAction',
      payload: {
        workerId,
        erCaseId,
        actionType: 'WRITTEN_WARNING',
        severity: 'HIGH',
        description: 'Policy breach confirmed after investigation',
        effectiveDate,
      },
    }));
  });

  it('creates accommodation requests with worker and documentation context', async () => {
    const { controller, commandBus } = makeController();

    await controller.createAccommodationCase({
      workerId,
      requestType: 'WORKSTATION_ADJUSTMENT',
      description: 'Ergonomic workstation accommodation request',
      medicalDocumentation: 'encrypted-doc-ref-001',
      accommodationDetails: 'Adjustable desk and chair',
    }, request());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CreateAccommodationCase',
      aggregateType: 'AccommodationCase',
      payload: expect.objectContaining({
        workerId,
        requestType: 'WORKSTATION_ADJUSTMENT',
        medicalDocumentation: 'encrypted-doc-ref-001',
      }),
    }));
  });
});
