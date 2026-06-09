import type { HrReportDashboard } from './service-usage-reporting.service.js';

export interface EmployeeImportTemplateOptions {
  legalEntityCode?: string;
  departmentCode?: string;
  locationCode?: string;
}

const EMPLOYEE_IMPORT_TEMPLATE_HEADERS = [
  'employeeNumber',
  'firstName',
  'lastName',
  'workEmail',
  'employmentType',
  'hireDate',
  'legalEntityCode',
  'departmentCode',
  'positionCode',
  'managerEmployeeNumber',
  'locationCode',
  'workerStatus',
  'attendancePolicyCode',
  'leavePlanCode',
  'performanceCycleCode',
  'benefitsGroupCode',
  'serviceDeliveryGroup',
  'notes',
];

export function buildEmployeeImportTemplateCsv(options: EmployeeImportTemplateOptions = {}): string {
  return toCsv([
    {
      employeeNumber: 'EMP-1001',
      firstName: 'Amina',
      lastName: 'Hassan',
      workEmail: 'amina.hassan@example.com',
      employmentType: 'FULL_TIME',
      hireDate: '2026-07-01',
      legalEntityCode: options.legalEntityCode ?? 'EG-LEGAL-01',
      departmentCode: options.departmentCode ?? 'HR',
      positionCode: 'HRBP-01',
      managerEmployeeNumber: 'EMP-0001',
      locationCode: options.locationCode ?? 'CAIRO-HQ',
      workerStatus: 'ACTIVE',
      attendancePolicyCode: 'STANDARD-40H',
      leavePlanCode: 'EG-ANNUAL',
      performanceCycleCode: 'FY2026',
      benefitsGroupCode: 'EG-CORE',
      serviceDeliveryGroup: 'EMPLOYEE-SERVICES',
      notes: 'Replace this sample row before import',
    },
  ], EMPLOYEE_IMPORT_TEMPLATE_HEADERS);
}

export function buildHrDashboardExportCsv(dashboard: HrReportDashboard): string {
  return toCsv(
    dashboard.reports.map((report) => ({
      code: report.code,
      title: report.title,
      category: report.category,
      services: report.services.join('|'),
      readiness: report.readiness,
      activity: report.activity,
      commands: report.commands,
      events: report.events,
      notifications: report.notifications,
      workflowTransitions: report.workflowTransitions,
      queueBacklog: report.queueBacklog,
      issues: report.issues,
      lastActivityAt: report.lastActivityAt ?? '',
    })),
    [
      'code',
      'title',
      'category',
      'services',
      'readiness',
      'activity',
      'commands',
      'events',
      'notifications',
      'workflowTransitions',
      'queueBacklog',
      'issues',
      'lastActivityAt',
    ],
  );
}

function toCsv(rows: Array<Record<string, unknown>>, headers: string[]): string {
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ];
  return `${lines.join('\n')}\n`;
}

function csvCell(value: unknown): string {
  if (value === undefined || value === null) return '';
  const raw = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const text = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
