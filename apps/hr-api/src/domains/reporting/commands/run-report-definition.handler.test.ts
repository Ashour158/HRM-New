import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import { ReportDefinition } from '../aggregates/report-definition.aggregate.js';
import { RunReportDefinitionHandler } from './run-report-definition.handler.js';
import type { ReportExecution } from '../aggregates/report-execution.aggregate.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const actorId = new Uuid('00000000-0000-0000-0000-000000000101');
const reportDefinitionId = new Uuid('00000000-0000-0000-0000-00000000d501');
const commandId = new Uuid('00000000-0000-0000-0000-00000000c001');
const correlationId = new Uuid('00000000-0000-0000-0000-00000000c002');

function command(payload: Record<string, unknown>) {
  return {
    commandId,
    commandName: 'RunReportDefinition',
    commandSchemaVersion: 1,
    tenantId,
    actor: {
      actorType: 'USER',
      actorId,
      roles: ['REPORTING_ADMIN'],
      permissions: [],
      mfaAuthenticated: true,
      email: 'reporting.admin@example.com',
    },
    aggregateType: 'ReportDefinition',
    aggregateId: reportDefinitionId,
    correlationId,
    idempotencyKey: 'run-report-definition-test',
    reason: 'Run saved report',
    payload,
    metadata: { clientType: 'HR_ADMIN' },
  } as never;
}

describe('RunReportDefinitionHandler', () => {
  it('runs a saved report through semantic execution and persists the completed result payload', async () => {
    const definition = new ReportDefinition({
      id: reportDefinitionId,
      tenantId,
      reportName: 'Attendance by department',
      reportType: 'CUSTOM',
      dataSource: 'ATTENDANCE',
      queryDefinition: {
        fields: ['employeeNumber'],
        metrics: ['lateMinutes'],
        groupBy: ['department'],
        scopeLevel: 'TENANT',
        filters: [{ code: 'period', value: 'CURRENT_MONTH' }],
      },
      status: 'PUBLISHED',
    });
    const savedStates: string[] = [];
    let completedExecution: ReportExecution | undefined;
    const executionRepo = {
      save: vi.fn(async (execution: ReportExecution) => {
        savedStates.push(execution.status);
        if (execution.status === 'COMPLETED') completedExecution = execution;
      }),
    };
    const handler = new RunReportDefinitionHandler(
      { findByIdForTenant: vi.fn().mockResolvedValue(definition) } as never,
      executionRepo as never,
      {
        run: vi.fn().mockResolvedValue({
          dataSource: 'ATTENDANCE',
          rowCount: 1,
          drillThroughCount: 2,
          rows: [{ department: 'ENGINEERING', lateMinutes: 18 }],
          drillThroughRows: [
            { employeeNumber: 'EMP-1', department: 'ENGINEERING', lateMinutes: 18 },
            { employeeNumber: 'EMP-2', department: 'ENGINEERING', lateMinutes: 0 },
          ],
          columns: ['department', 'lateMinutes'],
          chartData: [{ label: 'ENGINEERING', value: 18 }],
          warnings: [],
        }),
      } as never,
      { getAllowedActionsFromState: vi.fn().mockReturnValue([]) } as never,
      { publishFromAggregate: vi.fn(async (execution: ReportExecution) => execution.clearDomainEvents()) } as never,
    );

    const result = await handler.handle(command({
      reportExecutionId: '00000000-0000-0000-0000-00000000e501',
      reportDefinitionId: reportDefinitionId.value,
      parameters: { period: 'LAST_90_DAYS' },
      limit: 50,
    }));

    expect(result).toMatchObject({
      success: true,
      data: {
        reportExecutionId: '00000000-0000-0000-0000-00000000e501',
        status: 'COMPLETED',
        rowCount: 2,
      },
      eventsEmitted: expect.arrayContaining(['ReportExecutionCompleted']),
    });
    expect(savedStates).toEqual(['PENDING', 'QUEUED', 'RUNNING', 'COMPLETED']);
    expect(completedExecution?.resultPayload).toEqual(expect.objectContaining({
      dataSource: 'ATTENDANCE',
      drillThroughCount: 2,
      rows: [{ department: 'ENGINEERING', lateMinutes: 18 }],
    }));
  });
});
