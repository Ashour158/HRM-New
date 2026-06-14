import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request } from 'express';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';
import { GlobalHrController } from './global-hr.controller.js';
import type { CommandBus } from '../../../platform/command-bus/command-bus.js';
import type { CountryRuleSetRepository } from '../repositories/country-rule-set.repository.js';
import type { StatutoryLeaveTypeRepository } from '../repositories/statutory-leave-type.repository.js';
import type { WorksCouncilConsultationRepository } from '../repositories/works-council-consultation.repository.js';
import type { WorkAuthorizationCaseRepository } from '../repositories/work-authorization-case.repository.js';
import type { InternationalAssignmentRepository } from '../repositories/international-assignment.repository.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const otherTenantId = '00000000-0000-0000-0000-000000000999';
const actorId = '00000000-0000-0000-0000-000000000010';
const workerId = '00000000-0000-0000-0000-000000000020';
const caseId = '00000000-0000-0000-0000-000000000030';
const assignmentId = '00000000-0000-0000-0000-000000000040';

function actor(): HrActor {
  return {
    actorType: 'USER',
    actorId: new Uuid(actorId),
    roles: ['HR_ADMIN', 'GLOBAL_HR_ADMIN'],
    permissions: ['GLOBAL_HR_READ', 'GLOBAL_HR_WRITE'],
    email: 'global.hr@example.com',
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
  const countryRuleSetRepo = { findByCountryCode: vi.fn(), findById: vi.fn() } as unknown as CountryRuleSetRepository;
  const statutoryLeaveTypeRepo = { findByCountryCode: vi.fn(), findById: vi.fn() } as unknown as StatutoryLeaveTypeRepository;
  const worksCouncilConsultationRepo = { findByLegalEntity: vi.fn(), findById: vi.fn() } as unknown as WorksCouncilConsultationRepository;
  const workAuthorizationCaseRepo = {
    findById: vi.fn(),
    findByWorker: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as WorkAuthorizationCaseRepository;
  const internationalAssignmentRepo = {
    findById: vi.fn(),
    findByWorker: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as InternationalAssignmentRepository;

  const controller = new GlobalHrController(
    commandBus,
    countryRuleSetRepo,
    statutoryLeaveTypeRepo,
    worksCouncilConsultationRepo,
    workAuthorizationCaseRepo,
    internationalAssignmentRepo,
  );

  return { controller, commandBus, workAuthorizationCaseRepo, internationalAssignmentRepo };
}

describe('GlobalHrController', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('routes work authorization cases through lifecycle command envelopes', async () => {
    const { controller, commandBus, workAuthorizationCaseRepo } = makeController();
    (workAuthorizationCaseRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(caseId),
      workerId: new Uuid(workerId),
      status: 'UNDER_REVIEW',
      aggregateVersion: 3,
    });

    await controller.startWorkAuthorizationReview(caseId, request());
    await controller.approveWorkAuthorizationCase(
      caseId,
      {
        validFrom: new Date('2026-07-01T00:00:00.000Z'),
        validUntil: new Date('2027-07-01T00:00:00.000Z'),
        documentNumber: 'WP-2026-001',
      },
      request(),
    );

    expect(commandBus.execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      commandName: 'StartWorkAuthorizationReview',
      aggregateType: 'WorkAuthorizationCase',
      aggregateId: new Uuid(caseId),
      payload: { workAuthorizationCaseId: new Uuid(caseId) },
    }));
    expect(commandBus.execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      commandName: 'ApproveWorkAuthorizationCase',
      aggregateType: 'WorkAuthorizationCase',
      aggregateId: new Uuid(caseId),
      expectedState: 'UNDER_REVIEW',
      expectedVersion: 3,
      payload: expect.objectContaining({
        workAuthorizationCaseId: new Uuid(caseId),
        documentNumber: 'WP-2026-001',
      }),
    }));
  });

  it('lists work authorization cases by the authenticated tenant only', async () => {
    const { controller, workAuthorizationCaseRepo } = makeController();
    (workAuthorizationCaseRepo.findByTenant as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: new Uuid(caseId) }]);

    await expect(controller.getWorkAuthorizationCasesByTenant(tenantId, request())).resolves.toHaveLength(1);
    await expect(controller.getWorkAuthorizationCasesByTenant(otherTenantId, request())).rejects.toThrow('Tenant mismatch');

    expect(workAuthorizationCaseRepo.findByTenant).toHaveBeenCalledWith(new Uuid(tenantId));
  });

  it('creates and advances international assignments through approval and activation', async () => {
    const { controller, commandBus, internationalAssignmentRepo } = makeController();
    (internationalAssignmentRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(assignmentId),
      workerId: new Uuid(workerId),
      status: 'APPROVED',
      aggregateVersion: 2,
    });

    await controller.createInternationalAssignment({
      assignmentId,
      workerId,
      homeCountry: 'EG',
      hostCountry: 'AE',
      legalEntityId: '00000000-0000-0000-0000-000000000050',
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      endDate: new Date('2027-08-01T00:00:00.000Z'),
      assignmentReason: 'Regional expansion',
    }, request());
    await controller.activateInternationalAssignment(assignmentId, request());

    expect(commandBus.execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      commandName: 'CreateInternationalAssignment',
      aggregateType: 'InternationalAssignment',
      payload: expect.objectContaining({
        assignmentId,
        workerId,
        hostCountry: 'AE',
      }),
    }));
    expect(commandBus.execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      commandName: 'ActivateInternationalAssignment',
      aggregateType: 'InternationalAssignment',
      aggregateId: new Uuid(assignmentId),
      expectedState: 'APPROVED',
      expectedVersion: 2,
      payload: { internationalAssignmentId: new Uuid(assignmentId) },
    }));
  });

  it('lists international assignments by the authenticated tenant only', async () => {
    const { controller, internationalAssignmentRepo } = makeController();
    (internationalAssignmentRepo.findByTenant as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: new Uuid(assignmentId) }]);

    await expect(controller.getInternationalAssignmentsByTenant(tenantId, request())).resolves.toHaveLength(1);
    await expect(controller.getInternationalAssignmentsByTenant(otherTenantId, request())).rejects.toThrow('Tenant mismatch');

    expect(internationalAssignmentRepo.findByTenant).toHaveBeenCalledWith(new Uuid(tenantId));
  });
});
