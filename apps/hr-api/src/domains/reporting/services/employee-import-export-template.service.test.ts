import { describe, expect, it } from 'vitest';
import {
  buildEmployeeImportTemplateCsv,
  buildHrDashboardExportCsv,
  buildModuleImportTemplateCsv,
  buildModuleMigrationManifestCsv,
  migrationTemplateModules,
  type EmployeeImportTemplateOptions,
} from './employee-import-export-template.service.js';
import type { HrReportDashboard } from './service-usage-reporting.service.js';

describe('employee import/export reporting templates', () => {
  it('renders a hardened employee import template with migration-ready HR columns', () => {
    const options: EmployeeImportTemplateOptions = {
      legalEntityCode: '=LEGAL',
      departmentCode: 'HR',
    };

    const csv = buildEmployeeImportTemplateCsv(options);

    expect(csv).toContain('employeeNumber,firstName,lastName,workEmail,employmentType,hireDate');
    expect(csv).toContain('attendancePolicyCode,leavePlanCode,performanceCycleCode,benefitsGroupCode,serviceDeliveryGroup');
    expect(csv).toContain("'=LEGAL");
    expect(csv).not.toMatch(/(^|,)=LEGAL,/m);
  });

  it('renders HR dashboard report groups as an exportable CSV pack', () => {
    const dashboard: HrReportDashboard = {
      tenantId: '00000000-0000-0000-0000-000000000001',
      generatedAt: '2026-06-03T09:00:00.000Z',
      totals: {
        reportGroups: 2,
        activeReportGroups: 2,
        totalActivity: 19,
        queueBacklog: 2,
        issues: 3,
      },
      reports: [
        {
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
        },
        {
          code: 'BENEFITS',
          title: 'Benefits Report',
          category: 'Reward',
          services: ['BENEFITS'],
          activity: 6,
          commands: 2,
          events: 1,
          notifications: 1,
          workflowTransitions: 2,
          queueBacklog: 0,
          issues: 0,
          readiness: 'Live',
          lastActivityAt: '2026-06-03T08:00:00.000Z',
          chartData: [],
        },
      ],
      activityByReport: [],
      queueHealth: {
        outbox: { pendingEvents: 2, exhaustedEvents: 0 },
        inbox: { inProgressEvents: 0, failedRetryableEvents: 0, failedNonRetryableEvents: 0, skippedEvents: 0 },
      },
      catalog: [],
    };

    const csv = buildHrDashboardExportCsv(dashboard);

    expect(csv).toContain('code,title,category,services,readiness,activity,commands,events,notifications,workflowTransitions,queueBacklog,issues,lastActivityAt');
    expect(csv).toContain('ATTENDANCE,Attendance Report,Workforce,TIME_ATTENDANCE,Attention,13,8,5,0,0,2,3,');
    expect(csv).toContain('BENEFITS,Benefits Report,Reward,BENEFITS,Live,6,2,1,1,2,0,0,2026-06-03T08:00:00.000Z');
  });

  it('renders accepted import templates for every major HR module', () => {
    expect(migrationTemplateModules).toEqual([
      'employees',
      'attendance',
      'leave',
      'payroll',
      'performance',
      'benefits',
      'headcount-org',
      'compliance',
      'services',
    ]);

    for (const module of migrationTemplateModules) {
      const csv = buildModuleImportTemplateCsv(module);

      expect(csv).toContain('externalReference');
      expect(csv).toContain(module);
      expect(csv).not.toMatch(/(^|,)=/m);
    }
    expect(buildModuleImportTemplateCsv('attendance')).toContain('checkInAt,checkOutAt,workLocationCode,geofenceEvidence');
    expect(buildModuleImportTemplateCsv('leave')).toContain('leaveTypeCode,startDate,endDate,amount,unit,approvalRouteCode');
    expect(buildModuleImportTemplateCsv('payroll')).toContain('salaryComponentCode,componentType,amount,currency,taxTreatment,insuranceTreatment');
    expect(buildModuleImportTemplateCsv('performance')).toContain('cycleCode,revieweeEmployeeNumber,reviewerEmployeeNumber,relationshipType');
    expect(buildModuleImportTemplateCsv('benefits')).toContain('benefitsProgramCode,planCode,enrollmentWindowCode,coverageTier,dependentCount,lifeEventCode');
    expect(buildModuleImportTemplateCsv('headcount-org')).toContain('positionCode,title,departmentCode,legalEntityCode,jobFamily,jobLevel');
    expect(buildModuleImportTemplateCsv('compliance')).toContain('policyCode,documentType,version,effectiveFrom,acknowledgementDueDate');
    expect(buildModuleImportTemplateCsv('services')).toContain('serviceCode,serviceName,serviceType,category,slaHours');
  });

  it('renders a migration manifest that points admins to each module template', () => {
    const csv = buildModuleMigrationManifestCsv('https://hcm.example/api/v1');

    expect(csv).toContain('module,title,templateUrl,exportUrl,owner,notes');
    expect(csv).toContain('employees,Employee master data,https://hcm.example/api/v1/reporting/module-import-template.csv?module=employees');
    expect(csv).toContain('attendance,Attendance ledger,https://hcm.example/api/v1/reporting/module-import-template.csv?module=attendance');
    expect(csv).toContain('benefits,Benefits enrollments,https://hcm.example/api/v1/reporting/module-import-template.csv?module=benefits');
    expect(csv).toContain('headcount-org,Headcount and organization,https://hcm.example/api/v1/reporting/module-import-template.csv?module=headcount-org');
    expect(csv).toContain('compliance,Compliance evidence,https://hcm.example/api/v1/reporting/module-import-template.csv?module=compliance');
    expect(csv).toContain('services,HR services,https://hcm.example/api/v1/reporting/module-import-template.csv?module=services');
  });
});
