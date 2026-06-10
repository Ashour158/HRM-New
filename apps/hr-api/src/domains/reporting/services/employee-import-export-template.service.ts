import type { HrReportDashboard } from './service-usage-reporting.service.js';

export interface EmployeeImportTemplateOptions {
  legalEntityCode?: string;
  departmentCode?: string;
  locationCode?: string;
}

export const migrationTemplateModules = [
  'employees',
  'attendance',
  'leave',
  'payroll',
  'performance',
  'benefits',
  'headcount-org',
  'compliance',
  'services',
] as const;
export type MigrationTemplateModule = typeof migrationTemplateModules[number];

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

type TemplateDefinition = {
  title: string;
  owner: string;
  notes: string;
  headers: string[];
  sample: Record<string, unknown>;
};

const TEMPLATE_DEFINITIONS: Record<MigrationTemplateModule, TemplateDefinition> = {
  employees: {
    title: 'Employee master data',
    owner: 'People Operations',
    notes: 'Creates or updates worker identity, hierarchy, policy assignment, and service grouping.',
    headers: EMPLOYEE_IMPORT_TEMPLATE_HEADERS,
    sample: {
      employeeNumber: 'EMP-1001',
      firstName: 'Amina',
      lastName: 'Hassan',
      workEmail: 'amina.hassan@example.com',
      employmentType: 'FULL_TIME',
      hireDate: '2026-07-01',
      legalEntityCode: 'EG-LEGAL-01',
      departmentCode: 'HR',
      positionCode: 'HRBP-01',
      managerEmployeeNumber: 'EMP-0001',
      locationCode: 'CAIRO-HQ',
      workerStatus: 'ACTIVE',
      attendancePolicyCode: 'STANDARD-40H',
      leavePlanCode: 'EG-ANNUAL',
      performanceCycleCode: 'FY2026',
      benefitsGroupCode: 'EG-CORE',
      serviceDeliveryGroup: 'EMPLOYEE-SERVICES',
      notes: 'Replace this sample row before import',
    },
  },
  attendance: {
    title: 'Attendance ledger',
    owner: 'Workforce Operations',
    notes: 'Imports approved attendance facts for check-in/out, manual punch review, and payroll ledger refresh.',
    headers: ['externalReference', 'employeeNumber', 'attendanceDate', 'checkInAt', 'checkOutAt', 'workLocationCode', 'geofenceEvidence', 'deviceTrustLevel', 'exceptionCode', 'approvalRouteCode', 'policyCode', 'notes'],
    sample: {
      externalReference: 'attendance-import-001',
      employeeNumber: 'EMP-1001',
      attendanceDate: '2026-07-01',
      checkInAt: '2026-07-01T09:00:00+03:00',
      checkOutAt: '2026-07-01T17:00:00+03:00',
      workLocationCode: 'CAIRO-HQ',
      geofenceEvidence: 'GPS:30.0444,31.2357',
      deviceTrustLevel: 'TRUSTED',
      exceptionCode: '',
      approvalRouteCode: 'MANAGER',
      policyCode: 'STANDARD-40H',
      notes: 'Approved attendance import row',
    },
  },
  leave: {
    title: 'Leave requests and balances',
    owner: 'Absence Administration',
    notes: 'Imports leave requests, balances, approval routes, and payroll-impacting absence codes.',
    headers: ['externalReference', 'employeeNumber', 'leaveTypeCode', 'startDate', 'endDate', 'amount', 'unit', 'approvalRouteCode', 'documentReference', 'payrollAbsenceCode', 'policyCode', 'notes'],
    sample: {
      externalReference: 'leave-import-001',
      employeeNumber: 'EMP-1001',
      leaveTypeCode: 'ANNUAL',
      startDate: '2026-07-10',
      endDate: '2026-07-12',
      amount: 3,
      unit: 'DAYS',
      approvalRouteCode: 'MANAGER',
      documentReference: '',
      payrollAbsenceCode: 'PAID_LEAVE',
      policyCode: 'EG-ANNUAL',
      notes: 'Approved leave import row',
    },
  },
  payroll: {
    title: 'Payroll inputs and salary components',
    owner: 'Payroll Administration',
    notes: 'Imports salary composition, recurring earning/deduction items, tax treatment, and insurance treatment.',
    headers: ['externalReference', 'employeeNumber', 'effectiveFrom', 'salaryComponentCode', 'componentType', 'amount', 'currency', 'taxTreatment', 'insuranceTreatment', 'glAccount', 'payFrequency', 'policyCode', 'notes'],
    sample: {
      externalReference: 'payroll-import-001',
      employeeNumber: 'EMP-1001',
      effectiveFrom: '2026-07-01',
      salaryComponentCode: 'BASE_SALARY',
      componentType: 'EARNING',
      amount: 25000,
      currency: 'EGP',
      taxTreatment: 'TAXABLE',
      insuranceTreatment: 'INSURABLE',
      glAccount: '6000-BASE',
      payFrequency: 'MONTHLY',
      policyCode: 'EG-PAYROLL-CORE',
      notes: 'Salary composition import row',
    },
  },
  performance: {
    title: 'Performance and 360 feedback',
    owner: 'Talent Management',
    notes: 'Imports review participants, 360 relationships, objectives, ratings, and profile impact evidence.',
    headers: ['externalReference', 'cycleCode', 'revieweeEmployeeNumber', 'reviewerEmployeeNumber', 'relationshipType', 'objectiveCode', 'competencyCode', 'rating', 'comment', 'visibility', 'policyCode', 'notes'],
    sample: {
      externalReference: 'performance-import-001',
      cycleCode: 'FY2026',
      revieweeEmployeeNumber: 'EMP-1001',
      reviewerEmployeeNumber: 'EMP-1002',
      relationshipType: 'PEER',
      objectiveCode: 'OBJ-CUSTOMER',
      competencyCode: 'COLLABORATION',
      rating: 4,
      comment: 'Strong cross-team delivery',
      visibility: 'PROFILE_SUMMARY',
      policyCode: 'FY2026-360',
      notes: '360 feedback import row',
    },
  },
  benefits: {
    title: 'Benefits enrollments',
    owner: 'Reward Operations',
    notes: 'Imports eligibility, enrollment windows, life events, dependent counts, carrier and payroll bridge data.',
    headers: ['externalReference', 'employeeNumber', 'benefitsProgramCode', 'planCode', 'enrollmentWindowCode', 'coverageTier', 'dependentCount', 'lifeEventCode', 'effectiveFrom', 'employeeContribution', 'employerContribution', 'carrierReference', 'payrollDeductionCode', 'policyCode', 'notes'],
    sample: {
      externalReference: 'benefits-import-001',
      employeeNumber: 'EMP-1001',
      benefitsProgramCode: 'EG-CORE',
      planCode: 'MEDICAL-GOLD',
      enrollmentWindowCode: 'OPEN-2026',
      coverageTier: 'EMPLOYEE_FAMILY',
      dependentCount: 2,
      lifeEventCode: '',
      effectiveFrom: '2026-07-01',
      employeeContribution: 500,
      employerContribution: 1500,
      carrierReference: 'CAR-001',
      payrollDeductionCode: 'BEN-MEDICAL',
      policyCode: 'EG-BENEFITS',
      notes: 'Benefits enrollment import row',
    },
  },
  'headcount-org': {
    title: 'Headcount and organization',
    owner: 'People Operations',
    notes: 'Imports position catalog, headcount planning requests, legal-entity links, and organization coverage evidence.',
    headers: ['externalReference', 'positionCode', 'title', 'departmentCode', 'legalEntityCode', 'jobFamily', 'jobLevel', 'employmentType', 'status', 'filledByEmployeeNumber', 'headcountRequestNumber', 'positionsRequested', 'positionsApproved', 'policyCode', 'notes'],
    sample: {
      externalReference: 'headcount-org-import-001',
      positionCode: 'FIN-MGR-01',
      title: 'Finance Manager',
      departmentCode: 'FINANCE',
      legalEntityCode: 'EG-LEGAL-01',
      jobFamily: 'Finance',
      jobLevel: 'M3',
      employmentType: 'FULL_TIME',
      status: 'OPEN',
      filledByEmployeeNumber: '',
      headcountRequestNumber: 'HC-2026-001',
      positionsRequested: 1,
      positionsApproved: 1,
      policyCode: 'POSITION-CONTROL',
      notes: 'Position and headcount import row',
    },
  },
  compliance: {
    title: 'Compliance evidence',
    owner: 'Compliance Operations',
    notes: 'Imports policy documents, acknowledgement due dates, statutory report metadata, and legal hold references.',
    headers: ['externalReference', 'policyCode', 'documentType', 'version', 'effectiveFrom', 'acknowledgementDueDate', 'effectiveUntil', 'employeeNumber', 'acknowledgedAt', 'statutoryReportType', 'countryCode', 'legalEntityCode', 'status', 'notes'],
    sample: {
      externalReference: 'compliance-import-001',
      policyCode: 'CODE-OF-CONDUCT',
      documentType: 'POLICY',
      version: '2026.1',
      effectiveFrom: '2026-07-01',
      effectiveUntil: '',
      employeeNumber: 'EMP-1001',
      acknowledgementDueDate: '2026-07-15',
      acknowledgedAt: '',
      statutoryReportType: '',
      countryCode: 'EG',
      legalEntityCode: 'EG-LEGAL-01',
      status: 'PENDING',
      notes: 'Compliance evidence import row',
    },
  },
  services: {
    title: 'HR services',
    owner: 'HR Service Delivery',
    notes: 'Imports service catalog items, case routing metadata, SLA targets, and fulfillment ownership.',
    headers: ['externalReference', 'serviceCode', 'serviceName', 'serviceType', 'category', 'slaHours', 'fulfillmentProcess', 'caseType', 'priority', 'ownerRole', 'status', 'notes'],
    sample: {
      externalReference: 'services-import-001',
      serviceCode: 'HR_LETTER',
      serviceName: 'Employment letter request',
      serviceType: 'DOCUMENT',
      category: 'Documents',
      slaHours: 24,
      fulfillmentProcess: 'HR verifies worker data, prepares letter, and publishes the signed document.',
      caseType: 'HR_LETTER',
      priority: 'MEDIUM',
      ownerRole: 'HR_OPERATIONS',
      status: 'ACTIVE',
      notes: 'HR service catalog import row',
    },
  },
};

export function buildEmployeeImportTemplateCsv(options: EmployeeImportTemplateOptions = {}): string {
  return toCsv([{
    ...TEMPLATE_DEFINITIONS.employees.sample,
    legalEntityCode: options.legalEntityCode ?? TEMPLATE_DEFINITIONS.employees.sample.legalEntityCode,
    departmentCode: options.departmentCode ?? TEMPLATE_DEFINITIONS.employees.sample.departmentCode,
    locationCode: options.locationCode ?? TEMPLATE_DEFINITIONS.employees.sample.locationCode,
  }], EMPLOYEE_IMPORT_TEMPLATE_HEADERS);
}

export function isMigrationTemplateModule(value: string): value is MigrationTemplateModule {
  return (migrationTemplateModules as readonly string[]).includes(value);
}

export function buildModuleImportTemplateCsv(module: MigrationTemplateModule): string {
  const definition = TEMPLATE_DEFINITIONS[module];
  const headers = module === 'employees' ? ['externalReference', ...definition.headers] : definition.headers;
  return toCsv([{ module, externalReference: `${module}-import-001`, ...definition.sample }], ['module', ...headers]);
}

export function buildModuleMigrationManifestCsv(apiBaseUrl = ''): string {
  const base = apiBaseUrl.replace(/\/$/, '');
  return toCsv(
    migrationTemplateModules.map((module) => {
      const definition = TEMPLATE_DEFINITIONS[module];
      return {
        module,
        title: definition.title,
        templateUrl: `${base}/reporting/module-import-template.csv?module=${module}`,
        exportUrl: module === 'employees'
          ? `${base}/hr/core/workers/export.csv`
          : `${base}/reporting/hr-dashboard/export.csv?module=${module}`,
        owner: definition.owner,
        notes: definition.notes,
      };
    }),
    ['module', 'title', 'templateUrl', 'exportUrl', 'owner', 'notes'],
  );
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
