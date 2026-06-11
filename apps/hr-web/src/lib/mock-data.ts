import type { User, Worker, EmployeeProfileData } from '@/types';
import { DEFAULT_HCM_SETUP } from './hcm-setup-defaults';

export const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
export const DEMO_PASSWORD = 'Password123!';

export function makeDemoToken(email: string): string {
  return `demo:${email}`;
}

export function emailFromDemoToken(token: string): string | null {
  if (token.startsWith('demo:')) return token.slice(5);
  return null;
}

const ALL_PERMISSIONS = [{ id: 'p1', resource: '*', action: '*' }];

export const DEMO_USERS: Record<string, User> = {
  'hr.admin@example.com': {
    id: 'usr-admin-001',
    email: 'hr.admin@example.com',
    firstName: 'Sarah',
    lastName: 'Mitchell',
    tenantId: DEMO_TENANT_ID,
    roles: [
      { id: 'r1', name: 'HR_ADMIN', description: 'HR Administrator' },
      { id: 'r2', name: 'APP_ADMIN', description: 'Application Admin' },
      { id: 'r3', name: 'MANAGER', description: 'People Manager' },
    ],
    permissions: ALL_PERMISSIONS,
  },
  'manager@example.com': {
    id: 'usr-mgr-001',
    email: 'manager@example.com',
    firstName: 'James',
    lastName: 'Harrington',
    tenantId: DEMO_TENANT_ID,
    roles: [{ id: 'r3', name: 'MANAGER', description: 'People Manager' }],
    permissions: ALL_PERMISSIONS,
  },
  'employee@example.com': {
    id: 'usr-emp-001',
    email: 'employee@example.com',
    firstName: 'Emily',
    lastName: 'Chen',
    tenantId: DEMO_TENANT_ID,
    roles: [{ id: 'r4', name: 'EMPLOYEE', description: 'Employee' }],
    permissions: ALL_PERMISSIONS,
  },
};

const DEMO_WORKER_ME: Worker = {
  id: 'wkr-001',
  employeeId: 'EMP-0042',
  firstName: 'Emily',
  lastName: 'Chen',
  email: 'employee@example.com',
  phone: '+1 555-0142',
  hireDate: '2021-03-15',
  status: 'ACTIVE',
  departmentId: 'dept-eng',
  departmentName: 'Engineering',
  jobTitle: 'Senior Software Engineer',
  managerId: 'wkr-mgr-001',
  managerName: 'James Harrington',
  legalEntityId: 'le-001',
  legalEntityName: 'Acme Corp USA',
};

const DEMO_PROFILE_DATA: EmployeeProfileData = {
  worker: DEMO_WORKER_ME,
  basic: {
    dateOfBirth: '1992-08-14',
    gender: 'FEMALE',
    personalEmail: 'emily.chen.personal@gmail.com',
    workEmail: 'employee@example.com',
    phoneNumber: '+1 555-0142',
  },
  contact: {
    address: { street: '123 Main St', city: 'San Francisco', state: 'CA', zip: '94105', country: 'US' },
    workLocation: { code: 'SF-HQ', name: 'San Francisco HQ' },
    departmentName: 'Engineering',
  },
  emergencyContact: {
    emergencyContact: { name: 'David Chen', relationship: 'Spouse', phone: '+1 555-0199' },
  },
  background: {
    education: [{ institution: 'MIT', degree: 'B.S. Computer Science', graduationYear: '2014' }],
    experience: [
      { company: 'Acme Corp', title: 'Senior Software Engineer', startYear: '2021', current: 'true' },
      { company: 'TechStart Inc', title: 'Software Engineer', startYear: '2018', endYear: '2021', current: 'false' },
    ],
    certifications: [],
  },
  compensation: {
    salaryAmount: 8500,
    grossSalaryAmount: 8500,
    taxAmount: 1530,
    netSalaryAmount: 6120,
    salaryCurrency: 'USD',
    salaryBasis: 'MONTHLY',
    payFrequency: 'MONTHLY',
  },
  documents: { documents: [], employmentContract: { status: 'ACTIVE' } },
  governance: {
    dataClassification: 'CONFIDENTIAL',
    personalDataRecords: [],
  },
};

const makeWorkers = (): Worker[] => [
  DEMO_WORKER_ME,
  {
    id: 'wkr-admin-001',
    employeeId: 'EMP-0001',
    firstName: 'Sarah',
    lastName: 'Mitchell',
    email: 'hr.admin@example.com',
    phone: '+1 555-0100',
    hireDate: '2018-01-10',
    status: 'ACTIVE',
    departmentId: 'dept-hr',
    departmentName: 'Human Resources',
    jobTitle: 'HR Director',
    legalEntityId: 'le-001',
    legalEntityName: 'Acme Corp USA',
  },
  {
    id: 'wkr-mgr-001',
    employeeId: 'EMP-0010',
    firstName: 'James',
    lastName: 'Harrington',
    email: 'manager@example.com',
    hireDate: '2019-06-01',
    status: 'ACTIVE',
    departmentId: 'dept-eng',
    departmentName: 'Engineering',
    jobTitle: 'Engineering Manager',
    legalEntityId: 'le-001',
    legalEntityName: 'Acme Corp USA',
  },
  {
    id: 'wkr-004',
    employeeId: 'EMP-0055',
    firstName: 'Marcus',
    lastName: 'Johnson',
    email: 'marcus.johnson@example.com',
    hireDate: '2022-07-11',
    status: 'ACTIVE',
    departmentId: 'dept-eng',
    departmentName: 'Engineering',
    jobTitle: 'Software Engineer',
    managerId: 'wkr-mgr-001',
    managerName: 'James Harrington',
    legalEntityId: 'le-001',
    legalEntityName: 'Acme Corp USA',
  },
  {
    id: 'wkr-005',
    employeeId: 'EMP-0061',
    firstName: 'Priya',
    lastName: 'Sharma',
    email: 'priya.sharma@example.com',
    hireDate: '2020-11-03',
    status: 'ACTIVE',
    departmentId: 'dept-product',
    departmentName: 'Product',
    jobTitle: 'Product Manager',
    legalEntityId: 'le-001',
    legalEntityName: 'Acme Corp USA',
  },
  {
    id: 'wkr-006',
    employeeId: 'EMP-0072',
    firstName: 'Alex',
    lastName: 'Rivera',
    email: 'alex.rivera@example.com',
    hireDate: '2023-02-20',
    status: 'ACTIVE',
    departmentId: 'dept-design',
    departmentName: 'Design',
    jobTitle: 'UX Designer',
    legalEntityId: 'le-001',
    legalEntityName: 'Acme Corp USA',
  },
  {
    id: 'wkr-007',
    employeeId: 'EMP-0088',
    firstName: 'Olivia',
    lastName: 'Thompson',
    email: 'olivia.thompson@example.com',
    hireDate: '2021-09-14',
    status: 'ACTIVE',
    departmentId: 'dept-finance',
    departmentName: 'Finance',
    jobTitle: 'Financial Analyst',
    legalEntityId: 'le-001',
    legalEntityName: 'Acme Corp USA',
  },
  {
    id: 'wkr-008',
    employeeId: 'EMP-0093',
    firstName: 'David',
    lastName: 'Park',
    email: 'david.park@example.com',
    hireDate: '2022-04-01',
    status: 'INACTIVE',
    departmentId: 'dept-sales',
    departmentName: 'Sales',
    jobTitle: 'Account Executive',
    legalEntityId: 'le-001',
    legalEntityName: 'Acme Corp USA',
  },
];

const WORKERS = makeWorkers();

const ok = <T>(data: T) => ({ success: true, correlationId: 'demo', data });

function mockAttendanceToday() {
  const now = new Date();
  return {
    workerId: DEMO_WORKER_ME.id,
    workDate: now.toISOString().slice(0, 10),
    status: 'YET_TO_CHECK_IN',
    canCheckIn: true,
    canCheckOut: false,
    elapsedMinutes: 0,
    totalWorkedMinutes: 0,
    locationStatus: 'NO_GEOLOCATION',
    events: [],
  };
}

function mockAttendancePeriodView() {
  const today = new Date();
  const iso = (daysAgo: number) => {
    const date = new Date(today);
    date.setDate(today.getDate() - daysAgo);
    return date.toISOString().slice(0, 10);
  };
  const series = [
    { workDate: iso(6), employeeDays: 1, present: 1, absent: 0, onLeave: 0, exceptions: 0, payableHours: 8, deductionHours: 0, overtimeHours: 0, geofenceViolations: 0, lateMinutes: 0, missingCheckout: 0, payrollReady: 1, undertimeMinutes: 0 },
    { workDate: iso(5), employeeDays: 1, present: 1, absent: 0, onLeave: 0, exceptions: 0, payableHours: 8.5, deductionHours: 0, overtimeHours: 0.5, geofenceViolations: 0, lateMinutes: 0, missingCheckout: 0, payrollReady: 1, undertimeMinutes: 0 },
    { workDate: iso(4), employeeDays: 1, present: 0, absent: 0, onLeave: 1, exceptions: 0, payableHours: 0, deductionHours: 0, overtimeHours: 0, geofenceViolations: 0, lateMinutes: 0, missingCheckout: 0, payrollReady: 1, undertimeMinutes: 0 },
    { workDate: iso(3), employeeDays: 1, present: 1, absent: 0, onLeave: 0, exceptions: 1, payableHours: 7.75, deductionHours: 0.25, overtimeHours: 0, geofenceViolations: 0, lateMinutes: 15, missingCheckout: 0, payrollReady: 0, undertimeMinutes: 15 },
    { workDate: iso(2), employeeDays: 1, present: 1, absent: 0, onLeave: 0, exceptions: 0, payableHours: 8, deductionHours: 0, overtimeHours: 0, geofenceViolations: 0, lateMinutes: 0, missingCheckout: 0, payrollReady: 1, undertimeMinutes: 0 },
    { workDate: iso(1), employeeDays: 1, present: 1, absent: 0, onLeave: 0, exceptions: 0, payableHours: 8.25, deductionHours: 0, overtimeHours: 0.25, geofenceViolations: 0, lateMinutes: 0, missingCheckout: 0, payrollReady: 1, undertimeMinutes: 0 },
    { workDate: iso(0), employeeDays: 1, present: 0, absent: 0, onLeave: 0, exceptions: 0, payableHours: 0, deductionHours: 0, overtimeHours: 0, geofenceViolations: 0, lateMinutes: 0, missingCheckout: 0, payrollReady: 0, undertimeMinutes: 0 },
  ];
  const totals = series.reduce((acc, day) => ({
    employeeDays: acc.employeeDays + day.employeeDays,
    present: acc.present + day.present,
    absent: acc.absent + day.absent,
    onLeave: acc.onLeave + day.onLeave,
    exceptions: acc.exceptions + day.exceptions,
    payableHours: acc.payableHours + day.payableHours,
    deductionHours: acc.deductionHours + day.deductionHours,
    overtimeHours: acc.overtimeHours + day.overtimeHours,
    geofenceViolations: acc.geofenceViolations + day.geofenceViolations,
    lateMinutes: acc.lateMinutes + day.lateMinutes,
    missingCheckout: acc.missingCheckout + day.missingCheckout,
    payrollReady: acc.payrollReady + day.payrollReady,
    undertimeMinutes: acc.undertimeMinutes + day.undertimeMinutes,
  }), {
    employeeDays: 0,
    present: 0,
    absent: 0,
    onLeave: 0,
    exceptions: 0,
    payableHours: 0,
    deductionHours: 0,
    overtimeHours: 0,
    geofenceViolations: 0,
    lateMinutes: 0,
    missingCheckout: 0,
    payrollReady: 0,
    undertimeMinutes: 0,
  });

  return {
    periodStart: iso(6),
    periodEnd: iso(0),
    range: 'WEEKLY',
    scope: 'SELF',
    totals,
    series,
    workers: [{
      workerId: DEMO_WORKER_ME.id,
      employeeId: DEMO_WORKER_ME.employeeId,
      name: `${DEMO_WORKER_ME.firstName} ${DEMO_WORKER_ME.lastName}`,
      departmentName: DEMO_WORKER_ME.departmentName,
      managerId: DEMO_WORKER_ME.managerId,
      ...totals,
    }],
    policyEvidence: {
      flexibleRuleCodes: ['FLEX-CORE-09-15'],
      leavePolicyTypes: ['ANNUAL'],
      scheduleSources: ['ROTATING_SHIFT_A'],
    },
  };
}

const PLANNING_GROUPS_BY_DEPT = [
  { id: 'dept-eng', name: 'Engineering', headcount: 65, positionCount: 72, vacancies: 7, annualCost: 11200000, employees: [
    { id: 'wkr-mgr-001', name: 'James Harrington', jobTitle: 'Engineering Manager', status: 'ACTIVE' },
    { id: 'wkr-004', name: 'Marcus Johnson', jobTitle: 'Software Engineer', status: 'ACTIVE' },
    { id: 'wkr-001', name: 'Emily Chen', jobTitle: 'Senior Software Engineer', status: 'ACTIVE' },
  ] },
  { id: 'dept-sales', name: 'Sales', headcount: 43, positionCount: 50, vacancies: 7, annualCost: 5160000, employees: [
    { id: 'wkr-008', name: 'David Park', jobTitle: 'Account Executive', status: 'INACTIVE' },
  ] },
  { id: 'dept-finance', name: 'Finance', headcount: 25, positionCount: 25, vacancies: 0, annualCost: 3000000, employees: [
    { id: 'wkr-007', name: 'Olivia Thompson', jobTitle: 'Financial Analyst', status: 'ACTIVE' },
  ] },
  { id: 'dept-product', name: 'Product', headcount: 20, positionCount: 22, vacancies: 2, annualCost: 2800000, employees: [
    { id: 'wkr-005', name: 'Priya Sharma', jobTitle: 'Product Manager', status: 'ACTIVE' },
  ] },
  { id: 'dept-design', name: 'Design', headcount: 15, positionCount: 16, vacancies: 1, annualCost: 1800000, employees: [
    { id: 'wkr-006', name: 'Alex Rivera', jobTitle: 'UX Designer', status: 'ACTIVE' },
  ] },
  { id: 'dept-hr', name: 'Human Resources', headcount: 12, positionCount: 12, vacancies: 0, annualCost: 1200000, employees: [
    { id: 'wkr-admin-001', name: 'Sarah Mitchell', jobTitle: 'HR Director', status: 'ACTIVE' },
  ] },
];
const PLANNING_GROUPS_BY_ENTITY = [
  { id: 'le-001', name: 'Acme Corp USA', headcount: 180, positionCount: 196, vacancies: 16, annualCost: 27000000, employees: [] },
  { id: 'le-002', name: 'Acme Corp UK', headcount: 42, positionCount: 45, vacancies: 3, annualCost: 6300000, employees: [] },
  { id: 'le-003', name: 'Acme Corp Canada', headcount: 26, positionCount: 27, vacancies: 1, annualCost: 3420000, employees: [] },
];
const PLANNING_GROUPS_BY_MANAGER = [
  { id: 'wkr-mgr-001', name: 'James Harrington', headcount: 3, positionCount: 4, vacancies: 1, annualCost: 720000, employees: [
    { id: 'wkr-004', name: 'Marcus Johnson', jobTitle: 'Software Engineer', status: 'ACTIVE' },
    { id: 'wkr-001', name: 'Emily Chen', jobTitle: 'Senior Software Engineer', status: 'ACTIVE' },
  ] },
];

const REPORTING_PERIOD_OPTIONS = [
  { code: 'CURRENT_MONTH', label: 'Current month' },
  { code: 'LAST_90_DAYS', label: 'Last 90 days' },
  { code: 'CURRENT_QUARTER', label: 'Current quarter' },
  { code: 'YEAR_TO_DATE', label: 'Year to date' },
];

const REPORTING_DEPARTMENT_OPTIONS = [
  { code: 'ENGINEERING', label: 'Engineering' },
  { code: 'SALES', label: 'Sales' },
  { code: 'FINANCE', label: 'Finance' },
  { code: 'HR', label: 'Human Resources' },
];

const REPORTING_STATUS_OPTIONS = [
  { code: 'ACTIVE', label: 'Active' },
  { code: 'PENDING', label: 'Pending' },
  { code: 'APPROVED', label: 'Approved' },
  { code: 'REJECTED', label: 'Rejected' },
];

const REPORT_BUILDER_CATALOG = {
  scopeLevels: [
    { code: 'TENANT', label: 'Whole Company', description: 'All tenant records.' },
    { code: 'LEGAL_ENTITY', label: 'Legal Entity', description: 'One company or legal employer.' },
    { code: 'ORG_UNIT', label: 'Org Unit', description: 'A business or operating unit.' },
    { code: 'DEPARTMENT', label: 'Department', description: 'A department.' },
    { code: 'MANAGER', label: 'Manager Team', description: 'A reporting line.' },
    { code: 'EMPLOYEE', label: 'Employee', description: 'Selected employees.' },
    { code: 'GROUP', label: 'Custom Group', description: 'A saved workforce group.' },
  ],
  populationOptions: [
    { scopeLevel: 'TENANT', label: 'Whole company', values: [{ code: 'ALL', label: 'All workers', description: 'All records available to this reporting user.' }] },
    { scopeLevel: 'LEGAL_ENTITY', label: 'Legal entity', values: [{ code: 'ACME_US', label: 'Acme Corp USA' }, { code: 'ACME_EG', label: 'Acme Egypt' }, { code: 'ACME_UK', label: 'Acme Corp UK' }] },
    { scopeLevel: 'ORG_UNIT', label: 'Org unit', values: [{ code: 'TECHNOLOGY', label: 'Technology' }, { code: 'COMMERCIAL', label: 'Commercial' }, { code: 'CORPORATE', label: 'Corporate Services' }] },
    { scopeLevel: 'DEPARTMENT', label: 'Department', values: REPORTING_DEPARTMENT_OPTIONS.map((option) => ({ ...option, description: 'Records assigned to this department.' })) },
    { scopeLevel: 'MANAGER', label: 'Manager team', values: [{ code: 'MGR_JAMES_HARRINGTON', label: 'James Harrington Team' }, { code: 'MGR_SARAH_MITCHELL', label: 'Sarah Mitchell Team' }, { code: 'MGR_DAVID_CHEN', label: 'David Chen Team' }] },
    { scopeLevel: 'EMPLOYEE', label: 'Employee', values: [{ code: 'EMP_0042', label: 'Emily Chen' }, { code: 'EMP_0044', label: 'Marcus Johnson' }, { code: 'EMP_0047', label: 'Olivia Thompson' }] },
    { scopeLevel: 'GROUP', label: 'Saved workforce group', values: [{ code: 'CRITICAL_ROLES', label: 'Critical roles' }, { code: 'REMOTE_WORKERS', label: 'Remote workers' }, { code: 'NEW_JOINERS_90', label: 'New joiners - 90 days' }] },
  ],
  visualizationTypes: [
    { code: 'table', label: 'Table' },
    { code: 'bar', label: 'Bar chart' },
    { code: 'line', label: 'Trend line' },
    { code: 'pie', label: 'Breakdown' },
    { code: 'kpi', label: 'KPI cards' },
    { code: 'matrix', label: 'Matrix' },
    { code: 'comparison', label: 'Comparison' },
  ],
  dataSources: [
    {
      code: 'HEADCOUNT',
      title: 'Employee Headcount',
      category: 'People & Organization',
      scopeLevels: ['TENANT', 'LEGAL_ENTITY', 'ORG_UNIT', 'DEPARTMENT', 'MANAGER', 'EMPLOYEE', 'GROUP'],
      defaultVisualization: 'bar',
      fields: [
        { code: 'employeeNumber', label: 'Employee number', type: 'text', defaultSelected: true },
        { code: 'employeeName', label: 'Employee name', type: 'text', defaultSelected: true },
        { code: 'legalEntity', label: 'Legal entity', type: 'text', defaultSelected: true },
        { code: 'department', label: 'Department', type: 'text', defaultSelected: true },
        { code: 'employmentStatus', label: 'Employment status', type: 'status', defaultSelected: true },
      ],
      metrics: [
        { code: 'headcount', label: 'Headcount', type: 'number' },
        { code: 'activeWorkers', label: 'Active workers', type: 'number' },
        { code: 'turnoverRate', label: 'Turnover rate', type: 'percentage' },
      ],
      groupBy: [
        { code: 'legalEntity', label: 'Legal entity', type: 'text' },
        { code: 'department', label: 'Department', type: 'text' },
        { code: 'employmentStatus', label: 'Employment status', type: 'status' },
      ],
      filters: [
        { code: 'period', label: 'Period', type: 'status', options: REPORTING_PERIOD_OPTIONS },
        { code: 'department', label: 'Department', type: 'status', options: REPORTING_DEPARTMENT_OPTIONS },
        { code: 'employmentStatus', label: 'Employment status', type: 'status', options: REPORTING_STATUS_OPTIONS },
      ],
    },
    {
      code: 'ATTENDANCE',
      title: 'Attendance & Time Ledger',
      category: 'Workforce',
      scopeLevels: ['TENANT', 'LEGAL_ENTITY', 'ORG_UNIT', 'DEPARTMENT', 'MANAGER', 'EMPLOYEE', 'GROUP'],
      defaultVisualization: 'bar',
      fields: [
        { code: 'employeeNumber', label: 'Employee number', type: 'text', defaultSelected: true },
        { code: 'employeeName', label: 'Employee name', type: 'text', defaultSelected: true },
        { code: 'workDate', label: 'Work date', type: 'date', defaultSelected: true },
        { code: 'department', label: 'Department', type: 'text', defaultSelected: true },
        { code: 'attendanceStatus', label: 'Attendance status', type: 'status', defaultSelected: true },
      ],
      metrics: [
        { code: 'employeeDays', label: 'Employee days', type: 'number' },
        { code: 'lateMinutes', label: 'Late minutes', type: 'number' },
        { code: 'overtimeHours', label: 'Overtime hours', type: 'number' },
        { code: 'exceptions', label: 'Exceptions', type: 'number' },
      ],
      groupBy: [
        { code: 'department', label: 'Department', type: 'text' },
        { code: 'attendanceStatus', label: 'Attendance status', type: 'status' },
        { code: 'workDate', label: 'Work date', type: 'date' },
      ],
      filters: [
        { code: 'period', label: 'Period', type: 'status', options: REPORTING_PERIOD_OPTIONS },
        { code: 'department', label: 'Department', type: 'status', options: REPORTING_DEPARTMENT_OPTIONS },
        { code: 'attendanceStatus', label: 'Attendance status', type: 'status', options: [
          { code: 'PRESENT', label: 'Present' },
          { code: 'LATE', label: 'Late' },
          { code: 'ABSENT', label: 'Absent' },
          { code: 'EXCEPTION', label: 'Exception' },
        ] },
      ],
    },
    {
      code: 'LEAVE',
      title: 'Leave Management',
      category: 'Workforce',
      scopeLevels: ['TENANT', 'LEGAL_ENTITY', 'ORG_UNIT', 'DEPARTMENT', 'MANAGER', 'EMPLOYEE', 'GROUP'],
      defaultVisualization: 'bar',
      fields: [
        { code: 'employeeNumber', label: 'Employee number', type: 'text', defaultSelected: true },
        { code: 'employeeName', label: 'Employee name', type: 'text', defaultSelected: true },
        { code: 'leaveType', label: 'Leave type', type: 'text', defaultSelected: true },
        { code: 'requestStatus', label: 'Request status', type: 'status', defaultSelected: true },
      ],
      metrics: [
        { code: 'requestCount', label: 'Requests', type: 'number' },
        { code: 'requestedDays', label: 'Requested days', type: 'number' },
        { code: 'balanceRemaining', label: 'Balance remaining', type: 'number' },
      ],
      groupBy: [
        { code: 'department', label: 'Department', type: 'text' },
        { code: 'leaveType', label: 'Leave type', type: 'text' },
        { code: 'requestStatus', label: 'Request status', type: 'status' },
      ],
      filters: [
        { code: 'period', label: 'Period', type: 'status', options: REPORTING_PERIOD_OPTIONS },
        { code: 'department', label: 'Department', type: 'status', options: REPORTING_DEPARTMENT_OPTIONS },
        { code: 'leaveType', label: 'Leave type', type: 'status', options: [
          { code: 'ANNUAL', label: 'Annual leave' },
          { code: 'SICK', label: 'Sick leave' },
          { code: 'PERSONAL', label: 'Personal leave' },
          { code: 'PERMISSION', label: 'Permission' },
        ] },
        { code: 'requestStatus', label: 'Request status', type: 'status', options: REPORTING_STATUS_OPTIONS },
      ],
    },
    {
      code: 'PAYROLL',
      title: 'Payroll & Payslips',
      category: 'Reward',
      scopeLevels: ['TENANT', 'LEGAL_ENTITY', 'ORG_UNIT', 'DEPARTMENT', 'MANAGER', 'EMPLOYEE', 'GROUP'],
      defaultVisualization: 'kpi',
      fields: [
        { code: 'employeeNumber', label: 'Employee number', type: 'text', defaultSelected: true },
        { code: 'employeeName', label: 'Employee name', type: 'text', defaultSelected: true },
        { code: 'payPeriod', label: 'Pay period', type: 'text', defaultSelected: true },
        { code: 'payrollStatus', label: 'Payroll status', type: 'status', defaultSelected: true },
      ],
      metrics: [
        { code: 'grossPay', label: 'Gross pay', type: 'currency' },
        { code: 'taxAmount', label: 'Tax', type: 'currency' },
        { code: 'insuranceAmount', label: 'Insurance', type: 'currency' },
        { code: 'netPay', label: 'Net pay', type: 'currency' },
      ],
      groupBy: [
        { code: 'legalEntity', label: 'Legal entity', type: 'text' },
        { code: 'department', label: 'Department', type: 'text' },
        { code: 'payPeriod', label: 'Pay period', type: 'text' },
      ],
      filters: [
        { code: 'period', label: 'Period', type: 'status', options: REPORTING_PERIOD_OPTIONS },
        { code: 'department', label: 'Department', type: 'status', options: REPORTING_DEPARTMENT_OPTIONS },
        { code: 'payrollStatus', label: 'Payroll status', type: 'status', options: [
          { code: 'OPEN', label: 'Open' },
          { code: 'READY', label: 'Ready' },
          { code: 'BLOCKED', label: 'Blocked' },
          { code: 'CLOSED', label: 'Closed' },
        ] },
      ],
    },
    {
      code: 'PERFORMANCE',
      title: 'Performance & 360',
      category: 'Talent',
      scopeLevels: ['TENANT', 'LEGAL_ENTITY', 'ORG_UNIT', 'DEPARTMENT', 'MANAGER', 'EMPLOYEE', 'GROUP'],
      defaultVisualization: 'bar',
      fields: [
        { code: 'employeeNumber', label: 'Employee number', type: 'text', defaultSelected: true },
        { code: 'employeeName', label: 'Employee name', type: 'text', defaultSelected: true },
        { code: 'cycleName', label: 'Cycle', type: 'text', defaultSelected: true },
        { code: 'reviewStatus', label: 'Review status', type: 'status', defaultSelected: true },
      ],
      metrics: [
        { code: 'reviewCount', label: 'Reviews', type: 'number' },
        { code: 'averageRating', label: 'Average rating', type: 'number' },
        { code: 'feedbackResponses', label: '360 responses', type: 'number' },
      ],
      groupBy: [
        { code: 'department', label: 'Department', type: 'text' },
        { code: 'cycleName', label: 'Cycle', type: 'text' },
        { code: 'reviewStatus', label: 'Review status', type: 'status' },
      ],
      filters: [
        { code: 'period', label: 'Period', type: 'status', options: REPORTING_PERIOD_OPTIONS },
        { code: 'department', label: 'Department', type: 'status', options: REPORTING_DEPARTMENT_OPTIONS },
        { code: 'cycleName', label: 'Cycle', type: 'status', options: [
          { code: 'Q2_2026', label: 'Q2 2026' },
          { code: 'H1_2026', label: 'H1 2026' },
          { code: 'ANNUAL_2026', label: 'Annual 2026' },
        ] },
        { code: 'reviewStatus', label: 'Review status', type: 'status', options: [
          { code: 'NOT_STARTED', label: 'Not started' },
          { code: 'IN_PROGRESS', label: 'In progress' },
          { code: 'COMPLETED', label: 'Completed' },
          { code: 'OVERDUE', label: 'Overdue' },
        ] },
      ],
    },
    {
      code: 'BENEFITS',
      title: 'Benefits & Enrollment',
      category: 'Reward',
      scopeLevels: ['TENANT', 'LEGAL_ENTITY', 'ORG_UNIT', 'DEPARTMENT', 'MANAGER', 'EMPLOYEE', 'GROUP'],
      defaultVisualization: 'pie',
      fields: [
        { code: 'employeeNumber', label: 'Employee number', type: 'text', defaultSelected: true },
        { code: 'employeeName', label: 'Employee name', type: 'text', defaultSelected: true },
        { code: 'programName', label: 'Program', type: 'text', defaultSelected: true },
        { code: 'coverageLevel', label: 'Coverage level', type: 'text', defaultSelected: true },
      ],
      metrics: [
        { code: 'enrollments', label: 'Enrollments', type: 'number' },
        { code: 'dependentsCovered', label: 'Dependents covered', type: 'number' },
        { code: 'employeeContribution', label: 'Employee contribution', type: 'currency' },
      ],
      groupBy: [
        { code: 'programName', label: 'Program', type: 'text' },
        { code: 'coverageLevel', label: 'Coverage level', type: 'text' },
      ],
      filters: [
        { code: 'period', label: 'Period', type: 'status', options: REPORTING_PERIOD_OPTIONS },
        { code: 'programName', label: 'Program', type: 'status', options: [
          { code: 'MEDICAL', label: 'Medical' },
          { code: 'DENTAL', label: 'Dental' },
          { code: 'LIFE', label: 'Life insurance' },
        ] },
        { code: 'enrollmentStatus', label: 'Enrollment status', type: 'status', options: [
          { code: 'ENROLLED', label: 'Enrolled' },
          { code: 'PENDING', label: 'Pending' },
          { code: 'WAIVED', label: 'Waived' },
        ] },
      ],
    },
    {
      code: 'COMPLIANCE',
      title: 'Compliance & Acknowledgements',
      category: 'Governance',
      scopeLevels: ['TENANT', 'LEGAL_ENTITY', 'ORG_UNIT', 'DEPARTMENT', 'MANAGER', 'EMPLOYEE', 'GROUP'],
      defaultVisualization: 'bar',
      fields: [
        { code: 'employeeNumber', label: 'Employee number', type: 'text', defaultSelected: true },
        { code: 'employeeName', label: 'Employee name', type: 'text', defaultSelected: true },
        { code: 'policyCode', label: 'Policy', type: 'text', defaultSelected: true },
        { code: 'documentType', label: 'Document type', type: 'text', defaultSelected: true },
        { code: 'acknowledgementStatus', label: 'Acknowledgement status', type: 'status', defaultSelected: true },
      ],
      metrics: [
        { code: 'acknowledgements', label: 'Acknowledgements', type: 'number' },
        { code: 'overdueAcknowledgements', label: 'Overdue acknowledgements', type: 'number' },
        { code: 'statutoryReports', label: 'Statutory reports', type: 'number' },
      ],
      groupBy: [
        { code: 'policyCode', label: 'Policy', type: 'text' },
        { code: 'documentType', label: 'Document type', type: 'text' },
        { code: 'acknowledgementStatus', label: 'Acknowledgement status', type: 'status' },
      ],
      filters: [
        { code: 'period', label: 'Period', type: 'status', options: REPORTING_PERIOD_OPTIONS },
        { code: 'department', label: 'Department', type: 'status', options: REPORTING_DEPARTMENT_OPTIONS },
        { code: 'acknowledgementStatus', label: 'Acknowledgement status', type: 'status', options: [
          { code: 'ACKNOWLEDGED', label: 'Acknowledged' },
          { code: 'PENDING', label: 'Pending' },
          { code: 'OVERDUE', label: 'Overdue' },
        ] },
      ],
    },
    {
      code: 'SERVICES',
      title: 'HR Services & Cases',
      category: 'Service Delivery',
      scopeLevels: ['TENANT', 'LEGAL_ENTITY', 'ORG_UNIT', 'DEPARTMENT', 'MANAGER', 'EMPLOYEE', 'GROUP'],
      defaultVisualization: 'bar',
      fields: [
        { code: 'caseNumber', label: 'Case number', type: 'text', defaultSelected: true },
        { code: 'serviceName', label: 'Service', type: 'text', defaultSelected: true },
        { code: 'employeeName', label: 'Employee name', type: 'text', defaultSelected: true },
        { code: 'caseStatus', label: 'Case status', type: 'status', defaultSelected: true },
      ],
      metrics: [
        { code: 'cases', label: 'Cases', type: 'number' },
        { code: 'openTasks', label: 'Open tasks', type: 'number' },
        { code: 'slaBreaches', label: 'SLA breaches', type: 'number' },
        { code: 'resolutionHours', label: 'Resolution hours', type: 'number' },
      ],
      groupBy: [
        { code: 'serviceName', label: 'Service', type: 'text' },
        { code: 'caseStatus', label: 'Case status', type: 'status' },
        { code: 'department', label: 'Department', type: 'text' },
      ],
      filters: [
        { code: 'period', label: 'Period', type: 'status', options: REPORTING_PERIOD_OPTIONS },
        { code: 'department', label: 'Department', type: 'status', options: REPORTING_DEPARTMENT_OPTIONS },
        { code: 'caseStatus', label: 'Case status', type: 'status', options: [
          { code: 'OPEN', label: 'Open' },
          { code: 'IN_PROGRESS', label: 'In progress' },
          { code: 'RESOLVED', label: 'Resolved' },
          { code: 'SLA_RISK', label: 'SLA risk' },
        ] },
      ],
    },
  ],
  templates: [
    { code: 'attendance-exceptions-monthly', title: 'Monthly Attendance Exceptions', dataSource: 'ATTENDANCE', description: 'Late arrivals, missing punches, geofence exceptions, and payroll readiness by department.', fields: ['employeeNumber', 'employeeName', 'workDate', 'attendanceStatus'], metrics: ['lateMinutes', 'exceptions'], groupBy: ['department'], scopeLevel: 'DEPARTMENT', visualization: 'bar', recommended: true, packCodes: ['FULL_HR_ANALYTICS', 'WORKFORCE_HEALTH', 'GOVERNANCE_PACK'] },
    { code: 'leave-liability', title: 'Leave Balance Liability', dataSource: 'LEAVE', description: 'Leave balance, pending requests, approved days, and payroll-impacting absence by entity.', fields: ['employeeNumber', 'employeeName', 'leaveType', 'requestStatus'], metrics: ['requestedDays', 'balanceRemaining'], groupBy: ['leaveType'], scopeLevel: 'LEGAL_ENTITY', visualization: 'bar', recommended: true, packCodes: ['FULL_HR_ANALYTICS', 'WORKFORCE_HEALTH'] },
    { code: 'payroll-cost-summary', title: 'Payroll Cost Summary', dataSource: 'PAYROLL', description: 'Gross-to-net, statutory amounts, deductions, and net pay by entity or department.', fields: ['employeeNumber', 'employeeName', 'payPeriod', 'payrollStatus'], metrics: ['grossPay', 'taxAmount', 'insuranceAmount', 'netPay'], groupBy: ['legalEntity'], scopeLevel: 'LEGAL_ENTITY', visualization: 'kpi', recommended: true, packCodes: ['FULL_HR_ANALYTICS', 'REWARD_CONTROL'] },
    { code: 'performance-360-readiness', title: 'Performance 360 Readiness', dataSource: 'PERFORMANCE', description: 'Review completion, peer feedback response depth, average rating, and goal progress by manager team.', fields: ['employeeNumber', 'employeeName', 'cycleName', 'reviewStatus'], metrics: ['reviewCount', 'feedbackResponses', 'averageRating'], groupBy: ['cycleName'], scopeLevel: 'MANAGER', visualization: 'bar', recommended: true, packCodes: ['FULL_HR_ANALYTICS', 'TALENT_360'] },
    { code: 'benefits-open-enrollment', title: 'Benefits Open Enrollment', dataSource: 'BENEFITS', description: 'Enrollment status, coverage level, dependents, and contribution impact by program.', fields: ['employeeNumber', 'employeeName', 'programName', 'coverageLevel'], metrics: ['enrollments', 'dependentsCovered', 'employeeContribution'], groupBy: ['programName'], scopeLevel: 'TENANT', visualization: 'pie', recommended: true, packCodes: ['FULL_HR_ANALYTICS', 'REWARD_CONTROL'] },
    { code: 'compliance-acknowledgement-risk', title: 'Compliance Acknowledgement Risk', dataSource: 'COMPLIANCE', description: 'Overdue acknowledgements, policy documents, statutory reports, and evidence gaps by owner.', fields: ['employeeNumber', 'employeeName', 'policyCode', 'acknowledgementStatus'], metrics: ['acknowledgements', 'overdueAcknowledgements', 'statutoryReports'], groupBy: ['acknowledgementStatus'], scopeLevel: 'TENANT', visualization: 'bar', recommended: true, packCodes: ['FULL_HR_ANALYTICS', 'GOVERNANCE_PACK'] },
    { code: 'hr-services-sla-demand', title: 'HR Services SLA Demand', dataSource: 'SERVICES', description: 'Case demand, SLA breaches, open tasks, and resolution hours by service and owner team.', fields: ['caseNumber', 'serviceName', 'employeeName', 'caseStatus'], metrics: ['cases', 'openTasks', 'slaBreaches', 'resolutionHours'], groupBy: ['serviceName'], scopeLevel: 'DEPARTMENT', visualization: 'bar', recommended: true, packCodes: ['FULL_HR_ANALYTICS', 'GOVERNANCE_PACK'] },
  ],
  analyticsPacks: [
    { code: 'FULL_HR_ANALYTICS', title: 'Full HR Analytics', category: 'Executive', description: 'Run the complete cross-module HR view across workforce, leave, payroll, performance, benefits, compliance, and services.', reportCodes: ['attendance-exceptions-monthly', 'leave-liability', 'payroll-cost-summary', 'performance-360-readiness', 'benefits-open-enrollment', 'compliance-acknowledgement-risk', 'hr-services-sla-demand'], dataSources: ['HEADCOUNT', 'ATTENDANCE', 'LEAVE', 'PAYROLL', 'PERFORMANCE', 'BENEFITS', 'COMPLIANCE', 'SERVICES'], defaultScopeLevel: 'TENANT', defaultPeriod: 'CURRENT_MONTH', outputs: ['Executive scorecard', 'Risk signals', 'Recommended drilldowns'] },
    { code: 'WORKFORCE_HEALTH', title: 'Workforce Health', category: 'Workforce', description: 'Attendance, leave, absence liability, overtime, and manager-team risk signals.', reportCodes: ['attendance-exceptions-monthly', 'leave-liability'], dataSources: ['HEADCOUNT', 'ATTENDANCE', 'LEAVE'], defaultScopeLevel: 'DEPARTMENT', defaultPeriod: 'LAST_90_DAYS', outputs: ['Attendance exceptions', 'Leave pressure', 'Coverage gaps'] },
    { code: 'REWARD_CONTROL', title: 'Reward Control', category: 'Reward', description: 'Payroll cost, salary components, deductions, benefits contribution, and payment readiness.', reportCodes: ['payroll-cost-summary', 'benefits-open-enrollment'], dataSources: ['PAYROLL', 'BENEFITS'], defaultScopeLevel: 'LEGAL_ENTITY', defaultPeriod: 'CURRENT_MONTH', outputs: ['Payroll cost summary', 'Close blockers', 'Benefits contribution checks'] },
    { code: 'TALENT_360', title: 'Talent & 360', category: 'Talent', description: 'Review readiness, feedback completion, goal progress, rating distribution, and team impact.', reportCodes: ['performance-360-readiness'], dataSources: ['PERFORMANCE', 'HEADCOUNT'], defaultScopeLevel: 'MANAGER', defaultPeriod: 'CURRENT_QUARTER', outputs: ['360 readiness', 'Review completion', 'Goal progress'] },
    { code: 'GOVERNANCE_PACK', title: 'Governance & Compliance', category: 'Governance', description: 'Policy, compliance, HR services, queue health, and audit-oriented exception reporting.', reportCodes: ['compliance-acknowledgement-risk', 'hr-services-sla-demand', 'attendance-exceptions-monthly'], dataSources: ['COMPLIANCE', 'SERVICES', 'ATTENDANCE'], defaultScopeLevel: 'TENANT', defaultPeriod: 'YEAR_TO_DATE', outputs: ['Exception evidence', 'Control readiness', 'Audit export list'] },
  ],
  smartCategories: [
    {
      code: 'WORKFORCE_COMPOSITION',
      title: 'Workforce Composition',
      group: 'People Intelligence',
      description: 'Understand active headcount, vacancies, attendance pressure, and absence patterns across the organization.',
      businessQuestions: [
        'Where is workforce capacity under pressure?',
        'Which departments combine vacancy risk with attendance exceptions?',
        'What follow-up report should HR operations run next?',
      ],
      dataSources: ['HEADCOUNT', 'ATTENDANCE', 'LEAVE'],
      reportCodes: ['attendance-exceptions-monthly', 'leave-liability'],
      drilldowns: ['Legal entity', 'Department', 'Manager team', 'Employee'],
      insights: [
        {
          code: 'capacity-risk',
          title: 'Capacity Risk Hotspots',
          question: 'Which teams show capacity risk this month?',
          metricLabel: 'Risk signals',
          metricValue: 18,
          trend: '+4 vs prior period',
          tone: 'warning',
          explanation: 'Engineering and Sales combine vacancy demand, late minutes, and pending leave into the highest operational pressure.',
          dataSources: ['HEADCOUNT', 'ATTENDANCE', 'LEAVE'],
          relatedReports: ['attendance-exceptions-monthly', 'leave-liability'],
          chart: [{ label: 'Engineering', value: 8 }, { label: 'Sales', value: 6 }, { label: 'Finance', value: 2 }, { label: 'HR', value: 2 }],
          affectedRecords: [
            { label: 'Engineering', value: '7 vacancies with 18 attendance exceptions', severity: 'risk' },
            { label: 'Sales', value: '6 pending leave requests during coverage gap', severity: 'watch' },
          ],
          actions: ['Open workforce review', 'Notify HR operations'],
        },
        {
          code: 'leave-pressure',
          title: 'Leave Pressure',
          question: 'Where could approved absence impact coverage?',
          metricLabel: 'Pending days',
          metricValue: 12,
          trend: 'Stable',
          tone: 'default',
          explanation: 'Leave demand is concentrated in teams with replacement coverage, but manager teams should confirm upcoming schedules.',
          dataSources: ['LEAVE', 'HEADCOUNT'],
          relatedReports: ['leave-liability'],
          chart: [{ label: 'Annual', value: 7 }, { label: 'Sick', value: 3 }, { label: 'Personal', value: 2 }],
          affectedRecords: [
            { label: 'Product', value: '2 requests awaiting approval', severity: 'watch' },
            { label: 'Finance', value: 'Coverage remains healthy', severity: 'safe' },
          ],
          actions: ['Review leave pipeline', 'Check manager coverage'],
        },
      ],
    },
    {
      code: 'REWARD_ASSURANCE',
      title: 'Reward Assurance',
      group: 'Financial Control',
      description: 'Connect payroll cost, benefits contribution, statutory deductions, and close blockers before payroll approval.',
      businessQuestions: [
        'Are payroll and benefit costs aligned to the current workforce?',
        'Which entities have close blockers or unusual deductions?',
        'What payroll-ready evidence should be reviewed before approval?',
      ],
      dataSources: ['PAYROLL', 'BENEFITS', 'HEADCOUNT'],
      reportCodes: ['payroll-cost-summary', 'benefits-open-enrollment'],
      drilldowns: ['Legal entity', 'Department', 'Pay period', 'Program'],
      insights: [
        {
          code: 'payroll-close-control',
          title: 'Payroll Close Control',
          question: 'What needs attention before payroll closes?',
          metricLabel: 'Close blockers',
          metricValue: 3,
          trend: '-2 vs last run',
          tone: 'warning',
          explanation: 'Payroll totals are within expected range, with three records requiring deduction or attendance evidence review.',
          dataSources: ['PAYROLL', 'ATTENDANCE', 'BENEFITS'],
          relatedReports: ['payroll-cost-summary', 'attendance-exceptions-monthly'],
          chart: [{ label: 'Ready', value: 22 }, { label: 'Blocked', value: 3 }],
          affectedRecords: [
            { label: 'Acme Corp USA', value: '2 deduction checks', severity: 'watch' },
            { label: 'Acme Corp UK', value: '1 attendance evidence check', severity: 'risk' },
          ],
          actions: ['Review payroll blockers', 'Export close evidence'],
        },
      ],
    },
    {
      code: 'GOVERNANCE_READINESS',
      title: 'Governance Readiness',
      group: 'Risk & Compliance',
      description: 'Correlate policy acknowledgements, HR service demand, audit evidence, and workforce exceptions for control readiness.',
      businessQuestions: [
        'Which controls need HR follow-up?',
        'Where do service cases and compliance gaps overlap?',
        'Which evidence pack should be prepared for audit?',
      ],
      dataSources: ['COMPLIANCE', 'SERVICES', 'ATTENDANCE'],
      reportCodes: ['compliance-acknowledgement-risk', 'hr-services-sla-demand', 'attendance-exceptions-monthly'],
      drilldowns: ['Policy', 'Service', 'Department', 'Employee'],
      insights: [
        {
          code: 'control-readiness',
          title: 'Control Readiness',
          question: 'Where are policy and service signals creating audit risk?',
          metricLabel: 'Open controls',
          metricValue: 9,
          trend: '+1 vs prior period',
          tone: 'warning',
          explanation: 'Policy acknowledgements and SLA-sensitive service cases are clustered in two departments that need owner follow-up.',
          dataSources: ['COMPLIANCE', 'SERVICES'],
          relatedReports: ['compliance-acknowledgement-risk', 'hr-services-sla-demand'],
          chart: [{ label: 'Policy', value: 4 }, { label: 'Services', value: 5 }],
          affectedRecords: [
            { label: 'Compliance policy ACK-2026', value: '4 overdue acknowledgements', severity: 'risk' },
            { label: 'HR Services', value: '5 SLA-sensitive cases', severity: 'watch' },
          ],
          actions: ['Send acknowledgements', 'Open service review'],
        },
      ],
    },
  ],
  businessRelationships: [
    { code: 'headcount-attendance-capacity', title: 'Headcount to Attendance Capacity', from: 'HEADCOUNT', to: 'ATTENDANCE', relationship: 'Capacity and exception context', businessUse: 'Shows whether attendance exceptions are isolated issues or symptoms of vacancy and coverage pressure.', grain: 'Worker assignment to worker-day', joinKeys: ['workerId', 'departmentId', 'managerWorkerId'], privacyLevel: 'standard', lineage: ['Worker profile', 'Assignment', 'Attendance ledger'], recommendedDrilldowns: ['Department', 'Manager', 'Employee'] },
    { code: 'leave-payroll-liability', title: 'Leave Liability to Payroll', from: 'LEAVE', to: 'PAYROLL', relationship: 'Absence cost and payroll readiness', businessUse: 'Connects approved leave and balances to payroll cost, deductions, and period close evidence.', grain: 'Absence request to payroll period', joinKeys: ['workerId', 'absenceRequestId', 'payPeriod'], privacyLevel: 'sensitive', lineage: ['Leave request', 'Approval workflow', 'Payroll input'], recommendedDrilldowns: ['Leave type', 'Department', 'Pay period'] },
    { code: 'attendance-payroll-readiness', title: 'Attendance to Payroll Readiness', from: 'ATTENDANCE', to: 'PAYROLL', relationship: 'Time evidence for payroll close', businessUse: 'Ensures late minutes, overtime, and exceptions are reviewed before payroll is approved.', grain: 'Worker-day to payroll period', joinKeys: ['workerId', 'workDate', 'payPeriod'], privacyLevel: 'sensitive', lineage: ['Attendance event', 'Daily ledger', 'Payroll preview'], recommendedDrilldowns: ['Department', 'Employee', 'Payroll status'] },
    { code: 'benefits-payroll-cost', title: 'Benefits to Payroll Cost', from: 'BENEFITS', to: 'PAYROLL', relationship: 'Contribution and deduction validation', businessUse: 'Compares enrollment and contribution data with payroll deduction results.', grain: 'Enrollment coverage to payroll component', joinKeys: ['workerId', 'benefitsEnrollmentId', 'payPeriod'], privacyLevel: 'restricted', lineage: ['Benefits enrollment', 'Contribution policy', 'Payroll deduction'], recommendedDrilldowns: ['Program', 'Coverage level', 'Employee'] },
    { code: 'compliance-services-control', title: 'Compliance to HR Services Control', from: 'COMPLIANCE', to: 'SERVICES', relationship: 'Policy follow-up and service demand', businessUse: 'Links overdue acknowledgements and policy gaps to cases, tasks, and SLA-sensitive HR service work.', grain: 'Worker-policy to service case', joinKeys: ['workerId', 'policyDocumentId', 'caseId'], privacyLevel: 'restricted', lineage: ['Policy document', 'Acknowledgement', 'HR case'], recommendedDrilldowns: ['Policy', 'Service', 'Department'] },
    { code: 'performance-headcount-talent', title: 'Performance to Workforce Planning', from: 'PERFORMANCE', to: 'HEADCOUNT', relationship: 'Talent readiness and succession context', businessUse: 'Combines review, rating, and goal signals with position and manager-team structure.', grain: 'Worker-cycle to position', joinKeys: ['workerId', 'reviewCycleId', 'positionId'], privacyLevel: 'sensitive', lineage: ['Performance cycle', 'Goal result', 'Worker assignment'], recommendedDrilldowns: ['Manager', 'Cycle', 'Position'] },
  ],
};

const SAVED_REPORT_DEFINITIONS = [
  {
    reportDefinitionId: '00000000-0000-0000-0000-00000000a501',
    reportName: 'Monthly attendance exceptions',
    reportType: 'CUSTOM',
    dataSource: 'ATTENDANCE',
    status: 'PUBLISHED',
    queryDefinition: {
      fields: ['employeeNumber', 'employeeName', 'workDate', 'attendanceStatus'],
      metrics: ['lateMinutes', 'exceptions'],
      groupBy: ['department'],
      scopeLevel: 'DEPARTMENT',
      populationValue: 'ENGINEERING',
      visualization: 'bar',
    },
  },
  {
    reportDefinitionId: '00000000-0000-0000-0000-00000000a502',
    reportName: 'Payroll cost by entity',
    reportType: 'CUSTOM',
    dataSource: 'PAYROLL',
    status: 'DRAFT',
    queryDefinition: {
      fields: ['employeeNumber', 'employeeName', 'payPeriod', 'payrollStatus'],
      metrics: ['grossPay', 'taxAmount', 'insuranceAmount', 'netPay'],
      groupBy: ['legalEntity'],
      scopeLevel: 'LEGAL_ENTITY',
      populationValue: 'ACME_EG',
      visualization: 'kpi',
    },
  },
];

export const MOCK_RESPONSES: Record<string, () => unknown> = {

  // ── Auth ──────────────────────────────────────────────────────────────────
  'GET /auth/me': () => ok(DEMO_USERS['hr.admin@example.com']),
  'GET /auth/tenants': () => ok([{ id: DEMO_TENANT_ID, name: 'Acme Corp', config: { currency: 'USD', dateFormat: 'MM/DD/YYYY', timezone: 'America/New_York', features: [] } }]),
  'POST /auth/logout': () => ok(null),

  // ── Employee profile – works for both Worker and EmployeeProfileData consumers ──
  'GET /employee/profile': () => ok({
    ...DEMO_WORKER_ME,
    ...DEMO_PROFILE_DATA,
  }),

  // ── Employee Attendance Setup ─────────────────────────────────────────────
  'GET /employee/attendance-setup': () => ok(DEFAULT_HCM_SETUP),

  // ── Employee Absences ─────────────────────────────────────────────────────
  'GET /employee/absences': () => ok([
    {
      id: 'abs-001',
      workerId: 'wkr-001',
      employeeId: 'EMP-0042',
      employeeName: 'Emily Chen',
      type: 'Annual Leave',
      absenceType: 'ANNUAL',
      startDate: '2026-07-14',
      endDate: '2026-07-18',
      status: 'APPROVED',
      workflowStatus: 'APPROVED',
      reason: 'Family vacation',
      requestedAt: '2026-06-01T08:00:00Z',
      approvedBy: 'James Harrington',
      approvedAt: '2026-06-02T10:00:00Z',
      calendarDays: 5,
      workingDays: 5,
      paid: true,
      deductFromBalance: true,
    },
    {
      id: 'abs-002',
      workerId: 'wkr-001',
      type: 'Sick Leave',
      absenceType: 'SICK',
      startDate: '2026-05-08',
      endDate: '2026-05-08',
      status: 'APPROVED',
      workflowStatus: 'APPROVED',
      requestedAt: '2026-05-08T07:30:00Z',
      calendarDays: 1,
      workingDays: 1,
      paid: true,
      deductFromBalance: true,
    },
  ]),
  'POST /employee/absences': () => ok({ id: 'abs-new' }),
  'GET /employee/absences/balance': () => ok([
    { type: 'ANNUAL', leaveTypeCode: 'ANNUAL', leaveTypeName: 'Annual Leave', balance: 12.5, remaining: 12.5, used: 3, pending: 0, unit: 'DAYS', accrualRate: 1.25 },
    { type: 'SICK', leaveTypeCode: 'SICK', leaveTypeName: 'Sick Leave', balance: 5, remaining: 5, used: 1, pending: 0, unit: 'DAYS', accrualRate: 0.5 },
    { type: 'PERSONAL', leaveTypeCode: 'PERSONAL', leaveTypeName: 'Personal', balance: 2, remaining: 2, used: 0, pending: 0, unit: 'DAYS', accrualRate: 0 },
  ]),
  'GET /employee/absences/policies': () => ok({
    policies: DEFAULT_HCM_SETUP.leavePolicies.map((p) => ({ ...p, remainingBalance: 10 })),
    annualLeavePolicy: DEFAULT_HCM_SETUP.leavePolicies[0] ?? null,
  }),
  'GET /employee/payslips': () => ok([
    {
      id: 'pay-001', workerId: 'wkr-001', employeeId: 'EMP-0042', employeeName: 'Emily Chen',
      payPeriodStart: '2026-05-01', payPeriodEnd: '2026-05-31', payDate: '2026-05-31',
      grossPay: 8500, netPay: 6120, deductions: 850, taxes: 1530, currency: 'USD',
      lines: [
        { id: 'l1', lineType: 'EARNING', description: 'Base Salary', amount: 8500, currency: 'USD' },
        { id: 'l2', lineType: 'DEDUCTION', description: 'Federal Tax', amount: -1275, currency: 'USD' },
        { id: 'l3', lineType: 'DEDUCTION', description: 'State Tax', amount: -255, currency: 'USD' },
        { id: 'l4', lineType: 'DEDUCTION', description: 'Health Insurance', amount: -450, currency: 'USD' },
        { id: 'l5', lineType: 'DEDUCTION', description: '401(k)', amount: -400, currency: 'USD' },
      ],
    },
    { id: 'pay-002', workerId: 'wkr-001', payPeriodStart: '2026-04-01', payPeriodEnd: '2026-04-30', payDate: '2026-04-30', grossPay: 8500, netPay: 6120, deductions: 850, taxes: 1530, currency: 'USD' },
    { id: 'pay-003', workerId: 'wkr-001', payPeriodStart: '2026-03-01', payPeriodEnd: '2026-03-31', payDate: '2026-03-31', grossPay: 8500, netPay: 6120, deductions: 850, taxes: 1530, currency: 'USD' },
  ]),
  'GET /employee/benefits': () => ok({
    enrollments: [
      { id: 'ben-001', workerId: 'wkr-001', benefitType: 'HEALTH', planName: 'Premium Health Plan', coverageLevel: 'EMPLOYEE_PLUS_SPOUSE', effectiveDate: '2021-03-15', status: 'ACTIVE' },
      { id: 'ben-002', workerId: 'wkr-001', benefitType: 'DENTAL', planName: 'Dental Plus', coverageLevel: 'EMPLOYEE', effectiveDate: '2021-03-15', status: 'ACTIVE' },
      { id: 'ben-003', workerId: 'wkr-001', benefitType: 'VISION', planName: 'Vision Care', coverageLevel: 'EMPLOYEE', effectiveDate: '2021-03-15', status: 'ACTIVE' },
      { id: 'ben-004', workerId: 'wkr-001', benefitType: '401K', planName: '401(k) Retirement Plan', coverageLevel: 'EMPLOYEE', effectiveDate: '2021-09-15', status: 'ACTIVE' },
    ],
    activePrograms: [
      { id: '00000000-0000-0000-0000-000000000321', programName: 'Premium Health Plan', programType: 'HEALTH', status: 'ACTIVE' },
      { id: '00000000-0000-0000-0000-000000000322', programName: 'Dental Plus', programType: 'DENTAL', status: 'ACTIVE' },
    ],
    openEnrollmentActive: true,
    openEnrollmentDeadline: '2026-06-30',
    lifeEvents: [
      { id: 'life-001', type: 'MARRIAGE', date: '2026-02-14', status: 'PROCESSED' },
    ],
    dependents: [
      { id: 'dep-001', name: 'Alex Employee', relationship: 'Spouse', dateOfBirth: '1991-05-20' },
    ],
    spendingAccounts: [],
  }),
  'POST /employee/benefits/enrollments': () => ok({ enrollmentId: 'ben-new', status: 'SUBMITTED' }),
  'POST /employee/benefits/life-events': () => ok({ lifeEventId: 'life-new', status: 'RECORDED' }),
  'GET /employee/onboarding': () => ok({
    status: 'COMPLETED', completedAt: '2021-04-05',
    tasks: [
      { id: 't1', title: 'Sign employment contract', status: 'COMPLETED', completedAt: '2021-03-16' },
      { id: 't2', title: 'Set up workstation', status: 'COMPLETED', completedAt: '2021-03-16' },
      { id: 't3', title: 'Complete I-9 verification', status: 'COMPLETED', completedAt: '2021-03-17' },
    ],
  }),
  'GET /employee/performance': () => ok({
    currentCycle: { id: 'prc-001', name: 'H1 2026', status: 'IN_PROGRESS' },
    selfAssessmentDue: '2026-06-10',
    overallRating: null,
    goals: [
      { id: 'g1', title: 'Launch new feature module', status: 'IN_PROGRESS', progress: 75 },
      { id: 'g2', title: 'Complete AWS certification', status: 'NOT_STARTED', progress: 0 },
    ],
  }),

  // ── Attendance ────────────────────────────────────────────────────────────
  'GET /time/attendance/today': () => ok(mockAttendanceToday()),
  'GET /time/attendance/workers/': () => ok(mockAttendanceToday()),
  'GET /time/attendance/summary': () => ok({
    workerId: 'wkr-001',
    summary: { payableMinutes: 9480, lateMinutes: 15, undertimeMinutes: 0, overtimeMinutes: 120, geofenceViolations: 0 },
  }),
  'GET /time/attendance/daily-ledger': () => ok({ entries: [], totals: { payableMinutes: 0, lateMinutes: 0, overtimeMinutes: 0 } }),
  'GET /time/attendance/correction-requests': () => ok([]),
  'GET /time/attendance/reminders': () => ok({ reminders: [], missedCheckouts: [] }),
  'GET /time/attendance/reports/period-view': () => ok(mockAttendancePeriodView()),
  'GET /time/attendance/reports/summary': () => ok({ entries: [], periodSummary: { totalPayableMinutes: 0, totalLateMinutes: 0, totalOvertimeMinutes: 0 } }),
  'GET /time/attendance/scheduling-command-center': () => ok({ shifts: [], unscheduled: 0 }),
  'GET /time/attendance/period-close/readiness': () => ok({ ready: true, blockers: [], warnings: [], workerCount: 8, processedCount: 8 }),
  'POST /time/attendance/check-in': () => ok({ eventId: 'evt-new-in' }),
  'POST /time/attendance/check-out': () => ok({ eventId: 'evt-new-out' }),
  'POST /time/attendance/correction-requests': () => ok({ id: 'cr-new' }),
  'POST /time/attendance/daily-ledger/finalize': () => ok({ status: 'FINALIZED', processedCount: 8 }),

  // ── Absence / Leave ───────────────────────────────────────────────────────
  'GET /absence/leave/absence-requests': () => ok([
    {
      id: 'abs-001', workerId: 'wkr-001', employeeId: 'EMP-0042', employeeName: 'Emily Chen',
      type: 'Annual Leave', startDate: '2026-07-14', endDate: '2026-07-18',
      status: 'APPROVED', requestedAt: '2026-06-01T08:00:00Z', workingDays: 5, paid: true,
    },
    {
      id: 'abs-003', workerId: 'wkr-004', employeeId: 'EMP-0055', employeeName: 'Marcus Johnson',
      type: 'Annual Leave', startDate: '2026-06-20', endDate: '2026-06-20',
      status: 'PENDING', requestedAt: '2026-06-04T07:45:00Z', workingDays: 1, paid: true,
    },
  ]),
  'GET /absence/leave/accrual-balances': () => ok([
    { leaveTypeCode: 'ANNUAL', leaveTypeName: 'Annual Leave', balanceDays: 12.5, usedDays: 3, pendingDays: 5 },
    { leaveTypeCode: 'SICK', leaveTypeName: 'Sick Leave', balanceDays: 5, usedDays: 1, pendingDays: 0 },
  ]),

  // ── Admin Dashboard ───────────────────────────────────────────────────────
  'GET /admin/dashboard': () => ok({
    headcount: 248, turnover: 8.2, openPositions: 14,
    newHiresThisMonth: 6, terminationsThisMonth: 2,
    recentActivity: [
      { id: 'ra1', description: 'Emily Chen updated her emergency contact', timestamp: '2026-06-04T08:30:00Z', type: 'PROFILE_UPDATE' },
      { id: 'ra2', description: 'Marcus Johnson submitted leave request', timestamp: '2026-06-04T07:45:00Z', type: 'LEAVE_REQUEST' },
      { id: 'ra3', description: 'Payroll cycle June 2026 initiated', timestamp: '2026-06-03T14:00:00Z', type: 'PAYROLL' },
      { id: 'ra4', description: 'Priya Sharma completed onboarding', timestamp: '2026-06-02T11:00:00Z', type: 'ONBOARDING' },
    ],
    alerts: [
      { id: 'al1', severity: 'high', message: '3 employees missing payroll bank accounts' },
      { id: 'al2', severity: 'medium', message: '7 performance reviews overdue' },
      { id: 'al3', severity: 'low', message: 'Q3 compliance deadline in 26 days' },
    ],
  }),
  'GET /admin/hcm-setup': () => ok(DEFAULT_HCM_SETUP),

  // ── Workers ───────────────────────────────────────────────────────────────
  'GET /hr/core/workers': () => ok({ items: WORKERS, total: WORKERS.length, page: 1, pageSize: 250, totalPages: 1 }),

  // ── Organization ──────────────────────────────────────────────────────────
  'GET /hr/organization/summary': () => ok({
    legalEntities: [
      { id: 'le-001', name: 'Acme Corp USA', type: 'LEGAL_ENTITY', countryCode: 'US', registrationNumber: 'US-3392011', status: 'ACTIVE', headcount: 180 },
      { id: 'le-002', name: 'Acme Corp UK', type: 'LEGAL_ENTITY', countryCode: 'GB', registrationNumber: 'UK-7741920', status: 'ACTIVE', headcount: 42 },
      { id: 'le-003', name: 'Acme Corp Canada', type: 'LEGAL_ENTITY', countryCode: 'CA', registrationNumber: 'CA-5582013', status: 'ACTIVE', headcount: 26 },
    ],
    orgUnits: [
      { id: 'dept-eng', name: 'Engineering', type: 'DEPARTMENT', legalEntityId: 'le-001', parentOrgUnitId: null, status: 'ACTIVE', headcount: 65 },
      { id: 'dept-product', name: 'Product', type: 'DEPARTMENT', legalEntityId: 'le-001', parentOrgUnitId: null, status: 'ACTIVE', headcount: 20 },
      { id: 'dept-design', name: 'Design', type: 'DEPARTMENT', legalEntityId: 'le-001', parentOrgUnitId: null, status: 'ACTIVE', headcount: 15 },
      { id: 'dept-finance', name: 'Finance', type: 'DEPARTMENT', legalEntityId: 'le-001', parentOrgUnitId: null, status: 'ACTIVE', headcount: 25 },
      { id: 'dept-hr', name: 'Human Resources', type: 'DEPARTMENT', legalEntityId: 'le-001', parentOrgUnitId: null, status: 'ACTIVE', headcount: 12 },
      { id: 'dept-sales', name: 'Sales', type: 'DEPARTMENT', legalEntityId: 'le-001', parentOrgUnitId: null, status: 'ACTIVE', headcount: 43 },
    ],
    orgChart: [
      { id: 'le-001', name: 'Acme Corp USA', type: 'LEGAL_ENTITY', headcount: 180, children: [
        { id: 'dept-eng', name: 'Engineering', type: 'DEPARTMENT', headcount: 65, managerId: 'wkr-mgr-001', managerName: 'James Harrington', children: [] },
        { id: 'dept-product', name: 'Product', type: 'DEPARTMENT', headcount: 20, children: [] },
        { id: 'dept-design', name: 'Design', type: 'DEPARTMENT', headcount: 15, children: [] },
        { id: 'dept-finance', name: 'Finance', type: 'DEPARTMENT', headcount: 25, children: [] },
        { id: 'dept-hr', name: 'Human Resources', type: 'DEPARTMENT', headcount: 12, children: [] },
        { id: 'dept-sales', name: 'Sales', type: 'DEPARTMENT', headcount: 43, children: [] },
      ] },
      { id: 'le-002', name: 'Acme Corp UK', type: 'LEGAL_ENTITY', headcount: 42, children: [] },
      { id: 'le-003', name: 'Acme Corp Canada', type: 'LEGAL_ENTITY', headcount: 26, children: [] },
    ],
    managerRelationships: [
      { id: 'mr-001', workerId: 'wkr-004', workerName: 'Marcus Johnson', managerId: 'wkr-mgr-001', managerName: 'James Harrington', departmentId: 'dept-eng', isPrimary: true, startDate: '2022-07-11' },
      { id: 'mr-002', workerId: 'wkr-001', workerName: 'Emily Chen', managerId: 'wkr-mgr-001', managerName: 'James Harrington', departmentId: 'dept-eng', isPrimary: true, startDate: '2021-03-15' },
    ],
  }),
  'GET /hr/organization/org-units/tree': () => ok([
    {
      id: 'le-001', name: 'Acme Corp USA', type: 'LEGAL_ENTITY', headcount: 180,
      children: [
        { id: 'dept-eng', name: 'Engineering', type: 'DEPARTMENT', headcount: 65, managerId: 'wkr-mgr-001', managerName: 'James Harrington', children: [] },
        { id: 'dept-product', name: 'Product', type: 'DEPARTMENT', headcount: 20, children: [] },
        { id: 'dept-design', name: 'Design', type: 'DEPARTMENT', headcount: 15, children: [] },
        { id: 'dept-finance', name: 'Finance', type: 'DEPARTMENT', headcount: 25, children: [] },
        { id: 'dept-hr', name: 'Human Resources', type: 'DEPARTMENT', headcount: 12, children: [] },
        { id: 'dept-sales', name: 'Sales', type: 'DEPARTMENT', headcount: 43, children: [] },
      ],
    },
    { id: 'le-002', name: 'Acme Corp UK', type: 'LEGAL_ENTITY', headcount: 42, children: [] },
    { id: 'le-003', name: 'Acme Corp Canada', type: 'LEGAL_ENTITY', headcount: 26, children: [] },
  ]),
  'GET /hr/organization/org-units': () => ok([
    { id: 'dept-eng', name: 'Engineering', type: 'DEPARTMENT', headcount: 65 },
    { id: 'dept-product', name: 'Product', type: 'DEPARTMENT', headcount: 20 },
    { id: 'dept-design', name: 'Design', type: 'DEPARTMENT', headcount: 15 },
    { id: 'dept-finance', name: 'Finance', type: 'DEPARTMENT', headcount: 25 },
    { id: 'dept-hr', name: 'Human Resources', type: 'DEPARTMENT', headcount: 12 },
    { id: 'dept-sales', name: 'Sales', type: 'DEPARTMENT', headcount: 43 },
  ]),
  'GET /hr/organization/legal-entities': () => ok([
    { id: 'le-001', name: 'Acme Corp USA', type: 'LEGAL_ENTITY', headcount: 180 },
    { id: 'le-002', name: 'Acme Corp UK', type: 'LEGAL_ENTITY', headcount: 42 },
    { id: 'le-003', name: 'Acme Corp Canada', type: 'LEGAL_ENTITY', headcount: 26 },
  ]),
  'GET /hr/organization/workforce-planning': () => ok({
    summary: {
      currentHeadcount: 248, activeHeadcount: 240, legalEntities: 3, departments: 6,
      totalPositions: 268, filledPositions: 248, vacancies: 20, pendingHeadcount: 6, approvedHeadcount: 14,
    },
    orgChart: {
      byDepartment: PLANNING_GROUPS_BY_DEPT,
      byLegalEntity: PLANNING_GROUPS_BY_ENTITY,
      byManager: PLANNING_GROUPS_BY_MANAGER,
    },
    headcountPlan: [
      { departmentId: 'dept-eng', departmentName: 'Engineering', currentHeadcount: 65, approvedPositions: 72, vacancies: 7, pendingRequests: 3, approvedRequests: 4, forecastDemand: 78 },
      { departmentId: 'dept-sales', departmentName: 'Sales', currentHeadcount: 43, approvedPositions: 50, vacancies: 7, pendingRequests: 2, approvedRequests: 3, forecastDemand: 54 },
      { departmentId: 'dept-product', departmentName: 'Product', currentHeadcount: 20, approvedPositions: 22, vacancies: 2, pendingRequests: 1, approvedRequests: 1, forecastDemand: 24 },
      { departmentId: 'dept-design', departmentName: 'Design', currentHeadcount: 15, approvedPositions: 16, vacancies: 1, pendingRequests: 0, approvedRequests: 1, forecastDemand: 17 },
      { departmentId: 'dept-finance', departmentName: 'Finance', currentHeadcount: 25, approvedPositions: 25, vacancies: 0, pendingRequests: 0, approvedRequests: 0, forecastDemand: 26 },
      { departmentId: 'dept-hr', departmentName: 'Human Resources', currentHeadcount: 12, approvedPositions: 12, vacancies: 0, pendingRequests: 0, approvedRequests: 0, forecastDemand: 13 },
    ],
    workforceCostPlan: {
      salary: 24800000, benefits: 4960000, socialInsuranceAndTax: 3720000, overtime: 620000,
      allowancesTravelRelocation: 880000, training: 540000, contractorCost: 1200000, totalAnnualCost: 36720000,
    },
    skillsGap: [
      { skill: 'Cloud / DevOps', required: 18, available: 12, gap: 6, severity: 'HIGH' },
      { skill: 'Data Engineering', required: 10, available: 7, gap: 3, severity: 'MEDIUM' },
      { skill: 'Product Design', required: 8, available: 7, gap: 1, severity: 'LOW' },
    ],
    strategicDashboard: {
      vacancyRiskPercent: 7.5, retirementRisk: 4, successionGaps: 3, criticalRolesWithoutBackup: 2,
      attritionHotspots: [
        { departmentId: 'dept-sales', departmentName: 'Sales', terminations: 4 },
        { departmentId: 'dept-eng', departmentName: 'Engineering', terminations: 2 },
      ],
      genderBalance: [
        { gender: 'FEMALE', count: 112 },
        { gender: 'MALE', count: 128 },
        { gender: 'UNDISCLOSED', count: 8 },
      ],
      productivityPerEmployee: 142000,
    },
    aiForecast: [
      { horizonMonths: 3, forecastHeadcountDemand: 256, deltaFromToday: 8, confidence: 'HIGH', drivers: ['Q3 sales expansion', 'Engineering backfill'] },
      { horizonMonths: 6, forecastHeadcountDemand: 268, deltaFromToday: 20, confidence: 'MEDIUM', drivers: ['New product line', 'Attrition replacement'] },
      { horizonMonths: 12, forecastHeadcountDemand: 284, deltaFromToday: 36, confidence: 'LOW', drivers: ['Market growth', 'UK office scale-up'] },
    ],
  }),
  'GET /hr/organization/org-chart': () => ok({ groupBy: 'department', filters: [], nodes: PLANNING_GROUPS_BY_DEPT }),
  'POST /hr/organization/workforce-scenarios/simulate': () => ok({
    name: 'Simulated scenario',
    baseline: { headcount: 248, annualCost: 36720000, averageCostPerFte: 148065 },
    drivers: { branchExpansion: 12, automationOffset: -6, demandGrowth: 18, outsourcing: -4 },
    projected: { headcount: 272, annualCost: 39860000, headcountDelta: 24, costDelta: 3140000 },
    recommendation: 'Phase hiring across two quarters to absorb a 9.7% headcount increase while automation offsets six roles, keeping cost-per-FTE within target.',
  }),

  // ── Payroll ───────────────────────────────────────────────────────────────
  'GET /payroll/cycles': () => ok({
    items: [
      { id: 'cyc-001', name: 'June 2026', status: 'OPEN', periodStart: '2026-06-01', periodEnd: '2026-06-30', payDate: '2026-06-30', headcount: 248, totalGross: 1980000, totalNet: 1426000, currency: 'USD' },
      { id: 'cyc-002', name: 'May 2026', status: 'CLOSED', periodStart: '2026-05-01', periodEnd: '2026-05-31', payDate: '2026-05-31', headcount: 246, totalGross: 1960000, totalNet: 1411000, currency: 'USD' },
    ],
    total: 2, page: 1, pageSize: 20, totalPages: 1,
  }),
  'GET /payroll/dashboard': () => ok({
    currentCycle: { id: 'cyc-001', name: 'June 2026', status: 'OPEN', periodStart: '2026-06-01', periodEnd: '2026-06-30' },
    totalGrossLast: 1960000, totalNetLast: 1411000, pendingActions: 3, blockers: 3,
  }),
  'GET /payroll/payment-batches': () => ok({ items: [], total: 0 }),
  'POST /payroll/off-cycle-preview': () => ok({ preview: [], totalGross: 0, totalNet: 0 }),

  // ── Performance ───────────────────────────────────────────────────────────
  'GET /performance/review-cycles/tenant': () => ok([
    { id: 'prc-001', name: 'H1 2026 Performance Review', status: 'IN_PROGRESS', startDate: '2026-05-01', endDate: '2026-06-30', completionRate: 62 },
    { id: 'prc-002', name: 'H2 2025 Performance Review', status: 'COMPLETED', startDate: '2025-11-01', endDate: '2025-12-31', completionRate: 100 },
  ]),
  'GET /performance/review-templates/tenant': () => ok([]),
  'GET /performance/competencies/tenant': () => ok([]),
  'GET /performance/goals': () => ok([
    { id: 'g1', title: 'Launch new feature module', status: 'IN_PROGRESS', dueDate: '2026-06-30', progress: 75 },
    { id: 'g2', title: 'Complete AWS certification', status: 'NOT_STARTED', dueDate: '2026-09-30', progress: 0 },
    { id: 'g3', title: 'Mentor 2 junior engineers', status: 'IN_PROGRESS', dueDate: '2026-12-31', progress: 40 },
  ]),
  'GET /performance/manager-dashboard': () => ok({ teamSize: 5, reviewsCompleted: 3, reviewsPending: 2, averageRating: 3.8 }),
  'GET /performance/feedback-360-responses/self-service': () => ok({ pendingRequests: [], completedResponses: [] }),

  // ── Onboarding ────────────────────────────────────────────────────────────
  'GET /hr/onboarding/plans': () => ok([
    { id: 'op-001', workerId: 'wkr-006', workerName: 'Alex Rivera', status: 'IN_PROGRESS', startDate: '2026-05-20', completedTasks: 7, totalTasks: 12 },
  ]),

  // ── Manager ───────────────────────────────────────────────────────────────
  'GET /manager/dashboard': () => ok({
    directReports: WORKERS.filter((w) => w.managerId === 'wkr-mgr-001'),
    pendingApprovals: {
      absences: [
        { id: 'abs-003', workerId: 'wkr-004', employeeId: 'EMP-0055', employeeName: 'Marcus Johnson', type: 'Annual Leave', startDate: '2026-06-20', endDate: '2026-06-20', status: 'PENDING', requestedAt: '2026-06-04T07:45:00Z', workingDays: 1, paid: true, reason: 'Personal day' },
      ],
      timesheets: 0,
      expenses: 0,
    },
    teamMetrics: {
      headcount: 2,
      averagePerformance: 78,
      openGoals: 5,
    },
  }),
  'GET /manager/team': () => {
    const directReports = WORKERS.filter((w) => w.managerId === 'wkr-mgr-001');
    const selectedMember = directReports.find((worker) => worker.id === 'wkr-004') ?? directReports[0];

    return ok({
      directReports,
      selectedMember: selectedMember
        ? {
            ...selectedMember,
            compensationBand: 'P3',
            performanceRating: 4.2,
            lastReviewDate: '2026-06-05',
            goals: [
              {
                id: 'goal-manager-team-1',
                title: 'Raise launch readiness delivery above 75%',
                status: 'IN_PROGRESS',
                progress: 55,
              },
              {
                id: 'goal-manager-team-2',
                title: 'Document release ownership handoffs',
                status: 'OPEN',
                progress: 25,
              },
            ],
            performanceImpact: {
              actionPlan: {
                riskLevel: 'MEDIUM',
                checkInCadence: 'Twice-weekly manager action-plan check-in',
                recommendedActions: [
                  'Advance action plan objective: Raise launch goal delivery above 75%',
                  'Pair peer feedback themes with the next delivery milestone',
                ],
                currentPerformance: {
                  latestRating: 4.2,
                  averageGoalProgress: 40,
                  peerAverageRating: 4.5,
                  activeGoalCount: 2,
                  openDevelopmentPlan: true,
                },
              },
              feedbackSummary: {
                averageRating: 4.5,
                responseCount: 3,
                anonymousResponseCount: 1,
                conciseFeedback:
                  'Average peer rating is 4.5. Strengths: Keeps peers aligned. Focus: Escalate delivery risks earlier.',
              },
              nineBox: {
                box: 'Core contributor',
                performanceScore: 72,
                potentialScore: 66,
              },
            },
          }
        : undefined,
    });
  },
  'GET /manager/leave/requests': () => ok([
    { id: 'abs-003', workerId: 'wkr-004', employeeName: 'Marcus Johnson', type: 'Annual Leave', startDate: '2026-06-20', endDate: '2026-06-20', status: 'PENDING', requestedAt: '2026-06-04T07:45:00Z', workingDays: 1, paid: true },
  ]),
  'GET /manager/attendance/exceptions': () => ok({ exceptions: [], total: 0 }),

  // ── Service Delivery ─────────────────────────────────────────────────────
  'GET /hr-service-delivery/cases/my': () => ok([
    { id: 'case-001', title: 'Update home address', status: 'RESOLVED', createdAt: '2026-04-10T10:00:00Z', resolvedAt: '2026-04-12T14:00:00Z' },
  ]),
  'GET /hr-service-delivery/catalog-items': () => ok([
    { id: 'ci1', title: 'Request Employment Verification Letter', category: 'Documents', sla: '2 business days' },
    { id: 'ci2', title: 'Update Personal Information', category: 'Profile', sla: 'Same day' },
    { id: 'ci3', title: 'Report IT Equipment Issue', category: 'IT Support', sla: '4 hours' },
    { id: 'ci4', title: 'Request Salary Certificate', category: 'Payroll', sla: '3 business days' },
  ]),
  'POST /hr-service-delivery/cases': () => ok({ id: 'case-new', caseNumber: 'HR-20260609-ABCD1234' }),

  // ── Compliance ────────────────────────────────────────────────────────────
  'GET /compliance/summary': () => ok({
    overallScore: 87, openItems: 5, overdueItems: 1,
    upcomingDeadlines: [
      { id: 'cd1', title: 'GDPR Data Audit', dueDate: '2026-06-30', priority: 'HIGH' },
      { id: 'cd2', title: 'Annual Ethics Training', dueDate: '2026-07-31', priority: 'MEDIUM' },
    ],
  }),
  'GET /compliance/policy-documents': () => ok([]),

  // ── Country Policy ────────────────────────────────────────────────────────
  'GET /country-policy/policy-packs': () => ok([
    { id: 'pp-us', countryCode: 'US', version: '2.1.0', name: 'United States Statutory Pack', status: 'PUBLISHED', createdAt: '2026-01-01', updatedAt: '2026-03-15', createdBy: 'system' },
    { id: 'pp-gb', countryCode: 'GB', version: '1.4.0', name: 'United Kingdom Statutory Pack', status: 'PUBLISHED', createdAt: '2026-01-01', updatedAt: '2026-02-28', createdBy: 'system' },
    { id: 'pp-ca', countryCode: 'CA', version: '1.2.0', name: 'Canada Statutory Pack', status: 'DRAFT', createdAt: '2026-04-01', updatedAt: '2026-05-20', createdBy: 'hr.admin@example.com' },
  ]),
  'POST /country-policy/policy-packs/validate': () => ok({ valid: true, errors: [], warnings: [] }),
  'POST /country-policy/policy-packs/simulate': () => ok({ result: {}, previewLines: [] }),
  'POST /country-policy/policy-packs/approve': () => ok({ status: 'APPROVED' }),
  'POST /country-policy/policy-packs/publish': () => ok({ status: 'PUBLISHED' }),

  // ── Integrations ──────────────────────────────────────────────────────────
  'GET /hr/integrations/health': () => ok({ status: 'HEALTHY', integrations: [] }),
  'GET /hr/integrations/status': () => ok([
    { id: 'int-1', name: 'Slack', type: 'COMMUNICATION', status: 'CONNECTED', lastSync: '2026-06-04T06:00:00Z' },
    { id: 'int-2', name: 'Google Workspace', type: 'DIRECTORY', status: 'CONNECTED', lastSync: '2026-06-04T05:00:00Z' },
  ]),

  // ── Policies ──────────────────────────────────────────────────────────────
  'GET /admin/policies/summary': () => ok({ leavePolicies: DEFAULT_HCM_SETUP.leavePolicies.length, payrollPacks: DEFAULT_HCM_SETUP.statutoryPayrollPacks.length, earningPolicies: DEFAULT_HCM_SETUP.earningPolicies.length, deductionPolicies: DEFAULT_HCM_SETUP.deductionPolicies.length }),
  'GET /admin/policies/revisions': () => ok([]),
  'GET /admin/policies/decision-evidence?limit=50': () => ok([]),

  // ── Dead Letter ───────────────────────────────────────────────────────────
  'GET /admin/dead-letter/summary': () => ok({ inboxCount: 2, outboxCount: 0, oldestEventAt: '2026-06-03T12:00:00Z' }),
  'GET /admin/dead-letter/inbox': () => ok([]),
  'GET /admin/dead-letter/outbox': () => ok([]),

  // ── Event Contracts ───────────────────────────────────────────────────────
  'GET /admin/event-contracts/registry': () => ok([]),

  // ── Access Governance ─────────────────────────────────────────────────────
  'GET /admin/access-governance': () => ok({ totalUsers: 248, rolesCount: 8, serviceAccounts: 4, recentAudit: [] }),
  'GET /admin/access-governance/roles': () => ok([
    { id: 'r1', name: 'HR_ADMIN', description: 'Full HR administration access', userCount: 5 },
    { id: 'r2', name: 'APP_ADMIN', description: 'Application configuration access', userCount: 2 },
    { id: 'r3', name: 'MANAGER', description: 'Team management access', userCount: 32 },
    { id: 'r4', name: 'EMPLOYEE', description: 'Standard employee access', userCount: 209 },
  ]),

  // ── Audit ─────────────────────────────────────────────────────────────────
  'GET /audit': () => ok({
    items: [
      { id: 'au1', action: 'PROFILE_UPDATE', actorId: 'usr-emp-001', actorName: 'Emily Chen', resourceType: 'Worker', resourceId: 'wkr-001', timestamp: '2026-06-04T08:30:00Z' },
      { id: 'au2', action: 'LEAVE_APPROVE', actorId: 'usr-mgr-001', actorName: 'James Harrington', resourceType: 'AbsenceRequest', resourceId: 'abs-001', timestamp: '2026-06-02T10:00:00Z' },
      { id: 'au3', action: 'PAYROLL_CYCLE_OPEN', actorId: 'usr-admin-001', actorName: 'Sarah Mitchell', resourceType: 'PayrollCycle', resourceId: 'cyc-001', timestamp: '2026-06-01T09:00:00Z' },
    ],
    total: 3, page: 1, pageSize: 50, totalPages: 1,
  }),

  // ── Reporting ─────────────────────────────────────────────────────────────
  'GET /reporting/builder/catalog': () => ok(REPORT_BUILDER_CATALOG),
  'GET /reporting/report-definitions': () => ok(SAVED_REPORT_DEFINITIONS),
  'GET /reporting/calculated-fields': () => ok([
    { calculatedFieldId: '00000000-0000-0000-0000-00000000c501', fieldName: 'Net payroll cost', expression: 'grossPay - deductionAmount', dataType: 'currency', sourceFields: ['grossPay', 'deductionAmount'], status: 'ACTIVE' },
    { calculatedFieldId: '00000000-0000-0000-0000-00000000c502', fieldName: 'Attendance risk score', expression: 'lateMinutes + exceptions', dataType: 'number', sourceFields: ['lateMinutes', 'exceptions'], status: 'DRAFT' },
  ]),
  'POST /reporting/builder/analytics-packs/run': () => ok({
    packCode: 'FULL_HR_ANALYTICS',
    title: 'Full HR Analytics',
    generatedAt: '2026-06-11T08:00:00.000Z',
    scopeLevel: 'TENANT',
    period: 'CURRENT_MONTH',
    reportOptions: [
      { code: 'attendance-exceptions-monthly', title: 'Monthly Attendance Exceptions', dataSource: 'ATTENDANCE', recommended: true },
      { code: 'leave-liability', title: 'Leave Balance Liability', dataSource: 'LEAVE', recommended: true },
      { code: 'payroll-cost-summary', title: 'Payroll Cost Summary', dataSource: 'PAYROLL', recommended: true },
      { code: 'compliance-acknowledgement-risk', title: 'Compliance Acknowledgement Risk', dataSource: 'COMPLIANCE', recommended: true },
    ],
    highlights: [
      { label: 'Active workforce', value: 248, tone: 'success' },
      { label: 'Open risk signals', value: 26, tone: 'warning' },
      { label: 'Payroll net pay', value: 'EGP 210,000', tone: 'default' },
      { label: 'Pending actions', value: 11, tone: 'warning' },
    ],
    charts: [
      { title: 'Workforce risk', data: [{ label: 'Attendance', value: 18 }, { label: 'Leave', value: 12 }, { label: 'Services', value: 9 }] },
      { title: 'Reward control', data: [{ label: 'Gross', value: 250000 }, { label: 'Net', value: 210000 }, { label: 'Deductions', value: 32000 }] },
    ],
    suggestedNextActions: [
      'Run attendance exceptions by department.',
      'Review payroll close blockers before approval.',
      'Send compliance acknowledgement reminders.',
    ],
  }),
  'POST /reporting/builder/smart-categories/run': () => ok({
    categoryCode: 'WORKFORCE_COMPOSITION',
    title: 'Workforce Composition',
    generatedAt: '2026-06-11T08:05:00.000Z',
    scopeLevel: 'TENANT',
    period: 'CURRENT_MONTH',
    summary: 'Workforce Composition analysis found 18 risk signals across headcount, attendance, and leave. Engineering has the strongest overlap between vacancies and attendance exceptions.',
    insights: REPORT_BUILDER_CATALOG.smartCategories[0].insights,
    drilldowns: REPORT_BUILDER_CATALOG.smartCategories[0].drilldowns,
    relatedReports: [
      { code: 'attendance-exceptions-monthly', title: 'Monthly Attendance Exceptions', dataSource: 'ATTENDANCE' },
      { code: 'leave-liability', title: 'Leave Balance Liability', dataSource: 'LEAVE' },
      { code: 'payroll-cost-summary', title: 'Payroll Cost Summary', dataSource: 'PAYROLL' },
    ],
    recommendedActions: [
      'Open the attendance exception report for Engineering.',
      'Review leave coverage for Sales before approving additional requests.',
      'Send manager follow-up for departments with combined capacity signals.',
    ],
    filterSummary: [
      { label: 'Scope', value: 'TENANT' },
      { label: 'Period', value: 'CURRENT_MONTH' },
      { label: 'Filters', value: 'All departments' },
    ],
    relationships: REPORT_BUILDER_CATALOG.businessRelationships.filter((relationship) => ['HEADCOUNT', 'ATTENDANCE', 'LEAVE', 'PAYROLL'].includes(relationship.from) || ['HEADCOUNT', 'ATTENDANCE', 'LEAVE', 'PAYROLL'].includes(relationship.to)),
  }),
  'POST /reporting/report-definitions/preview': () => ok({
    valid: true,
    dataSource: 'ATTENDANCE',
    scopeLevel: 'DEPARTMENT',
    columns: ['employeeNumber', 'employeeName', 'workDate', 'attendanceStatus'],
    metrics: ['lateMinutes', 'exceptions'],
    groupBy: ['department'],
    rowCountEstimate: 144,
    chartData: [
      { label: 'Engineering', value: 18 },
      { label: 'Sales', value: 11 },
      { label: 'Finance', value: 5 },
    ],
    sampleRows: [
      { employeeNumber: 'EMP-0042', employeeName: 'Emily Chen', workDate: '2026-06-10', attendanceStatus: 'Late', lateMinutes: 12, exceptions: 1 },
      { employeeNumber: 'EMP-0044', employeeName: 'Marcus Johnson', workDate: '2026-06-10', attendanceStatus: 'Present', lateMinutes: 0, exceptions: 0 },
      { employeeNumber: 'EMP-0047', employeeName: 'Olivia Thompson', workDate: '2026-06-10', attendanceStatus: 'Exception', lateMinutes: 0, exceptions: 1 },
    ],
    warnings: [],
  }),
  'POST /reporting/report-definitions/': () => ok({ status: 'PUBLISHED' }),
  'POST /reporting/report-definitions': () => ok({
    reportDefinitionId: '00000000-0000-0000-0000-00000000a599',
    reportName: 'Custom workforce report',
    reportType: 'CUSTOM',
    dataSource: 'ATTENDANCE',
    status: 'DRAFT',
    queryDefinition: {
      fields: ['employeeNumber', 'employeeName', 'workDate', 'attendanceStatus'],
      metrics: ['lateMinutes', 'exceptions'],
      groupBy: ['department'],
      scopeLevel: 'DEPARTMENT',
      visualization: 'bar',
    },
  }),
  'POST /reporting/report-executions': () => ok({
    reportExecutionId: '00000000-0000-0000-0000-00000000e501',
    status: 'QUEUED',
    queuedAt: '2026-06-11T08:00:00.000Z',
  }),
  'POST /reporting/report-schedules': () => ok({
    reportScheduleId: '00000000-0000-0000-0000-00000000f501',
    status: 'ACTIVE',
    nextRunAt: '2026-06-12T08:00:00.000Z',
  }),
  'POST /reporting/calculated-fields': () => ok({
    calculatedFieldId: '00000000-0000-0000-0000-00000000c599',
    fieldName: 'Custom metric',
    expression: 'grossPay - deductionAmount',
    dataType: 'currency',
    status: 'DRAFT',
  }),
  'GET /reporting/hr-dashboard': () => ok({
    generatedAt: '2026-06-10T09:00:00.000Z',
    totals: {
      reportGroups: 9,
      activeReportGroups: 8,
      totalActivity: 96,
      queueBacklog: 4,
      issues: 26,
    },
    reports: [
      {
        code: 'ATTENDANCE',
        title: 'Attendance Report',
        category: 'Workforce',
        services: ['TIME_ATTENDANCE'],
        serviceUsageLinks: ['TIME_ATTENDANCE'],
        analyticsOutputs: ['employeeDays', 'overtimeHours', 'exceptionSignals'],
        template: { module: 'attendance', columns: ['externalReference', 'employeeNumber', 'attendanceDate', 'policyCode'], exportArtifact: 'attendance-ledger.csv' },
        brain: { engine: 'attendance-finalization', nervousSystem: 'Time events and attendance ledgers feed reporting.' },
        activity: 18,
        commands: 8,
        events: 6,
        notifications: 2,
        workflowTransitions: 2,
        queueBacklog: 1,
        issues: 3,
        readiness: 'Attention',
        chartData: [{ label: 'Commands', value: 8 }, { label: 'Events', value: 6 }],
      },
      {
        code: 'HEADCOUNT_ORG',
        title: 'Headcount and Org Report',
        category: 'Organization',
        services: ['ORGANIZATION', 'HR_CORE'],
        serviceUsageLinks: ['ORGANIZATION', 'HR_CORE'],
        analyticsOutputs: ['positions', 'filledPositions', 'vacantPositions', 'headcountRequests'],
        template: { module: 'headcount-org', columns: ['positionCode', 'title', 'departmentCode', 'legalEntityCode'], exportArtifact: 'headcount-org.csv' },
        brain: { engine: 'position-headcount', nervousSystem: 'Position and headcount events feed org reporting.' },
        activity: 11,
        commands: 4,
        events: 4,
        notifications: 1,
        workflowTransitions: 2,
        queueBacklog: 0,
        issues: 7,
        readiness: 'Attention',
        chartData: [{ label: 'Commands', value: 4 }, { label: 'Events', value: 4 }],
      },
      {
        code: 'COMPLIANCE',
        title: 'Compliance Report',
        category: 'Governance',
        services: ['COMPLIANCE', 'POLICY_CENTER', 'COUNTRY_POLICY'],
        serviceUsageLinks: ['COMPLIANCE', 'POLICY_CENTER', 'COUNTRY_POLICY'],
        analyticsOutputs: ['acknowledgements', 'overdueAcknowledgements', 'statutoryReports'],
        template: { module: 'compliance', columns: ['policyCode', 'documentType', 'version', 'acknowledgementDueDate'], exportArtifact: 'compliance-evidence.csv' },
        brain: { engine: 'policy-acknowledgement-compliance', nervousSystem: 'Policy and statutory events feed compliance reporting.' },
        activity: 22,
        commands: 7,
        events: 8,
        notifications: 4,
        workflowTransitions: 3,
        queueBacklog: 2,
        issues: 3,
        readiness: 'Attention',
        chartData: [{ label: 'Commands', value: 7 }, { label: 'Events', value: 8 }],
      },
      {
        code: 'SERVICES',
        title: 'HR Services Report',
        category: 'Service Delivery',
        services: ['SERVICE_DELIVERY'],
        serviceUsageLinks: ['SERVICE_DELIVERY'],
        analyticsOutputs: ['cases', 'activeCatalogItems', 'slaBreaches', 'openTasks'],
        template: { module: 'services', columns: ['serviceCode', 'serviceName', 'serviceType', 'slaHours'], exportArtifact: 'hr-services.csv' },
        brain: { engine: 'hr-service-delivery', nervousSystem: 'Cases, tasks, catalog items, and SLA events feed service reporting.' },
        activity: 16,
        commands: 5,
        events: 5,
        notifications: 4,
        workflowTransitions: 2,
        queueBacklog: 1,
        issues: 5,
        readiness: 'Attention',
        chartData: [{ label: 'Commands', value: 5 }, { label: 'Notifications', value: 4 }],
      },
    ],
    activityByReport: [
      { label: 'Attendance Report', activity: 18, issues: 3 },
      { label: 'Compliance Report', activity: 22, issues: 3 },
      { label: 'HR Services Report', activity: 16, issues: 5 },
      { label: 'Headcount and Org Report', activity: 11, issues: 7 },
    ],
  }),
  'GET /reporting/hr-analytics': () => ok({
    generatedAt: '2026-06-10T09:00:00.000Z',
    totals: {
      activeModules: 8,
      riskSignals: 26,
      attendanceEmployeeDays: 20,
      leaveRequests: 6,
      payrollNetPay: 210000,
      performanceReviews: 10,
      benefitsEnrollments: 15,
      headcountPositions: 10,
      complianceAcknowledgements: 16,
      serviceCases: 12,
    },
    headlineMetrics: [
      { label: 'Analytics Modules', value: 8 },
      { label: 'Risk Signals', value: 26 },
      { label: 'Payroll Net Pay', value: 210000, unit: 'currency', currency: 'EGP' },
      { label: 'Service Cases', value: 12 },
    ],
    modules: [
      { code: 'ATTENDANCE', title: 'Attendance Exceptions', category: 'Workforce', primary: { label: 'Employee days', value: 20, unit: 'days' }, secondary: { label: 'Overtime hours', value: 2, unit: 'hours' }, risk: { label: 'Exception signals', value: 3 }, chart: { type: 'bar', data: [{ label: 'Present', value: 18 }, { label: 'Late', value: 2 }] } },
      { code: 'LEAVE', title: 'Leave Pipeline', category: 'Workforce', primary: { label: 'Requests', value: 6 }, secondary: { label: 'Requested days', value: 12, unit: 'days' }, risk: { label: 'Open requests', value: 2 }, chart: { type: 'bar', data: [{ label: 'Approved', value: 4 }, { label: 'Submitted', value: 2 }] } },
      { code: 'PAYROLL', title: 'Payroll Net Pay', category: 'Reward', primary: { label: 'Net pay', value: 210000, unit: 'currency', currency: 'EGP' }, secondary: { label: 'Workers paid', value: 25 }, risk: { label: 'Runs needing attention', value: 1 }, chart: { type: 'bar', data: [{ label: 'EGP', value: 210000 }] } },
      { code: 'PERFORMANCE', title: 'Performance Rating', category: 'Talent', primary: { label: 'Reviews', value: 10 }, secondary: { label: 'Average rating', value: 4.06, unit: 'rating' }, risk: { label: 'Open reviews', value: 2 }, chart: { type: 'bar', data: [{ label: '4-5', value: 7 }, { label: '3-4', value: 3 }] } },
      { code: 'BENEFITS', title: 'Benefits Coverage', category: 'Reward', primary: { label: 'Enrollments', value: 15 }, secondary: { label: 'Dependents covered', value: 24 }, risk: { label: 'Pending enrollments', value: 3 }, chart: { type: 'bar', data: [{ label: 'Employee Family', value: 12 }, { label: 'Employee Only', value: 3 }] } },
      { code: 'HEADCOUNT_ORG', title: 'Headcount and Org Coverage', category: 'Organization', primary: { label: 'Positions', value: 10 }, secondary: { label: 'Filled positions', value: 7 }, risk: { label: 'Vacancy and request signals', value: 7 }, chart: { type: 'bar', data: [{ label: 'Open', value: 10, secondaryValue: 4 }] } },
      { code: 'COMPLIANCE', title: 'Compliance Evidence', category: 'Governance', primary: { label: 'Acknowledgements', value: 16 }, secondary: { label: 'Statutory reports', value: 4 }, risk: { label: 'Overdue and draft signals', value: 3 }, chart: { type: 'bar', data: [{ label: 'Ack Pending', value: 6 }, { label: 'Report Draft', value: 1 }] } },
      { code: 'SERVICES', title: 'HR Services Demand', category: 'Service Delivery', primary: { label: 'Cases', value: 12 }, secondary: { label: 'Active catalog items', value: 6 }, risk: { label: 'SLA and task signals', value: 5 }, chart: { type: 'bar', data: [{ label: 'Open', value: 5, secondaryValue: 4 }, { label: 'Resolved', value: 7 }] } },
    ],
    riskSignals: [
      { label: 'Attendance Exceptions', value: 3 },
      { label: 'Headcount and Org Coverage', value: 7 },
      { label: 'Compliance Evidence', value: 3 },
      { label: 'HR Services Demand', value: 5 },
    ],
  }),
  'GET /reporting/service-usage/summary': () => ok({ activeModules: 8, totalApiCalls: 42800, topModules: ['payroll', 'attendance', 'leave'] }),

  // ── Notifications ─────────────────────────────────────────────────────────
  'GET /notifications/me': () => ok([]),
  'GET /notifications/hr-operations': () => ok([]),

  // ── Health ────────────────────────────────────────────────────────────────
  'GET /health': () => ({ status: 'ok' }),
  'GET /health/live': () => ({ status: 'ok' }),
  'GET /health/ready': () => ({ status: 'ok' }),
};

export { DEMO_WORKER_ME, DEMO_PROFILE_DATA };
