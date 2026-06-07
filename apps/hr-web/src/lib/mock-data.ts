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
  'GET /employee/benefits': () => ok([
    { id: 'ben-001', workerId: 'wkr-001', benefitType: 'HEALTH', planName: 'Premium Health Plan', coverageLevel: 'EMPLOYEE_PLUS_SPOUSE', effectiveDate: '2021-03-15', status: 'ACTIVE' },
    { id: 'ben-002', workerId: 'wkr-001', benefitType: 'DENTAL', planName: 'Dental Plus', coverageLevel: 'EMPLOYEE', effectiveDate: '2021-03-15', status: 'ACTIVE' },
    { id: 'ben-003', workerId: 'wkr-001', benefitType: 'VISION', planName: 'Vision Care', coverageLevel: 'EMPLOYEE', effectiveDate: '2021-03-15', status: 'ACTIVE' },
    { id: 'ben-004', workerId: 'wkr-001', benefitType: '401K', planName: '401(k) Retirement Plan', coverageLevel: 'EMPLOYEE', effectiveDate: '2021-09-15', status: 'ACTIVE' },
  ]),
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
  'GET /time/attendance/today': () => ok({
    workerId: 'wkr-001',
    workDate: new Date().toISOString().slice(0, 10),
    status: 'YET_TO_CHECK_IN',
    canCheckIn: true,
    canCheckOut: false,
    elapsedMinutes: 0,
    totalWorkedMinutes: 0,
    locationStatus: 'NO_GEOLOCATION',
    events: [],
  }),
  'GET /time/attendance/summary': () => ok({
    workerId: 'wkr-001',
    summary: { payableMinutes: 9480, lateMinutes: 15, undertimeMinutes: 0, overtimeMinutes: 120, geofenceViolations: 0 },
  }),
  'GET /time/attendance/daily-ledger': () => ok({ entries: [], totals: { payableMinutes: 0, lateMinutes: 0, overtimeMinutes: 0 } }),
  'GET /time/attendance/correction-requests': () => ok([]),
  'GET /time/attendance/reminders': () => ok({ reminders: [], missedCheckouts: [] }),
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
  'GET /manager/team': () => ok({ members: WORKERS.filter((w) => w.managerId === 'wkr-mgr-001'), teamSize: 2, avgTenureMonths: 30 }),
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
  'POST /hr-service-delivery/cases': () => ok({ id: 'case-new' }),

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
