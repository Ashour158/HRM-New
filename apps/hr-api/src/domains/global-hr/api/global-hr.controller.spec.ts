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
const ruleSetId = '00000000-0000-0000-0000-000000000050';
const leaveTypeId = '00000000-0000-0000-0000-000000000060';
const consultationId = '00000000-0000-0000-0000-000000000070';

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
  const countryRuleSetRepo = {
    findByCountryCode: vi.fn(),
    findById: vi.fn(),
    findByIdForTenant: vi.fn(),
  } as unknown as CountryRuleSetRepository;
  const statutoryLeaveTypeRepo = {
    findByCountryCode: vi.fn(),
    findById: vi.fn(),
    findByIdForTenant: vi.fn(),
  } as unknown as StatutoryLeaveTypeRepository;
  const worksCouncilConsultationRepo = {
    findByLegalEntity: vi.fn(),
    findById: vi.fn(),
    findByIdForTenant: vi.fn(),
  } as unknown as WorksCouncilConsultationRepository;
  const workAuthorizationCaseRepo = {
    findById: vi.fn(),
    findByIdForTenant: vi.fn(),
    findByWorker: vi.fn(),
    findByTenant: vi.fn(),
  } as unknown as WorkAuthorizationCaseRepository;
  const internationalAssignmentRepo = {
    findById: vi.fn(),
    findByIdForTenant: vi.fn(),
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

  return {
    controller,
    commandBus,
    countryRuleSetRepo,
    statutoryLeaveTypeRepo,
    worksCouncilConsultationRepo,
    workAuthorizationCaseRepo,
    internationalAssignmentRepo,
  };
}

describe('GlobalHrController', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('routes work authorization cases through lifecycle command envelopes', async () => {
    const { controller, commandBus, workAuthorizationCaseRepo } = makeController();
    (workAuthorizationCaseRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue({
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
    (internationalAssignmentRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue({
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

  it('looks up a country rule set scoped to the authenticated tenant', async () => {
    const { controller, countryRuleSetRepo } = makeController();
    (countryRuleSetRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue({ id: new Uuid(ruleSetId) });

    await expect(controller.getCountryRuleSet(ruleSetId, request())).resolves.toEqual({ id: new Uuid(ruleSetId) });

    expect(countryRuleSetRepo.findByIdForTenant).toHaveBeenCalledWith(new Uuid(ruleSetId), new Uuid(tenantId));
    expect(countryRuleSetRepo.findById).not.toHaveBeenCalled();
  });

  it('does not leak another tenant\'s country rule set across tenants', async () => {
    const { controller, countryRuleSetRepo } = makeController();
    // The repository enforces the tenant filter in SQL; a cross-tenant id simply
    // yields no row rather than the other tenant's record.
    (countryRuleSetRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await expect(controller.getCountryRuleSet(ruleSetId, request())).resolves.toBeUndefined();

    expect(countryRuleSetRepo.findByIdForTenant).toHaveBeenCalledWith(new Uuid(ruleSetId), new Uuid(tenantId));
  });

  it('looks up a statutory leave type scoped to the authenticated tenant', async () => {
    const { controller, statutoryLeaveTypeRepo } = makeController();
    (statutoryLeaveTypeRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue({ id: new Uuid(leaveTypeId) });

    await expect(controller.getStatutoryLeaveType(leaveTypeId, request())).resolves.toEqual({ id: new Uuid(leaveTypeId) });

    expect(statutoryLeaveTypeRepo.findByIdForTenant).toHaveBeenCalledWith(new Uuid(leaveTypeId), new Uuid(tenantId));
    expect(statutoryLeaveTypeRepo.findById).not.toHaveBeenCalled();
  });

  it('does not leak another tenant\'s statutory leave type across tenants', async () => {
    const { controller, statutoryLeaveTypeRepo } = makeController();
    (statutoryLeaveTypeRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await expect(controller.getStatutoryLeaveType(leaveTypeId, request())).resolves.toBeUndefined();

    expect(statutoryLeaveTypeRepo.findByIdForTenant).toHaveBeenCalledWith(new Uuid(leaveTypeId), new Uuid(tenantId));
  });

  it('looks up a work authorization case scoped to the authenticated tenant', async () => {
    const { controller, workAuthorizationCaseRepo } = makeController();
    (workAuthorizationCaseRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue({ id: new Uuid(caseId) });

    await expect(controller.getWorkAuthorizationCase(caseId, request())).resolves.toEqual({ id: new Uuid(caseId) });

    expect(workAuthorizationCaseRepo.findByIdForTenant).toHaveBeenCalledWith(new Uuid(caseId), new Uuid(tenantId));
    expect(workAuthorizationCaseRepo.findById).not.toHaveBeenCalled();
  });

  it('does not leak another tenant\'s work authorization case across tenants', async () => {
    const { controller, workAuthorizationCaseRepo } = makeController();
    // The repository enforces the tenant filter in SQL; a cross-tenant id simply
    // yields no row rather than the other tenant's record.
    (workAuthorizationCaseRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await expect(controller.getWorkAuthorizationCase(caseId, request())).resolves.toBeUndefined();

    expect(workAuthorizationCaseRepo.findByIdForTenant).toHaveBeenCalledWith(new Uuid(caseId), new Uuid(tenantId));
  });

  it('looks up an international assignment scoped to the authenticated tenant', async () => {
    const { controller, internationalAssignmentRepo } = makeController();
    (internationalAssignmentRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue({ id: new Uuid(assignmentId) });

    await expect(controller.getInternationalAssignment(assignmentId, request())).resolves.toEqual({ id: new Uuid(assignmentId) });

    expect(internationalAssignmentRepo.findByIdForTenant).toHaveBeenCalledWith(new Uuid(assignmentId), new Uuid(tenantId));
    expect(internationalAssignmentRepo.findById).not.toHaveBeenCalled();
  });

  it('does not leak another tenant\'s international assignment across tenants', async () => {
    const { controller, internationalAssignmentRepo } = makeController();
    (internationalAssignmentRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await expect(controller.getInternationalAssignment(assignmentId, request())).resolves.toBeUndefined();

    expect(internationalAssignmentRepo.findByIdForTenant).toHaveBeenCalledWith(new Uuid(assignmentId), new Uuid(tenantId));
  });

  it('looks up a works-council consultation scoped to the authenticated tenant', async () => {
    const { controller, worksCouncilConsultationRepo } = makeController();
    (worksCouncilConsultationRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue({ id: new Uuid(consultationId) });

    await expect(controller.getWorksCouncilConsultation(consultationId, request())).resolves.toEqual({ id: new Uuid(consultationId) });

    expect(worksCouncilConsultationRepo.findByIdForTenant).toHaveBeenCalledWith(new Uuid(consultationId), new Uuid(tenantId));
    expect(worksCouncilConsultationRepo.findById).not.toHaveBeenCalled();
  });

  it('does not leak another tenant\'s works-council consultation across tenants', async () => {
    const { controller, worksCouncilConsultationRepo } = makeController();
    (worksCouncilConsultationRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await expect(controller.getWorksCouncilConsultation(consultationId, request())).resolves.toBeUndefined();

    expect(worksCouncilConsultationRepo.findByIdForTenant).toHaveBeenCalledWith(new Uuid(consultationId), new Uuid(tenantId));
  });

  /* ------------------------------------------------------------------ */
  /*  Country rule set lifecycle routes (C-4/H-1 regression coverage)   */
  /* ------------------------------------------------------------------ */

  it('dispatches ActivateCountryRuleSet with the loaded aggregate state and version', async () => {
    const { controller, commandBus, countryRuleSetRepo } = makeController();
    (countryRuleSetRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(ruleSetId),
      status: 'DRAFT',
      aggregateVersion: 0,
    });

    await controller.activateCountryRuleSet(ruleSetId, request());

    expect(countryRuleSetRepo.findByIdForTenant).toHaveBeenCalledWith(new Uuid(ruleSetId), new Uuid(tenantId));
    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'ActivateCountryRuleSet',
      aggregateType: 'CountryRuleSet',
      aggregateId: new Uuid(ruleSetId),
      expectedState: 'DRAFT',
      expectedVersion: 0,
      payload: { ruleSetId: new Uuid(ruleSetId) },
    }));
  });

  it('dispatches SupersedeCountryRuleSet with the optional supersededBy field', async () => {
    const { controller, commandBus, countryRuleSetRepo } = makeController();
    (countryRuleSetRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(ruleSetId),
      status: 'ACTIVE',
      aggregateVersion: 1,
    });

    await controller.supersedeCountryRuleSet(ruleSetId, { supersededBy: 'v2' }, request());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'SupersedeCountryRuleSet',
      aggregateType: 'CountryRuleSet',
      aggregateId: new Uuid(ruleSetId),
      expectedState: 'ACTIVE',
      expectedVersion: 1,
      payload: { ruleSetId: new Uuid(ruleSetId), supersededBy: 'v2' },
    }));
  });

  it('dispatches RetireCountryRuleSet with the loaded aggregate state and version', async () => {
    const { controller, commandBus, countryRuleSetRepo } = makeController();
    (countryRuleSetRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(ruleSetId),
      status: 'ACTIVE',
      aggregateVersion: 1,
    });

    await controller.retireCountryRuleSet(ruleSetId, request());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'RetireCountryRuleSet',
      aggregateType: 'CountryRuleSet',
      aggregateId: new Uuid(ruleSetId),
      expectedState: 'ACTIVE',
      expectedVersion: 1,
      payload: { ruleSetId: new Uuid(ruleSetId) },
    }));
  });

  it('rejects country rule set lifecycle commands for a rule set that does not resolve in the caller\'s tenant', async () => {
    const { controller, countryRuleSetRepo } = makeController();
    (countryRuleSetRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await expect(controller.activateCountryRuleSet(ruleSetId, request())).rejects.toThrow('Country rule set not found');

    expect(countryRuleSetRepo.findByIdForTenant).toHaveBeenCalledWith(new Uuid(ruleSetId), new Uuid(tenantId));
  });

  /* ------------------------------------------------------------------ */
  /*  Statutory leave type lifecycle routes (H-1 regression coverage)   */
  /* ------------------------------------------------------------------ */

  it('dispatches UpdateStatutoryLeaveType with the changed fields and loaded aggregate state', async () => {
    const { controller, commandBus, statutoryLeaveTypeRepo } = makeController();
    (statutoryLeaveTypeRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(leaveTypeId),
      status: 'ACTIVE',
      aggregateVersion: 2,
    });

    await controller.updateStatutoryLeaveType(leaveTypeId, { minimumEntitlement: 15, unit: 'DAYS' }, request());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'UpdateStatutoryLeaveType',
      aggregateType: 'StatutoryLeaveType',
      aggregateId: new Uuid(leaveTypeId),
      expectedState: 'ACTIVE',
      expectedVersion: 2,
      payload: expect.objectContaining({
        leaveTypeId: new Uuid(leaveTypeId),
        minimumEntitlement: 15,
        unit: 'DAYS',
      }),
    }));
  });

  it('dispatches SupersedeStatutoryLeaveType with the loaded aggregate state and version', async () => {
    const { controller, commandBus, statutoryLeaveTypeRepo } = makeController();
    (statutoryLeaveTypeRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(leaveTypeId),
      status: 'ACTIVE',
      aggregateVersion: 0,
    });

    await controller.supersedeStatutoryLeaveType(leaveTypeId, request());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'SupersedeStatutoryLeaveType',
      aggregateType: 'StatutoryLeaveType',
      aggregateId: new Uuid(leaveTypeId),
      expectedState: 'ACTIVE',
      expectedVersion: 0,
      payload: { leaveTypeId: new Uuid(leaveTypeId) },
    }));
  });

  it('rejects statutory leave type lifecycle commands for a leave type that does not resolve in the caller\'s tenant', async () => {
    const { controller, statutoryLeaveTypeRepo } = makeController();
    (statutoryLeaveTypeRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await expect(controller.supersedeStatutoryLeaveType(leaveTypeId, request())).rejects.toThrow('Statutory leave type not found');

    expect(statutoryLeaveTypeRepo.findByIdForTenant).toHaveBeenCalledWith(new Uuid(leaveTypeId), new Uuid(tenantId));
  });

  /* ------------------------------------------------------------------ */
  /*  Works-council consultation lifecycle routes (C-4 regression      */
  /*  coverage) -- these unblock the permanently-stuck REQUIRED state.  */
  /* ------------------------------------------------------------------ */

  it('dispatches InitiateWorksCouncilConsultation with the loaded aggregate state and optional deadline', async () => {
    const { controller, commandBus, worksCouncilConsultationRepo } = makeController();
    (worksCouncilConsultationRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(consultationId),
      status: 'REQUIRED',
      aggregateVersion: 0,
    });

    const deadlineDate = new Date('2026-08-19T00:00:00.000Z');
    await controller.initiateWorksCouncilConsultation(consultationId, { deadlineDate }, request());

    expect(worksCouncilConsultationRepo.findByIdForTenant).toHaveBeenCalledWith(new Uuid(consultationId), new Uuid(tenantId));
    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'InitiateWorksCouncilConsultation',
      aggregateType: 'WorksCouncilConsultation',
      aggregateId: new Uuid(consultationId),
      expectedState: 'REQUIRED',
      expectedVersion: 0,
      payload: { consultationId: new Uuid(consultationId), deadlineDate },
    }));
  });

  it('dispatches StartWorksCouncilProgress with the loaded aggregate state and version', async () => {
    const { controller, commandBus, worksCouncilConsultationRepo } = makeController();
    (worksCouncilConsultationRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(consultationId),
      status: 'INITIATED',
      aggregateVersion: 1,
    });

    await controller.startWorksCouncilProgress(consultationId, request());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'StartWorksCouncilProgress',
      aggregateType: 'WorksCouncilConsultation',
      aggregateId: new Uuid(consultationId),
      expectedState: 'INITIATED',
      expectedVersion: 1,
      payload: { consultationId: new Uuid(consultationId) },
    }));
  });

  it('dispatches CompleteWorksCouncilConsultation with the loaded aggregate state and version', async () => {
    const { controller, commandBus, worksCouncilConsultationRepo } = makeController();
    (worksCouncilConsultationRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(consultationId),
      status: 'IN_PROGRESS',
      aggregateVersion: 2,
    });

    await controller.completeWorksCouncilConsultation(consultationId, request());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CompleteWorksCouncilConsultation',
      aggregateType: 'WorksCouncilConsultation',
      aggregateId: new Uuid(consultationId),
      expectedState: 'IN_PROGRESS',
      expectedVersion: 2,
      payload: { consultationId: new Uuid(consultationId) },
    }));
  });

  it('dispatches BlockWorksCouncilAction with the loaded aggregate state and optional blockingUntil', async () => {
    const { controller, commandBus, worksCouncilConsultationRepo } = makeController();
    (worksCouncilConsultationRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: new Uuid(consultationId),
      status: 'IN_PROGRESS',
      aggregateVersion: 2,
    });

    const blockingUntil = new Date('2026-09-01T00:00:00.000Z');
    await controller.blockWorksCouncilAction(consultationId, { blockingUntil }, request());

    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'BlockWorksCouncilAction',
      aggregateType: 'WorksCouncilConsultation',
      aggregateId: new Uuid(consultationId),
      expectedState: 'IN_PROGRESS',
      expectedVersion: 2,
      payload: { consultationId: new Uuid(consultationId), blockingUntil },
    }));
  });

  it('rejects works-council consultation lifecycle commands for a consultation that does not resolve in the caller\'s tenant', async () => {
    const { controller, worksCouncilConsultationRepo } = makeController();
    (worksCouncilConsultationRepo.findByIdForTenant as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await expect(controller.startWorksCouncilProgress(consultationId, request()))
      .rejects.toThrow('Works council consultation not found');

    expect(worksCouncilConsultationRepo.findByIdForTenant).toHaveBeenCalledWith(new Uuid(consultationId), new Uuid(tenantId));
  });
});
