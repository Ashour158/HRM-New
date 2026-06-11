import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { ReportingController } from './reporting.controller.js';
import type { ServiceUsageReportingService } from '../services/service-usage-reporting.service.js';
import { ReportBuilderCatalogService } from '../services/report-builder-catalog.service.js';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

function request() {
  return {
    tenantId: TENANT_ID,
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
    tenantId: TENANT_ID,
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
  reportingRepos: {
    commandBus?: unknown;
    reportExecutionRepo?: unknown;
    reportScheduleRepo?: unknown;
    calculatedFieldRepo?: unknown;
  } = {},
) {
  return new ReportingController(
    (reportingRepos.commandBus ?? {}) as never,
    reportDefinitionRepo,
    (reportingRepos.reportExecutionRepo ?? {}) as never,
    (reportingRepos.reportScheduleRepo ?? {}) as never,
    (reportingRepos.calculatedFieldRepo ?? {}) as never,
    serviceUsage,
    analyticsReporting,
    new ReportBuilderCatalogService(),
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
      new Uuid(TENANT_ID),
    );
  });

  it('lists report definitions across lifecycle states for the reporting builder library', async () => {
    const reportDefinitionRepo = {
      findByStatusForTenant: vi.fn()
        .mockResolvedValueOnce([{ id: 'draft-report' }])
        .mockResolvedValueOnce([{ id: 'published-report' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    };
    const reporting = controller({} as ServiceUsageReportingService, {} as never, reportDefinitionRepo as never);

    await expect(reporting.listReportDefinitions(request(), 'ALL')).resolves.toEqual([
      { id: 'draft-report' },
      { id: 'published-report' },
    ]);

    expect(reportDefinitionRepo.findByStatusForTenant).toHaveBeenCalledTimes(4);
    expect(reportDefinitionRepo.findByStatusForTenant).toHaveBeenNthCalledWith(1, 'DRAFT', new Uuid(TENANT_ID));
    expect(reportDefinitionRepo.findByStatusForTenant).toHaveBeenNthCalledWith(2, 'PUBLISHED', new Uuid(TENANT_ID));
  });

  it('exposes report builder catalog and previews selected fields without raw SQL', async () => {
    const reporting = controller();

    const catalog = await reporting.getReportBuilderCatalog(request());
    expect(catalog.dataSources.map((source) => source.code)).toEqual(expect.arrayContaining(['ATTENDANCE', 'LEAVE', 'PAYROLL', 'BENEFITS', 'COMPLIANCE', 'SERVICES']));
    expect(catalog.analyticsPacks.map((pack) => pack.code)).toEqual(expect.arrayContaining(['FULL_HR_ANALYTICS', 'WORKFORCE_HEALTH', 'REWARD_CONTROL']));
    expect(catalog.dataSources.find((source) => source.code === 'ATTENDANCE')?.filters.some((filter) => filter.options && filter.options.length > 0)).toBe(true);
    expect(catalog.populationOptions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        scopeLevel: 'LEGAL_ENTITY',
        values: expect.arrayContaining([expect.objectContaining({ code: 'ACME_EG' })]),
      }),
      expect.objectContaining({
        scopeLevel: 'MANAGER',
        values: expect.arrayContaining([expect.objectContaining({ code: 'MGR_JAMES_HARRINGTON' })]),
      }),
    ]));

    await expect(reporting.previewReportDefinition({
      dataSource: 'ATTENDANCE',
      queryDefinition: {
        fields: ['employeeNumber', 'employeeName', 'workDate'],
        metrics: ['lateMinutes', 'exceptions'],
        groupBy: ['department'],
        scopeLevel: 'DEPARTMENT',
        populationValue: 'ENGINEERING',
        visualization: 'bar',
      },
    }, request())).resolves.toMatchObject({
      valid: true,
      dataSource: 'ATTENDANCE',
      scopeLevel: 'DEPARTMENT',
      columns: ['employeeNumber', 'employeeName', 'workDate'],
      metrics: ['lateMinutes', 'exceptions'],
      groupBy: ['department'],
    });
  });

  it('exposes smart BI categories and business relationships in the builder catalog', async () => {
    const reporting = controller();

    const catalog = await reporting.getReportBuilderCatalog(request());

    expect(catalog.smartCategories.map((category) => category.code)).toEqual(expect.arrayContaining([
      'WORKFORCE_COMPOSITION',
      'ORG_LOCATION',
      'ATTENDANCE_BEHAVIOR',
      'LEAVE_BEHAVIOR',
      'PAYROLL_COST',
      'BENEFITS_ANALYTICS',
      'TALENT_PERFORMANCE',
      'EMPLOYEE_EXPERIENCE',
      'TALENT_ACQUISITION',
      'GOVERNANCE_COMPLIANCE',
    ]));
    expect(catalog.smartCategories.map((category) => category.title)).toEqual(expect.arrayContaining([
      'Workforce Composition',
      'Organization & Location',
      'Attendance Behavior',
      'Leave Behavior',
      'Payroll, Cost & Deductions',
      'Benefits',
      'Performance & 360',
      'Engagement & Sentiment',
      'Recruitment & Onboarding',
      'Compliance, Access & Audit',
    ]));
    expect(catalog.smartCategories).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'PAYROLL_COST',
        businessQuestions: expect.arrayContaining(['Why did payroll cost change?']),
        dataSources: expect.arrayContaining(['PAYROLL', 'ATTENDANCE', 'LEAVE', 'BENEFITS']),
        insights: expect.arrayContaining([
          expect.objectContaining({
            code: 'gross-to-net-bridge',
            relatedReports: expect.arrayContaining(['payroll-cost-summary']),
          }),
        ]),
      }),
    ]));
    expect(catalog.businessRelationships).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'attendance-payroll', from: 'ATTENDANCE', to: 'PAYROLL', grain: 'Worker-day to payroll period', privacyLevel: 'sensitive', joinKeys: expect.arrayContaining(['workerId', 'payPeriod']) }),
      expect.objectContaining({ code: 'benefits-payroll', from: 'BENEFITS', to: 'PAYROLL', privacyLevel: 'restricted', recommendedDrilldowns: expect.arrayContaining(['Program', 'Coverage level']) }),
      expect.objectContaining({ code: 'recruitment-onboarding-headcount', from: 'RECRUITMENT', to: 'ONBOARDING' }),
      expect.objectContaining({ code: 'compliance-access-audit', from: 'COMPLIANCE', to: 'ACCESS' }),
    ]));
  });

  it('warns when a scoped report has no selected population', async () => {
    const reporting = controller();

    await expect(reporting.previewReportDefinition({
      dataSource: 'ATTENDANCE',
      queryDefinition: {
        fields: ['employeeNumber'],
        metrics: ['lateMinutes'],
        groupBy: ['department'],
        scopeLevel: 'DEPARTMENT',
        visualization: 'bar',
      },
    }, request())).resolves.toMatchObject({
      valid: false,
      warnings: expect.arrayContaining(['Select a department population before publishing this report.']),
    });
  });

  it('runs a smart analytics pack from the builder catalog', async () => {
    const reporting = controller();

    await expect(reporting.runReportAnalyticsPack({
      packCode: 'FULL_HR_ANALYTICS',
      scopeLevel: 'TENANT',
      period: 'CURRENT_MONTH',
      selectedReportCodes: ['attendance-exceptions-monthly', 'payroll-cost-summary'],
      filters: [{ code: 'department', value: 'ENGINEERING' }],
    }, request())).resolves.toMatchObject({
      packCode: 'FULL_HR_ANALYTICS',
      title: 'Full HR Analytics',
      scopeLevel: 'TENANT',
      period: 'CURRENT_MONTH',
      reportOptions: expect.arrayContaining([
        expect.objectContaining({ code: 'attendance-exceptions-monthly', recommended: true }),
        expect.objectContaining({ code: 'payroll-cost-summary', recommended: true }),
      ]),
      highlights: expect.arrayContaining([
        expect.objectContaining({ label: 'Active workforce' }),
      ]),
    });
  });

  it('runs a smart category from the builder catalog', async () => {
    const reporting = controller();

    await expect(reporting.runSmartAnalyticsCategory({
      categoryCode: 'PAYROLL_COST',
      scopeLevel: 'LEGAL_ENTITY',
      period: 'CURRENT_MONTH',
      selectedInsightCodes: ['gross-to-net-bridge'],
      filters: [{ code: 'legalEntity', value: 'ACME_EG' }],
    }, request())).resolves.toMatchObject({
      categoryCode: 'PAYROLL_COST',
      title: 'Payroll, Cost & Deductions',
      scopeLevel: 'LEGAL_ENTITY',
      period: 'CURRENT_MONTH',
      summary: expect.stringContaining('Payroll, Cost & Deductions analyzed across'),
      insights: [
        expect.objectContaining({
          code: 'gross-to-net-bridge',
          relatedReports: expect.arrayContaining(['payroll-cost-summary']),
        }),
      ],
      drilldowns: expect.arrayContaining(['Legal entity', 'Department', 'Pay period', 'Payroll status', 'Component', 'Employee']),
      relatedReports: expect.arrayContaining([
        expect.objectContaining({ code: 'payroll-cost-summary', dataSource: 'PAYROLL' }),
      ]),
      relationships: expect.arrayContaining([
        expect.objectContaining({ code: 'attendance-payroll' }),
        expect.objectContaining({ code: 'leave-attendance-payroll' }),
        expect.objectContaining({ code: 'benefits-payroll' }),
      ]),
    });
  });

  it('lists report executions through tenant-scoped report definition reads', async () => {
    const reportExecutionRepo = {
      findByReportDefinitionIdForTenant: vi.fn().mockResolvedValue([{ id: 'execution-1' }]),
    };
    const reporting = controller({} as ServiceUsageReportingService, {} as never, {} as never, { reportExecutionRepo });
    const reportDefinitionId = '00000000-0000-0000-0000-000000000201';

    await expect(reporting.listReportExecutions(request(), reportDefinitionId)).resolves.toEqual([{ id: 'execution-1' }]);

    expect(reportExecutionRepo.findByReportDefinitionIdForTenant).toHaveBeenCalledWith(
      new Uuid(reportDefinitionId),
      new Uuid(TENANT_ID),
    );
  });

  it('does not return a cross-tenant report execution id', async () => {
    const reportExecutionRepo = {
      findByIdForTenant: vi.fn().mockResolvedValue(undefined),
    };
    const reporting = controller({} as ServiceUsageReportingService, {} as never, {} as never, { reportExecutionRepo });
    const executionId = '00000000-0000-0000-0000-000000000202';

    await expect(reporting.getReportExecution(request(), executionId)).resolves.toBeUndefined();

    expect(reportExecutionRepo.findByIdForTenant).toHaveBeenCalledWith(
      new Uuid(executionId),
      new Uuid(TENANT_ID),
    );
  });

  it('does not queue a cross-tenant report execution id', async () => {
    const commandBus = { execute: vi.fn() };
    const reportExecutionRepo = {
      findByIdForTenant: vi.fn().mockResolvedValue(undefined),
    };
    const reporting = controller({} as ServiceUsageReportingService, {} as never, {} as never, { commandBus, reportExecutionRepo });

    await expect(reporting.queueReportExecution('00000000-0000-0000-0000-000000000203', request())).rejects.toThrow('Report execution not found');

    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('lists report schedules through tenant-scoped report definition reads', async () => {
    const reportScheduleRepo = {
      findByReportDefinitionIdForTenant: vi.fn().mockResolvedValue([{ id: 'schedule-1' }]),
    };
    const reporting = controller({} as ServiceUsageReportingService, {} as never, {} as never, { reportScheduleRepo });
    const reportDefinitionId = '00000000-0000-0000-0000-000000000301';

    await expect(reporting.listReportSchedules(request(), reportDefinitionId)).resolves.toEqual([{ id: 'schedule-1' }]);

    expect(reportScheduleRepo.findByReportDefinitionIdForTenant).toHaveBeenCalledWith(
      new Uuid(reportDefinitionId),
      new Uuid(TENANT_ID),
    );
  });

  it('does not return a cross-tenant report schedule id', async () => {
    const reportScheduleRepo = {
      findByIdForTenant: vi.fn().mockResolvedValue(undefined),
    };
    const reporting = controller({} as ServiceUsageReportingService, {} as never, {} as never, { reportScheduleRepo });
    const scheduleId = '00000000-0000-0000-0000-000000000302';

    await expect(reporting.getReportSchedule(request(), scheduleId)).resolves.toBeUndefined();

    expect(reportScheduleRepo.findByIdForTenant).toHaveBeenCalledWith(
      new Uuid(scheduleId),
      new Uuid(TENANT_ID),
    );
  });

  it('does not activate a cross-tenant report schedule id', async () => {
    const commandBus = { execute: vi.fn() };
    const reportScheduleRepo = {
      findByIdForTenant: vi.fn().mockResolvedValue(undefined),
    };
    const reporting = controller({} as ServiceUsageReportingService, {} as never, {} as never, { commandBus, reportScheduleRepo });

    await expect(reporting.activateReportSchedule('00000000-0000-0000-0000-000000000303', request())).rejects.toThrow('Report schedule not found');

    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('lists calculated fields through tenant-scoped status reads', async () => {
    const calculatedFieldRepo = {
      findByStatusForTenant: vi.fn().mockResolvedValue([{ id: 'field-1' }]),
    };
    const reporting = controller({} as ServiceUsageReportingService, {} as never, {} as never, { calculatedFieldRepo });

    await expect(reporting.listCalculatedFields(request(), 'ACTIVE')).resolves.toEqual([{ id: 'field-1' }]);

    expect(calculatedFieldRepo.findByStatusForTenant).toHaveBeenCalledWith(
      'ACTIVE',
      new Uuid(TENANT_ID),
    );
  });

  it('lists calculated fields across lifecycle states for builder formulas', async () => {
    const calculatedFieldRepo = {
      findByStatusForTenant: vi.fn()
        .mockResolvedValueOnce([{ id: 'draft-field' }])
        .mockResolvedValueOnce([{ id: 'active-field' }])
        .mockResolvedValueOnce([]),
    };
    const reporting = controller({} as ServiceUsageReportingService, {} as never, {} as never, { calculatedFieldRepo });

    await expect(reporting.listCalculatedFields(request(), 'ALL')).resolves.toEqual([
      { id: 'draft-field' },
      { id: 'active-field' },
    ]);

    expect(calculatedFieldRepo.findByStatusForTenant).toHaveBeenCalledTimes(3);
    expect(calculatedFieldRepo.findByStatusForTenant).toHaveBeenNthCalledWith(1, 'DRAFT', new Uuid(TENANT_ID));
    expect(calculatedFieldRepo.findByStatusForTenant).toHaveBeenNthCalledWith(2, 'ACTIVE', new Uuid(TENANT_ID));
  });

  it('does not return a cross-tenant calculated field id', async () => {
    const calculatedFieldRepo = {
      findByIdForTenant: vi.fn().mockResolvedValue(undefined),
    };
    const reporting = controller({} as ServiceUsageReportingService, {} as never, {} as never, { calculatedFieldRepo });
    const calculatedFieldId = '00000000-0000-0000-0000-000000000401';

    await expect(reporting.getCalculatedField(request(), calculatedFieldId)).resolves.toBeUndefined();

    expect(calculatedFieldRepo.findByIdForTenant).toHaveBeenCalledWith(
      new Uuid(calculatedFieldId),
      new Uuid(TENANT_ID),
    );
  });

  it('does not activate a cross-tenant calculated field id', async () => {
    const commandBus = { execute: vi.fn() };
    const calculatedFieldRepo = {
      findByIdForTenant: vi.fn().mockResolvedValue(undefined),
    };
    const reporting = controller({} as ServiceUsageReportingService, {} as never, {} as never, { commandBus, calculatedFieldRepo });

    await expect(reporting.activateCalculatedField('00000000-0000-0000-0000-000000000402', request())).rejects.toThrow('Calculated field not found');

    expect(commandBus.execute).not.toHaveBeenCalled();
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
