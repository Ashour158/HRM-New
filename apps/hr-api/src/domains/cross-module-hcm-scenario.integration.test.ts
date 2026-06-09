import { describe, expect, it } from 'vitest';
import { buildServiceUsageSummary, type ServiceUsageMetricRow } from './reporting/services/service-usage-reporting.service.js';
import { requiredPolicyAreaForCommand } from '../platform/command-bus/command-bus.js';

describe('cross-module HCM scenario contract', () => {
  it('keeps setup, employee action, approval, notification, payroll, and reporting in one evidence chain', () => {
    const scenarioSteps = [
      { step: 'create legal entity', commandName: 'CreateLegalEntity', aggregateType: 'LegalEntity', serviceArea: 'ORGANIZATION' },
      { step: 'create org unit', commandName: 'CreateOrgUnit', aggregateType: 'OrgUnit', serviceArea: 'ORGANIZATION' },
      { step: 'create department', commandName: 'CreateOrgUnit', aggregateType: 'OrgUnit', serviceArea: 'ORGANIZATION' },
      { step: 'create employee', commandName: 'CreateWorker', aggregateType: 'WorkerProfile', serviceArea: 'HR_CORE' },
      { step: 'assign manager', commandName: 'UpdateWorkerOrganizationAssignment', aggregateType: 'ManagerRelationship', serviceArea: 'ORGANIZATION' },
      { step: 'apply policy', commandName: 'ApplyPolicyRevision', aggregateType: 'PolicyRevision', serviceArea: 'POLICY_CENTER' },
      { step: 'employee submits leave', commandName: 'SubmitAbsenceRequest', aggregateType: 'AbsenceRequest', serviceArea: 'ABSENCE_LEAVE' },
      { step: 'employee check-in', commandName: 'RecordTimeClockEvent', aggregateType: 'TimeClockEvent', serviceArea: 'TIME_ATTENDANCE' },
      { step: 'manager approves leave', commandName: 'ApproveAbsenceRequest', aggregateType: 'AbsenceRequest', serviceArea: 'ABSENCE_LEAVE' },
      { step: 'payroll reflects approved input', commandName: 'CreatePayrollInput', aggregateType: 'PayrollInput', serviceArea: 'PAYROLL' },
      { step: 'reporting reflects usage', commandName: 'GenerateServiceUsageSummary', aggregateType: 'ServiceUsageSummary', serviceArea: 'REPORTING' },
    ];
    const tenantId = '00000000-0000-0000-0000-000000000001';
    const rows: ServiceUsageMetricRow[] = scenarioSteps.flatMap((step, index) => [
      { source: 'COMMAND' as const, serviceArea: step.aggregateType, total: 1, lastActivityAt: new Date(`2026-06-03T08:${String(index).padStart(2, '0')}:00.000Z`) },
      { source: 'OUTBOX' as const, serviceArea: step.aggregateType, total: 1, pending: 0, exhausted: 0, lastActivityAt: new Date(`2026-06-03T08:${String(index).padStart(2, '0')}:10.000Z`) },
      { source: 'WORKFLOW' as const, serviceArea: step.aggregateType, total: 1, lastActivityAt: new Date(`2026-06-03T08:${String(index).padStart(2, '0')}:20.000Z`) },
    ]);
    rows.push(
      { source: 'NOTIFICATION', serviceArea: 'AbsenceRequest', total: 2, lastActivityAt: new Date('2026-06-03T08:12:00.000Z') },
      { source: 'NOTIFICATION', serviceArea: 'TimeClockEvent', total: 1, lastActivityAt: new Date('2026-06-03T08:13:00.000Z') },
      { source: 'INBOX_QUEUE', serviceArea: 'PayrollInput', total: 1, inProgress: 0, failedRetryable: 0, failedNonRetryable: 0, skipped: 0, lastActivityAt: new Date('2026-06-03T08:14:00.000Z') },
    );

    const summary = buildServiceUsageSummary(tenantId, rows, new Date('2026-06-03T09:00:00.000Z'));
    const serviceNames = summary.services.map((service) => service.serviceArea);
    const policyPrerequisites = scenarioSteps.map((step) => ({
      commandName: step.commandName,
      area: requiredPolicyAreaForCommand({
        commandName: step.commandName,
        aggregateType: step.aggregateType,
      }),
    }));

    expect(scenarioSteps.map((step) => step.commandName)).toEqual([
      'CreateLegalEntity',
      'CreateOrgUnit',
      'CreateOrgUnit',
      'CreateWorker',
      'UpdateWorkerOrganizationAssignment',
      'ApplyPolicyRevision',
      'SubmitAbsenceRequest',
      'RecordTimeClockEvent',
      'ApproveAbsenceRequest',
      'CreatePayrollInput',
      'GenerateServiceUsageSummary',
    ]);
    expect(policyPrerequisites).toEqual([
      { commandName: 'CreateLegalEntity', area: 'ACCESS_GOVERNANCE' },
      { commandName: 'CreateOrgUnit', area: 'ACCESS_GOVERNANCE' },
      { commandName: 'CreateOrgUnit', area: 'ACCESS_GOVERNANCE' },
      { commandName: 'CreateWorker', area: 'EMPLOYEE_SETUP' },
      { commandName: 'UpdateWorkerOrganizationAssignment', area: 'EMPLOYEE_SETUP' },
      { commandName: 'ApplyPolicyRevision', area: 'ACCESS_GOVERNANCE' },
      { commandName: 'SubmitAbsenceRequest', area: 'LEAVE' },
      { commandName: 'RecordTimeClockEvent', area: 'ATTENDANCE' },
      { commandName: 'ApproveAbsenceRequest', area: 'LEAVE' },
      { commandName: 'CreatePayrollInput', area: 'PAYROLL' },
      { commandName: 'GenerateServiceUsageSummary', area: 'ACCESS_GOVERNANCE' },
    ]);
    expect(serviceNames).toEqual(expect.arrayContaining([
      'ORGANIZATION',
      'HR_CORE',
      'POLICY_CENTER',
      'ABSENCE_LEAVE',
      'TIME_ATTENDANCE',
      'PAYROLL',
      'REPORTING',
    ]));
    expect(summary.totals).toMatchObject({
      commands: scenarioSteps.length,
      events: scenarioSteps.length,
      notifications: 3,
      workflowTransitions: scenarioSteps.length,
      pendingOutboxEvents: 0,
      inboxFailedRetryableEvents: 0,
      inboxFailedNonRetryableEvents: 0,
    });
    expect(summary.services.find((service) => service.serviceArea === 'ABSENCE_LEAVE')).toMatchObject({
      commands: 2,
      notifications: 2,
    });
    expect(summary.services.find((service) => service.serviceArea === 'PAYROLL')).toMatchObject({
      commands: 1,
      events: 1,
      workflowTransitions: 1,
    });
  });
});
