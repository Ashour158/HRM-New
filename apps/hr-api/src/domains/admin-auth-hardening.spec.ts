import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { ComplianceController } from './compliance/api/compliance.controller.js';
import { CountryPolicyController } from './country-policy/api/country-policy.controller.js';
import { PolicyCenterController } from './policy-center/policy-center.controller.js';
import { PositionControlController } from './position-control/api/position-control.controller.js';
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
    const controller = new ReportingController(bus as never, {} as never, {} as never, {} as never, {} as never, {} as never);

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
    const controller = new PolicyCenterController(service as never);

    await expect(controller.create({
      area: 'LEAVE',
      title: 'Annual Leave',
      draftConfig: {},
      scope: { tenantId },
    }, request(undefined))).rejects.toBeInstanceOf(ForbiddenException);

    expect(service.createRevision).not.toHaveBeenCalled();
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
