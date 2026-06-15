import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { ComplianceController } from './compliance/api/compliance.controller.js';
import { CountryPolicyController } from './country-policy/api/country-policy.controller.js';
import { HcmSetupController } from './hcm-setup/hcm-setup.controller.js';
import { LearningController } from './learning/api/learning.controller.js';
import { PolicyCenterController } from './policy-center/policy-center.controller.js';
import { PositionControlController } from './position-control/api/position-control.controller.js';
import { RecruitingController } from './recruiting/api/recruiting.controller.js';
import { ReportingController } from './reporting/api/reporting.controller.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const adminId = '00000000-0000-0000-0000-000000000101';
const employeeId = '00000000-0000-0000-0000-000000000102';

function request(roles: string[] | undefined): Request {
  return {
    tenantId,
    actor: roles ? {
      actorType: roles.includes('EMPLOYEE') ? 'EMPLOYEE' : 'USER',
      actorId: new Uuid(roles.includes('EMPLOYEE') ? employeeId : adminId),
      roles,
      permissions: [],
      mfaAuthenticated: true,
      email: roles.includes('EMPLOYEE') ? 'employee@example.com' : 'admin@example.com',
    } : undefined,
  } as unknown as Request;
}

function commandBus() {
  return {
    execute: vi.fn(async (command) => ({ success: true, command })),
  };
}

describe('admin controller auth hardening', () => {
  it('runs compliance commands as the authenticated compliance actor and rejects employees', async () => {
    const bus = commandBus();
    const controller = new ComplianceController(
      bus as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(controller.createPolicyDocument({
      documentId: '00000000-0000-0000-0000-000000000201',
      title: 'Code of Conduct',
      documentType: 'POLICY',
      version: '1.0',
      content: {},
    }, request(['EMPLOYEE']))).rejects.toBeInstanceOf(ForbiddenException);

    await controller.createPolicyDocument({
      documentId: '00000000-0000-0000-0000-000000000202',
      title: 'Code of Conduct',
      documentType: 'POLICY',
      version: '1.0',
      content: {},
    }, request(['COMPLIANCE_ADMIN']));

    expect(bus.execute).toHaveBeenCalledWith(expect.objectContaining({
      actor: expect.objectContaining({
        actorId: new Uuid(adminId),
        roles: ['COMPLIANCE_ADMIN'],
        email: 'admin@example.com',
      }),
    }));
  });

  it('runs country policy commands as the authenticated country policy actor and rejects employees', async () => {
    const bus = commandBus();
    const controller = new CountryPolicyController(bus as never, {} as never, {} as never, {} as never);

    await expect(controller.uploadCountryPolicyPack({
      packId: '00000000-0000-0000-0000-000000000301',
      countryCode: 'EG',
      version: '2026.1',
      effectiveFrom: new Date('2026-06-01'),
      uploadedBy: adminId,
    }, request(['EMPLOYEE']))).rejects.toBeInstanceOf(ForbiddenException);

    await controller.uploadCountryPolicyPack({
      packId: '00000000-0000-0000-0000-000000000302',
      countryCode: 'EG',
      version: '2026.1',
      effectiveFrom: new Date('2026-06-01'),
      uploadedBy: adminId,
    }, request(['COUNTRY_POLICY_ADMIN']));

    expect(bus.execute).toHaveBeenCalledWith(expect.objectContaining({
      actor: expect.objectContaining({
        actorId: new Uuid(adminId),
        roles: ['COUNTRY_POLICY_ADMIN'],
      }),
    }));
  });

  it('runs reporting commands as the authenticated reporting actor and rejects employees', async () => {
    const bus = commandBus();
    const controller = new ReportingController(bus as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);

    await expect(controller.createReportDefinition({
      reportDefinitionId: '00000000-0000-0000-0000-000000000401',
      reportName: 'Service Usage',
      reportType: 'OPERATIONS',
      dataSource: 'platform_service_usage',
    }, request(['EMPLOYEE']))).rejects.toBeInstanceOf(ForbiddenException);

    await controller.createReportDefinition({
      reportDefinitionId: '00000000-0000-0000-0000-000000000402',
      reportName: 'Service Usage',
      reportType: 'OPERATIONS',
      dataSource: 'platform_service_usage',
    }, request(['REPORTING_ADMIN']));

    expect(bus.execute).toHaveBeenCalledWith(expect.objectContaining({
      actor: expect.objectContaining({
        actorId: new Uuid(adminId),
        roles: ['REPORTING_ADMIN'],
      }),
    }));
  });

  it('does not treat missing Policy Center actors as local HR admins', async () => {
    const service = {
      createRevision: vi.fn(),
    };
    const controller = new PolicyCenterController(service as never, { get: () => commandBus() } as never);

    await expect(controller.create({
      area: 'LEAVE',
      title: 'Annual Leave',
      draftConfig: {},
      scope: { tenantId },
    }, request(undefined))).rejects.toBeInstanceOf(ForbiddenException);

    expect(service.createRevision).not.toHaveBeenCalled();
  });

  it('requires policy administrator scope for Policy Center read endpoints', async () => {
    const service = {
      getSummary: vi.fn(async () => ({ totalRevisions: 0 })),
      listRevisions: vi.fn(async () => []),
    };
    const controller = new PolicyCenterController(service as never, { get: () => commandBus() } as never);

    await expect(controller.summary(request(['EMPLOYEE']))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.list(request(['MANAGER']))).rejects.toBeInstanceOf(ForbiddenException);

    await expect(controller.summary(request(['HR_ADMIN']))).resolves.toEqual({ totalRevisions: 0 });
    await expect(controller.list(request(['HR_ADMIN']))).resolves.toEqual([]);

    expect(service.getSummary).toHaveBeenCalledTimes(1);
    expect(service.listRevisions).toHaveBeenCalledTimes(1);
  });

  it('requires a validated tenant context for Policy Center operations', async () => {
    const service = {
      getSummary: vi.fn(async () => ({ totalRevisions: 0 })),
    };
    const controller = new PolicyCenterController(service as never, { get: () => commandBus() } as never);
    const req = request(['HR_ADMIN']);
    delete (req as { tenantId?: string }).tenantId;

    await expect(controller.summary(req)).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.getSummary).not.toHaveBeenCalled();
  });

  it('dispatches Policy Center mutations through the command bus', async () => {
    const service = {
      createRevision: vi.fn(),
    };
    const bus = {
      execute: vi.fn(async (command) => ({
        success: true,
        data: {
          id: '00000000-0000-0000-0000-000000000601',
          area: 'LEAVE',
          title: 'Annual Leave',
          status: 'DRAFT',
        },
        commandId: command.commandId,
        correlationId: command.correlationId,
      })),
    };
    const controller = new PolicyCenterController(service as never, { get: () => bus } as never);

    await expect(controller.create({
      area: 'LEAVE',
      title: 'Annual Leave',
      draftConfig: {},
      scope: { tenantId },
    }, request(['HR_ADMIN']))).resolves.toEqual(expect.objectContaining({
      id: '00000000-0000-0000-0000-000000000601',
      status: 'DRAFT',
    }));

    expect(service.createRevision).not.toHaveBeenCalled();
    expect(bus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CreatePolicyRevision',
      aggregateType: 'PolicyRevision',
      tenantId: new Uuid(tenantId),
      actor: expect.objectContaining({
        actorId: new Uuid(adminId),
        roles: ['HR_ADMIN'],
      }),
      payload: expect.objectContaining({
        area: 'LEAVE',
        title: 'Annual Leave',
      }),
    }));
  });

  it('does not mint system actors for generated domain command controllers', async () => {
    const bus = commandBus();
    const controller = new LearningController(bus as never, {} as never, {} as never, {} as never, {} as never);

    await controller.createCourse({
      courseCode: 'SEC-101',
      title: 'Security Awareness',
    } as never, request(['LEARNING_ADMIN']));

    expect(bus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CreateLearningCourse',
      actor: expect.objectContaining({
        actorType: 'USER',
        actorId: new Uuid(adminId),
        roles: ['LEARNING_ADMIN'],
      }),
    }));
    expect(bus.execute.mock.calls[0][0].actor.actorType).not.toBe('SYSTEM');
  });

  it('runs recruiting commands with the authenticated request actor only', async () => {
    const bus = commandBus();
    const controller = new RecruitingController(
      bus as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await controller.createRequisition({
      title: 'Backend Engineer',
      positionId: '00000000-0000-0000-0000-000000000501',
    } as never, request(['RECRUITER']));

    expect(bus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'CreateJobRequisition',
      tenantId: new Uuid(tenantId),
      actor: expect.objectContaining({
        actorType: 'USER',
        actorId: new Uuid(adminId),
        roles: ['RECRUITER'],
      }),
    }));
  });

  it('requires setup administrator scope for HCM setup reads', async () => {
    const service = {
      getSetup: vi.fn(async () => ({ employeeProfile: { requiredFields: [] } })),
    };
    const controller = new HcmSetupController(service as never, { get: () => commandBus() } as never);

    await expect(controller.getSetup(request(['EMPLOYEE']))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.getSetup(request(['MANAGER']))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.getSetup(request(['HR_ADMIN']))).resolves.toEqual({ employeeProfile: { requiredFields: [] } });

    expect(service.getSetup).toHaveBeenCalledTimes(1);
  });

  it('dispatches HCM setup updates through the command bus', async () => {
    const service = {
      getSetup: vi.fn(),
      updateSetup: vi.fn(),
    };
    const bus = {
      execute: vi.fn(async (command) => ({
        success: true,
        data: { employeeIdPolicy: { mode: 'AUTO', prefix: 'EG', nextNumber: 7 } },
        commandId: command.commandId,
        correlationId: command.correlationId,
      })),
    };
    const controller = new HcmSetupController(service as never, { get: () => bus } as never);

    await expect(controller.updateSetup({
      employeeIdPolicy: { mode: 'AUTO', prefix: 'EG', nextNumber: 7 },
    } as never, request(['HR_ADMIN']))).resolves.toEqual({
      employeeIdPolicy: { mode: 'AUTO', prefix: 'EG', nextNumber: 7 },
    });

    expect(service.updateSetup).not.toHaveBeenCalled();
    expect(bus.execute).toHaveBeenCalledWith(expect.objectContaining({
      commandName: 'ConfigureHcmSetup',
      aggregateType: 'HcmSetupConfig',
      tenantId: new Uuid(tenantId),
      actor: expect.objectContaining({
        actorId: new Uuid(adminId),
        roles: ['HR_ADMIN'],
      }),
    }));
  });

  it('requires compliance administrator scope for compliance policy reads', async () => {
    const controller = new ComplianceController(
      commandBus() as never,
      {
        findByStatus: vi.fn(async () => []),
        findById: vi.fn(async () => null),
      } as never,
      {} as never,
      { findActive: vi.fn(async () => []) } as never,
      {} as never,
    );

    await expect((controller.getComplianceSummary as any)(request(['EMPLOYEE']))).rejects.toBeInstanceOf(ForbiddenException);
    await expect((controller.listPolicyDocuments as any)(undefined, request(['MANAGER']))).rejects.toBeInstanceOf(ForbiddenException);
    await expect((controller.getComplianceSummary as any)(request(['COMPLIANCE_ADMIN']))).resolves.toEqual({
      policies: [],
      acknowledgements: [],
      legalHolds: [],
      statutoryReports: [],
    });
  });

  it('requires country policy administrator scope for country policy reads', async () => {
    const controller = new CountryPolicyController(
      commandBus() as never,
      {
        findAll: vi.fn(async () => []),
        findByCountryCode: vi.fn(async () => []),
        findById: vi.fn(async () => null),
      } as never,
      { findByPolicyPackId: vi.fn(async () => []) } as never,
      { findByPolicyPackId: vi.fn(async () => []) } as never,
    );

    await expect((controller.listPolicyPacks as any)(undefined, request(['EMPLOYEE']))).rejects.toBeInstanceOf(ForbiddenException);
    await expect((controller.getValidationRunsByPolicyPack as any)(tenantId, request(['MANAGER']))).rejects.toBeInstanceOf(ForbiddenException);
    await expect((controller.listPolicyPacks as any)(undefined, request(['COUNTRY_POLICY_ADMIN']))).resolves.toEqual([]);
  });

  it('runs position-control commands as the authenticated admin actor and rejects employees', async () => {
    const bus = commandBus();
    const controller = new PositionControlController(bus as never, {} as never, {} as never, {} as never);
    const dto = {
      positionCode: 'P-ENG-001',
      title: 'Engineering Lead',
      employmentType: 'FULL_TIME',
    };

    await expect(controller.createPosition(dto, request(['EMPLOYEE']))).rejects.toBeInstanceOf(ForbiddenException);

    await controller.createPosition(dto, request(['HR_ADMIN']));

    expect(bus.execute).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: new Uuid(tenantId),
      actor: expect.objectContaining({
        actorId: new Uuid(adminId),
        roles: ['HR_ADMIN'],
      }),
    }));
  });
});
