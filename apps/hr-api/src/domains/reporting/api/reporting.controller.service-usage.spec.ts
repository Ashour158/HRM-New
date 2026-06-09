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

function response() {
  return {
    setHeader: vi.fn(),
    send: vi.fn(),
  };
}

describe('ReportingController service usage surface', () => {
  it('returns the service usage summary for the authenticated tenant', async () => {
    const serviceUsage = {
      getSummary: vi.fn().mockResolvedValue({
        tenantId: '00000000-0000-0000-0000-000000000001',
        services: [],
      }),
    } as unknown as ServiceUsageReportingService;
    const controller = new ReportingController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      serviceUsage,
    );

    await expect(controller.getServiceUsageSummary(
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
    const controller = new ReportingController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      serviceUsage,
    );

    await expect(controller.getServiceUsage(
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
    const controller = new ReportingController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      serviceUsage,
    );

    await expect(controller.getHrDashboard(
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

  it('downloads an employee import template for reporting admins', async () => {
    const controller = new ReportingController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as ServiceUsageReportingService,
    );
    const res = response();

    await controller.getEmployeeImportTemplate(request(), res as never);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="employee-import-template.csv"');
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('employeeNumber,firstName,lastName,workEmail'));
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('attendancePolicyCode,leavePlanCode,performanceCycleCode,benefitsGroupCode,serviceDeliveryGroup'));
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
    const controller = new ReportingController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      serviceUsage,
    );
    const res = response();

    await controller.exportHrDashboardCsv(request(), res as never, '2026-06-01T00:00:00.000Z');

    expect(serviceUsage.getHrDashboard).toHaveBeenCalledWith(new Uuid('00000000-0000-0000-0000-000000000001'), {
      from: new Date('2026-06-01T00:00:00.000Z'),
      to: undefined,
    });
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="hr-reporting-dashboard.csv"');
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('ATTENDANCE,Attendance Report,Workforce,TIME_ATTENDANCE,Attention,13'));
  });
});
