import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { ReportingController } from './reporting.controller.js';
import type { ServiceUsageReportingService } from '../services/service-usage-reporting.service.js';

function request() {
  return {
    tenantId: '00000000-0000-0000-0000-000000000001',
    actor: {
      actorType: 'USER',
      actorId: new Uuid('00000000-0000-0000-0000-000000000101'),
      roles: ['REPORTING_ADMIN'],
      permissions: [],
      mfaAuthenticated: true,
      email: 'reporting.admin@example.com',
    },
  } as never;
}

function requestWithRoles(roles: string[]) {
  return {
    tenantId: '00000000-0000-0000-0000-000000000001',
    actor: {
      actorType: 'USER',
      actorId: new Uuid('00000000-0000-0000-0000-000000000101'),
      roles,
      permissions: [],
      mfaAuthenticated: true,
      email: 'user@example.com',
    },
  } as never;
}

function response() {
  return {
    setHeader: vi.fn(),
    send: vi.fn(),
  };
}

function controller(
  serviceUsage: ServiceUsageReportingService = {} as ServiceUsageReportingService,
  analyticsReporting = {} as never,
  reportDefinitionRepo = {} as never,
) {
  return new ReportingController(
    {} as never,
    reportDefinitionRepo,
    {} as never,
    {} as never,
    {} as never,
    serviceUsage,
    analyticsReporting,
  );
}

describe('ReportingController service usage surface', () => {
  it('returns the service usage summary for the authenticated tenant', async () => {
    const serviceUsage = {
      getSummary: vi.fn().mockResolvedValue({
        tenantId: '00000000-0000-0000-0000-000000000001',
        services: [],
      }),
    } as unknown as ServiceUsageReportingService;
    const reporting = controller(serviceUsage);

    await expect(reporting.getServiceUsageSummary(
      request(),
      '2026-06-01T00:00:00.000Z',
      '2026-06-03T23:59:59.999Z',
    )).resolves.toEqual({
      tenantId: '00000000-0000-0000-0000-000000000001',
      services: [],
    });
    expect(serviceUsage.getSummary).toHaveBeenCalledWith(new Uuid('00000000-0000-0000-0000-000000000001'), {
      from: new Date('2026-06-01T00:00:00.000Z'),
      to: new Date('2026-06-03T23:59:59.999Z'),
    });
  });

  it('keeps the public service usage route wired to the same summary service', async () => {
    const serviceUsage = {
      getSummary: vi.fn().mockResolvedValue({
        tenantId: '00000000-0000-0000-0000-000000000001',
        services: [{ module: 'leave', actionCount: 2 }],
      }),
    } as unknown as ServiceUsageReportingService;
    const reporting = controller(serviceUsage);

    await expect(reporting.getServiceUsage(
      request(),
      '2026-06-01T00:00:00.000Z',
      undefined,
    )).resolves.toEqual({
      tenantId: '00000000-0000-0000-0000-000000000001',
      services: [{ module: 'leave', actionCount: 2 }],
    });
    expect(serviceUsage.getSummary).toHaveBeenCalledWith(new Uuid('00000000-0000-0000-0000-000000000001'), {
      from: new Date('2026-06-01T00:00:00.000Z'),
      to: undefined,
    });
  });

  it('returns the HR reports dashboard for the authenticated tenant', async () => {
    const serviceUsage = {
      getHrDashboard: vi.fn().mockResolvedValue({
        tenantId: '00000000-0000-0000-0000-000000000001',
        reports: [{ code: 'ATTENDANCE', title: 'Attendance Report' }],
      }),
    } as unknown as ServiceUsageReportingService;
    const reporting = controller(serviceUsage);

    await expect(reporting.getHrDashboard(
      request(),
      '2026-06-01T00:00:00.000Z',
      '2026-06-03T23:59:59.999Z',
    )).resolves.toEqual({
      tenantId: '00000000-0000-0000-0000-000000000001',
      reports: [{ code: 'ATTENDANCE', title: 'Attendance Report' }],
    });
    expect(serviceUsage.getHrDashboard).toHaveBeenCalledWith(new Uuid('00000000-0000-0000-0000-000000000001'), {
      from: new Date('2026-06-01T00:00:00.000Z'),
      to: new Date('2026-06-03T23:59:59.999Z'),
    });
  });

  it('returns the HR analytics dashboard for the authenticated tenant', async () => {
    const analyticsReporting = {
      getDashboard: vi.fn().mockResolvedValue({
        tenantId: '00000000-0000-0000-0000-000000000001',
        modules: [{ code: 'PAYROLL', title: 'Payroll Net Pay' }],
      }),
    };
    const reporting = controller({} as ServiceUsageReportingService, analyticsReporting as never);

    await expect(reporting.getHrAnalyticsDashboard(
      request(),
      { from: '2026-06-01T00:00:00.000Z', to: '2026-06-03T23:59:59.999Z' },
    )).resolves.toEqual({
      tenantId: '00000000-0000-0000-0000-000000000001',
      modules: [{ code: 'PAYROLL', title: 'Payroll Net Pay' }],
    });
    expect(analyticsReporting.getDashboard).toHaveBeenCalledWith(new Uuid('00000000-0000-0000-0000-000000000001'), {
      from: new Date('2026-06-01T00:00:00.000Z'),
      to: new Date('2026-06-03T23:59:59.999Z'),
    });
  });

  it('lists report definitions through tenant-scoped reads for reporting admins', async () => {
    const reportDefinitionRepo = {
      findByStatusForTenant: vi.fn().mockResolvedValue([{ id: 'report-1' }]),
    };
    const reporting = controller({} as ServiceUsageReportingService, {} as never, reportDefinitionRepo as never);

    await expect(reporting.listReportDefinitions(request(), 'PUBLISHED')).resolves.toEqual([{ id: 'report-1' }]);

    expect(reportDefinitionRepo.findByStatusForTenant).toHaveBeenCalledWith(
      'PUBLISHED',
      new Uuid('00000000-0000-0000-0000-000000000001'),
    );
  });

  it('blocks report definition reads for non-reporting roles', async () => {
    const reportDefinitionRepo = {
      findByStatusForTenant: vi.fn(),
    };
    const reporting = controller({} as ServiceUsageReportingService, {} as never, reportDefinitionRepo as never);

    await expect(reporting.listReportDefinitions(requestWithRoles(['EMPLOYEE']), 'PUBLISHED')).rejects.toThrow(
      'Only reporting administrators can access service usage reporting',
    );
    expect(reportDefinitionRepo.findByStatusForTenant).not.toHaveBeenCalled();
  });

  it('downloads an employee import template for reporting admins', async () => {
    const reporting = controller();
    const res = response();

    await reporting.getEmployeeImportTemplate(request(), res as never);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="employee-import-template.csv"');
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('employeeNumber,firstName,lastName,workEmail'));
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('attendancePolicyCode,leavePlanCode,performanceCycleCode,benefitsGroupCode,serviceDeliveryGroup'));
  });

  it('downloads a module import template for major module migrations', async () => {
    const reporting = controller();
    const res = response();

    await reporting.getModuleImportTemplate(request(), res as never, 'payroll');

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="payroll-import-template.csv"');
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('salaryComponentCode,componentType,amount,currency,taxTreatment,insuranceTreatment'));
  });

  it('rejects unknown module import templates', async () => {
    const reporting = controller();

    await expect(reporting.getModuleImportTemplate(request(), response() as never, 'unknown')).rejects.toThrow('Unknown migration module');
  });

  it('downloads the module migration manifest', async () => {
    const reporting = controller();
    const res = response();

    await reporting.exportMigrationManifestCsv(request(), res as never);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="hr-migration-manifest.csv"');
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('employees,Employee master data'));
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('benefits,Benefits enrollments'));
  });

  it('exports the HR reports dashboard as CSV', async () => {
    const serviceUsage = {
      getHrDashboard: vi.fn().mockResolvedValue({
        tenantId: '00000000-0000-0000-0000-000000000001',
        generatedAt: '2026-06-03T09:00:00.000Z',
        totals: { reportGroups: 1, activeReportGroups: 1, totalActivity: 13, queueBacklog: 2, issues: 3 },
        reports: [{
          code: 'ATTENDANCE',
          title: 'Attendance Report',
          category: 'Workforce',
          services: ['TIME_ATTENDANCE'],
          activity: 13,
          commands: 8,
          events: 5,
          notifications: 0,
          workflowTransitions: 0,
          queueBacklog: 2,
          issues: 3,
          readiness: 'Attention',
          chartData: [],
        }],
        activityByReport: [],
        queueHealth: {
          outbox: { pendingEvents: 2, exhaustedEvents: 0 },
          inbox: { inProgressEvents: 0, failedRetryableEvents: 0, failedNonRetryableEvents: 0, skippedEvents: 0 },
        },
      }),
    } as unknown as ServiceUsageReportingService;
    const reporting = controller(serviceUsage);
    const res = response();

    await reporting.exportHrDashboardCsv(request(), res as never, '2026-06-01T00:00:00.000Z');

    expect(serviceUsage.getHrDashboard).toHaveBeenCalledWith(new Uuid('00000000-0000-0000-0000-000000000001'), {
      from: new Date('2026-06-01T00:00:00.000Z'),
      to: undefined,
    });
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="hr-reporting-dashboard.csv"');
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('ATTENDANCE,Attendance Report,Workforce,TIME_ATTENDANCE,Attention,13'));
  });
});
