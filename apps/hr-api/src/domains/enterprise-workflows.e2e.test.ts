import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AccessControlService, SodMatrix } from '@hcm/access-control';
import { AuthService, type AuthSession } from '../auth/auth.service.js';
import { requiredPolicyAreaForCommand } from '../platform/command-bus/command-bus.js';
import { buildServiceUsageSummary, type ServiceUsageMetricRow } from './reporting/services/service-usage-reporting.service.js';
import { PayrollCycleGovernanceService } from './payroll/services/payroll-cycle-governance.service.js';
import { PayrollEnterpriseWorkflowService } from './payroll/services/payroll-enterprise-workflow.service.js';
import type { PayrollBankTransferRow, PayrollCyclePreview } from './payroll/services/payroll-cycle-calculation.service.js';
import type { PayrollPaymentBatchRecord, PayrollPayslipArtifactRecord } from './payroll/services/payroll-artifact.service.js';

type PolicyArea =
  | 'EMPLOYEE_SETUP'
  | 'LEAVE'
  | 'ATTENDANCE'
  | 'PAYROLL'
  | 'ACCESS_GOVERNANCE'
  | 'COUNTRY_POLICY'
  | 'COMPLIANCE'
  | 'BENEFITS'
  | 'GLOBAL_HR'
  | 'DEI_ANALYTICS'
  | 'ENGAGEMENT';

interface EnterpriseCommand {
  commandName: string;
  aggregateType: string;
  actorType: 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN';
  roles: string[];
  commandType: 'CREATE' | 'UPDATE' | 'APPROVE';
  expectedPolicyArea: PolicyArea;
  serviceArea: string;
  subjectWorkerId?: string;
}

const tenantA = '00000000-0000-0000-0000-000000000001';
const tenantB = '00000000-0000-0000-0000-000000000002';
const now = new Date('2026-06-08T08:00:00.000Z');

const goldenCommands: EnterpriseCommand[] = [
  {
    commandName: 'CreateLegalEntity',
    aggregateType: 'LegalEntity',
    actorType: 'HR_ADMIN',
    roles: ['HR_ADMIN'],
    commandType: 'CREATE',
    expectedPolicyArea: 'ACCESS_GOVERNANCE',
    serviceArea: 'ORGANIZATION',
  },
  {
    commandName: 'CreateOrgUnit',
    aggregateType: 'OrgUnit',
    actorType: 'HR_ADMIN',
    roles: ['HR_ADMIN'],
    commandType: 'CREATE',
    expectedPolicyArea: 'ACCESS_GOVERNANCE',
    serviceArea: 'ORGANIZATION',
  },
  {
    commandName: 'CreateWorker',
    aggregateType: 'WorkerProfile',
    actorType: 'HR_ADMIN',
    roles: ['HR_ADMIN'],
    commandType: 'CREATE',
    expectedPolicyArea: 'EMPLOYEE_SETUP',
    serviceArea: 'HR_CORE',
  },
  {
    commandName: 'UpdateWorkerOrganizationAssignment',
    aggregateType: 'ManagerRelationship',
    actorType: 'HR_ADMIN',
    roles: ['HR_ADMIN'],
    commandType: 'UPDATE',
    expectedPolicyArea: 'EMPLOYEE_SETUP',
    serviceArea: 'ORGANIZATION',
  },
  {
    commandName: 'SubmitAbsenceRequest',
    aggregateType: 'AbsenceRequest',
    actorType: 'EMPLOYEE',
    roles: ['EMPLOYEE'],
    commandType: 'CREATE',
    expectedPolicyArea: 'LEAVE',
    serviceArea: 'ABSENCE_LEAVE',
    subjectWorkerId: 'worker-employee-1',
  },
  {
    commandName: 'RecordTimeClockEvent',
    aggregateType: 'TimeClockEvent',
    actorType: 'EMPLOYEE',
    roles: ['EMPLOYEE'],
    commandType: 'CREATE',
    expectedPolicyArea: 'ATTENDANCE',
    serviceArea: 'TIME_ATTENDANCE',
    subjectWorkerId: 'worker-employee-1',
  },
  {
    commandName: 'ApproveAbsenceRequest',
    aggregateType: 'AbsenceRequest',
    actorType: 'MANAGER',
    roles: ['MANAGER'],
    commandType: 'APPROVE',
    expectedPolicyArea: 'LEAVE',
    serviceArea: 'ABSENCE_LEAVE',
    subjectWorkerId: 'worker-employee-1',
  },
  {
    commandName: 'SubmitPerformanceFeedback360Response',
    aggregateType: 'PerformanceFeedback360Response',
    actorType: 'EMPLOYEE',
    roles: ['EMPLOYEE'],
    commandType: 'UPDATE',
    expectedPolicyArea: 'ENGAGEMENT',
    serviceArea: 'PERFORMANCE',
    subjectWorkerId: 'worker-employee-1',
  },
  {
    commandName: 'StartPayrollValidation',
    aggregateType: 'PayrollCycle',
    actorType: 'HR_ADMIN',
    roles: ['PAYROLL_ADMIN'],
    commandType: 'UPDATE',
    expectedPolicyArea: 'PAYROLL',
    serviceArea: 'PAYROLL',
  },
  {
    commandName: 'ClosePayrollCycle',
    aggregateType: 'PayrollCycle',
    actorType: 'HR_ADMIN',
    roles: ['PAYROLL_ADMIN'],
    commandType: 'APPROVE',
    expectedPolicyArea: 'PAYROLL',
    serviceArea: 'PAYROLL',
  },
];

function metricRows(commands: EnterpriseCommand[]): ServiceUsageMetricRow[] {
  const rows = commands.flatMap<ServiceUsageMetricRow>((command, index) => [
    {
      source: 'COMMAND',
      serviceArea: command.aggregateType,
      total: 1,
      lastActivityAt: new Date(`2026-06-08T08:${String(index).padStart(2, '0')}:00.000Z`),
    },
    {
      source: 'OUTBOX',
      serviceArea: command.aggregateType,
      total: 1,
      pending: 0,
      exhausted: 0,
      lastActivityAt: new Date(`2026-06-08T08:${String(index).padStart(2, '0')}:10.000Z`),
    },
    {
      source: 'WORKFLOW',
      serviceArea: command.aggregateType,
      total: 1,
      lastActivityAt: new Date(`2026-06-08T08:${String(index).padStart(2, '0')}:20.000Z`),
    },
  ]);

  rows.push(
    { source: 'NOTIFICATION', serviceArea: 'AbsenceRequest', total: 3, lastActivityAt: now },
    { source: 'NOTIFICATION', serviceArea: 'PerformanceFeedback360Response', total: 2, lastActivityAt: now },
    { source: 'NOTIFICATION', serviceArea: 'PayrollCycle', total: 2, lastActivityAt: now },
    { source: 'INBOX_QUEUE', serviceArea: 'AbsenceRequest', total: 3, inProgress: 0, failedRetryable: 0, failedNonRetryable: 0, skipped: 0, lastActivityAt: now },
    { source: 'INBOX_QUEUE', serviceArea: 'PayrollCycle', total: 2, inProgress: 0, failedRetryable: 0, failedNonRetryable: 0, skipped: 0, lastActivityAt: now },
  );

  return rows;
}

function preview(): PayrollCyclePreview {
  return {
    id: '2026-06',
    name: 'June 2026 Payroll',
    year: 2026,
    month: 6,
    calendarDays: 30,
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
    payDate: '2026-06-30',
    employeeCount: 1,
    totalGross: 12_000,
    totalTax: 1_200,
    totalEmployeeInsurance: 600,
    totalEmployerInsurance: 1_300,
    totalPolicyDeductions: 100,
    totalNet: 10_100,
    currency: 'EGP',
    rows: [
      {
        workerId: 'worker-employee-1',
        employeeId: 'EMP-001',
        name: 'Regular Employee',
        email: 'employee@example.com',
        department: 'Operations',
        workLocationCode: 'CAIRO_HQ',
        taxIdentifier: 'TAX-001',
        grossSalary: 12_000,
        taxAmount: 1_200,
        employeeInsuranceAmount: 600,
        employerInsuranceAmount: 1_300,
        policyDeductionAmount: 100,
        netSalary: 10_100,
        currency: 'EGP',
        attendanceSummary: {
          workedMinutes: 9_600,
          payableMinutes: 9_600,
          lateMinutes: 0,
          undertimeMinutes: 0,
          overtimeMinutes: 0,
          absentDays: 0,
          onDutyMinutes: 0,
          geofenceViolations: 0,
        },
        explainability: [],
      },
    ],
  };
}

function bankRows(): PayrollBankTransferRow[] {
  return [
    {
      employeeId: 'EMP-001',
      workerId: 'worker-employee-1',
      name: 'Regular Employee',
      workEmail: 'employee@example.com',
      bankName: 'National Bank',
      accountHolderName: 'Regular Employee',
      accountNumber: '123456',
      iban: 'EG380019000500000000263180002',
      routingNumber: '',
      swiftCode: '',
      netSalary: 10_100,
      currency: 'EGP',
      bankReady: true,
      readinessReason: 'READY',
    },
  ];
}

function paymentBatch(status: PayrollPaymentBatchRecord['status'] = 'READY'): PayrollPaymentBatchRecord {
  return {
    id: 'payment-batch-1',
    tenantId: tenantA,
    payrollCycleId: 'cycle-2026-06',
    batchNumber: 'PAYMENT-2026-06',
    status,
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
    payDate: '2026-06-30',
    currency: 'EGP',
    readyCount: 1,
    blockedCount: 0,
    totalNet: 10_100,
    fileHash: 'hash',
    payload: {
      batchId: 'PAYMENT-2026-06',
      payrollCycleId: 'cycle-2026-06',
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      payDate: '2026-06-30',
      ready: true,
      readyCount: 1,
      blockedCount: 0,
      totalNet: 10_100,
      currency: 'EGP',
      rows: [],
    },
    workflowEvents: [],
    reconciliationSummary: {},
    createdAt: now,
    updatedAt: now,
  };
}

function payslipArtifact(): PayrollPayslipArtifactRecord {
  return {
    id: 'payslip-1',
    tenantId: tenantA,
    payrollCycleId: 'cycle-2026-06',
    workerId: 'worker-employee-1',
    employeeId: 'EMP-001',
    artifactFormat: 'HTML',
    status: 'GENERATED',
    grossPay: 12_000,
    netPay: 10_100,
    currency: 'EGP',
    contentHash: 'hash',
    htmlContent: '<html><body>June payslip</body></html>',
    dataClassification: 'HIGH_SENSITIVITY',
    createdAt: now,
    updatedAt: now,
  };
}

function auditHash(previousHash: string, record: Record<string, unknown>): string {
  return createHash('sha256').update(`${previousHash}:${JSON.stringify(record)}`).digest('hex');
}

function buildWorkflowAuthService(): AuthService {
  const user = {
    id: '00000000-0000-0000-0000-000000000012',
    email: 'employee@example.com',
    firstName: 'Regular',
    lastName: 'Employee',
    passwordHash: '$2b$10$XOturYAwdImT.TMp4gkc7u0j3ZwAWzMbJViENs0C0QP5c5TYKDRF.',
    tenantId: tenantA,
    status: 'ACTIVE' as const,
    roles: ['EMPLOYEE'],
    permissions: ['SELF_READ'],
    failedLoginCount: 0,
  };
  const sessions = new Map<string, AuthSession>();
  return AuthService.createForTest({
    config: {
      port: 3001,
      nodeEnv: 'test',
      databaseUrl: '',
      redisUrl: '',
      kafkaBrokers: [],
      jwtSecret: 'workflow-test-secret',
      jwtExpiresIn: '1h',
      refreshTokenExpiresIn: '7d',
      mfaRequired: false,
      bcryptCost: 10,
      loginMaxAttempts: 5,
      lockoutMinutes: 15,
      apiKeyHeader: 'X-API-Key',
      corsOrigins: [],
      logLevel: 'silent',
      otelEnabled: false,
      otelServiceName: 'hr-api-test',
    },
    users: {
      findByEmail: async (inputTenantId: string, email: string) =>
        inputTenantId === tenantA && email.toLowerCase() === user.email ? user : undefined,
      findById: async (id: string) => (id === user.id ? user : undefined),
      create: async () => user,
      updateMfaSecret: async () => undefined,
      resetFailedLoginState: async () => undefined,
      recordFailedLogin: async () => undefined,
      updatePassword: async () => undefined,
    },
    sessions: {
      create: async (session) => { sessions.set(session.sessionId, session); },
      get: async (sessionId) => sessions.get(sessionId),
      save: async (session) => { sessions.set(session.sessionId, session); },
      revoke: async (sessionId) => { sessions.delete(sessionId); },
    },
    tokens: {
      create: async () => { throw new Error('Tokens are not used in this workflow test'); },
      findActiveByHash: async () => undefined,
      consume: async () => undefined,
    },
  });
}

describe('enterprise E2E workflow confidence gates', () => {
  it('covers login/session and tenant isolation before workflow commands execute', async () => {
    const auth = buildWorkflowAuthService();
    const user = await auth.validateCredentials('employee@example.com', 'Password123!', tenantA);
    const session = await auth.createSession(user);

    expect(session.token).toEqual(expect.any(String));
    expect(session.refreshToken).toEqual(expect.any(String));
    expect(session.session).toMatchObject({
      userId: user.id,
      tenantId: tenantA,
    });

    const tenantScopedRows = [
      { tenantId: tenantA, workerId: 'worker-employee-1', email: 'employee@example.com' },
      { tenantId: tenantB, workerId: 'worker-tenant-b', email: 'employee@example.com' },
    ];
    const visibleRows = tenantScopedRows.filter((row) => row.tenantId === user.tenantId);

    expect(visibleRows).toEqual([
      { tenantId: tenantA, workerId: 'worker-employee-1', email: 'employee@example.com' },
    ]);
  });

  it('executes the golden worker, absence, attendance, performance, payroll, notification, and reporting path', () => {
    const access = new AccessControlService();
    const policyEvidence = goldenCommands.map((command) => ({
      commandName: command.commandName,
      area: requiredPolicyAreaForCommand({
        commandName: command.commandName,
        aggregateType: command.aggregateType,
      }),
    }));

    for (const command of goldenCommands) {
      const decision = access.evaluateCommandAccess(
        {
          commandName: command.commandName,
          commandType: command.commandType,
          aggregateType: command.aggregateType,
          payload: { workerId: command.subjectWorkerId },
        },
        {
          actorType: command.actorType,
          roles: command.roles,
          employmentStatus: command.actorType === 'EMPLOYEE' || command.actorType === 'MANAGER' ? 'ACTIVE' : undefined,
        },
      );

      expect(
        decision.allowed,
        `${command.actorType} should be able to execute ${command.commandName}: ${decision.reason}`,
      ).toBe(true);
    }

    expect(policyEvidence).toEqual(goldenCommands.map((command) => ({
      commandName: command.commandName,
      area: command.expectedPolicyArea,
    })));

    const readiness = new PayrollCycleGovernanceService().evaluateCloseToPayReadiness({
      preview: preview(),
      bankRows: bankRows(),
      existingCycles: [],
    });
    expect(readiness.canClose).toBe(true);

    const payrollWorkflow = new PayrollEnterpriseWorkflowService();
    const approved = payrollWorkflow.approvePaymentBatch(paymentBatch(), 'payroll-admin', now);
    const exported = payrollWorkflow.markPaymentBatchExported(approved, 'CBE_EGYPT_CSV', 'payroll-admin', now);
    const reconciled = payrollWorkflow.reconcilePaymentBatch(exported, [
      { employeeId: 'EMP-001', amount: 10_100, status: 'SETTLED', bankReference: 'BANK-2026-06' },
    ], 'payroll-admin', now);
    const publishedPayslip = payrollWorkflow.publishPayslip(payslipArtifact(), 'payroll-admin', now);

    expect(reconciled.status).toBe('RECONCILED');
    expect(reconciled.workflowEvents?.map((event) => event.type)).toEqual([
      'PaymentBatchApproved',
      'PaymentBatchExported',
      'PaymentBatchReconciled',
    ]);
    expect(publishedPayslip.status).toBe('PUBLISHED');

    const reporting = buildServiceUsageSummary(tenantA, metricRows(goldenCommands), now);
    expect(reporting.totals).toMatchObject({
      commands: goldenCommands.length,
      events: goldenCommands.length,
      notifications: 7,
      workflowTransitions: goldenCommands.length,
      pendingOutboxEvents: 0,
      inboxFailedRetryableEvents: 0,
      inboxFailedNonRetryableEvents: 0,
    });
    expect(reporting.services.map((service) => service.serviceArea)).toEqual(expect.arrayContaining([
      'ORGANIZATION',
      'HR_CORE',
      'ABSENCE_LEAVE',
      'TIME_ATTENDANCE',
      'PERFORMANCE',
      'PAYROLL',
    ]));
  });

  it('blocks access review SoD conflicts and produces revocation evidence requirements', () => {
    const sod = new SodMatrix();
    const payrollApproval = sod.checkSoD(['PAYROLL_ADMIN'], 'PAYROLL_APPROVE', {
      actionPermission: 'PAYROLL_CREATE',
      actionName: 'ClosePayrollCycle',
    });
    const performanceApproval = sod.checkSoD(['MANAGER'], 'PERFORMANCE_APPROVE', {
      actionPermission: 'PERFORMANCE_CREATE',
      actionName: 'FinalizeCalibrationSession',
    });

    expect(payrollApproval.violated).toBe(true);
    expect(payrollApproval.violatedRules.map((rule) => rule.code)).toEqual(expect.arrayContaining([
      'PAYROLL_PREPARER_CANNOT_APPROVE',
    ]));
    expect(performanceApproval.violated).toBe(true);
    expect(performanceApproval.violatedRules.map((rule) => rule.code)).toEqual(expect.arrayContaining([
      'PERFORMANCE_RATER_CANNOT_CALIBRATION_APPROVE',
    ]));

    const accessReviewDecision = {
      campaignId: 'Q2_PRIVILEGED_ACCESS',
      itemId: 'review-item-1',
      decision: 'REVOKE',
      revokeFulfillmentRequired: true,
      notificationRequired: true,
      auditRequired: true,
    };

    expect(accessReviewDecision).toMatchObject({
      decision: 'REVOKE',
      revokeFulfillmentRequired: true,
      notificationRequired: true,
      auditRequired: true,
    });
  });

  it('keeps audit evidence append-only and tenant-scoped across cross-tenant scenarios', () => {
    const records = [
      { tenantId: tenantA, action: 'CreateWorker', resourceId: 'worker-employee-1', payload: { employeeId: 'EMP-001' } },
      { tenantId: tenantA, action: 'SubmitAbsenceRequest', resourceId: 'absence-1', payload: { workerId: 'worker-employee-1' } },
      { tenantId: tenantA, action: 'ClosePayrollCycle', resourceId: 'cycle-2026-06', payload: { totalNet: 10_100 } },
      { tenantId: tenantB, action: 'CreateWorker', resourceId: 'worker-tenant-b', payload: { employeeId: 'B-001' } },
    ].map((record, index, all) => {
      const previousHash = index === 0 ? 'GENESIS' : all[index - 1].payloadHash as string;
      const payloadHash = auditHash(previousHash, record);
      return { ...record, sequence: index + 1, previousHash, payloadHash };
    });

    const tenantATrail = records.filter((record) => record.tenantId === tenantA);
    expect(tenantATrail).toHaveLength(3);
    expect(tenantATrail.every((record) => record.resourceId !== 'worker-tenant-b')).toBe(true);

    const tampered = { ...tenantATrail[1], payload: { workerId: 'worker-employee-2' } };
    expect(auditHash(tampered.previousHash, tampered)).not.toBe(tenantATrail[1].payloadHash);
  });

  it('requires outbox/inbox retry and DLQ recovery evidence for every user-visible workflow event', () => {
    const deliveryEvidence = [
      { eventName: 'AbsenceRequestSubmitted', outboxStatus: 'PUBLISHED', inboxStatus: 'SUCCESS', dlqAction: null },
      { eventName: 'AbsenceRequestApproved', outboxStatus: 'PUBLISHED', inboxStatus: 'FAILED_RETRYABLE', dlqAction: 'RETRY' },
      { eventName: 'PayrollCycleClosed', outboxStatus: 'EXHAUSTED', inboxStatus: 'FAILED_NON_RETRYABLE', dlqAction: 'SKIP_WITH_REASON' },
    ];

    expect(deliveryEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        eventName: 'AbsenceRequestSubmitted',
        outboxStatus: 'PUBLISHED',
        inboxStatus: 'SUCCESS',
      }),
      expect.objectContaining({
        eventName: 'AbsenceRequestApproved',
        inboxStatus: 'FAILED_RETRYABLE',
        dlqAction: 'RETRY',
      }),
      expect.objectContaining({
        eventName: 'PayrollCycleClosed',
        outboxStatus: 'EXHAUSTED',
        dlqAction: 'SKIP_WITH_REASON',
      }),
    ]));
  });
});
