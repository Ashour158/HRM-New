import { describe, expect, it } from 'vitest';
import { buildServiceUsageSummary, type ServiceUsageMetricRow } from './service-usage-reporting.service.js';

describe('service usage reporting summary', () => {
  it('combines command, outbox, notification, and workflow usage into service rows', () => {
    const tenantId = '00000000-0000-0000-0000-000000000001';
    const rows: ServiceUsageMetricRow[] = [
      { source: 'COMMAND', serviceArea: 'PayrollInput', total: 4, lastActivityAt: new Date('2026-06-03T08:00:00.000Z') },
      { source: 'OUTBOX', serviceArea: 'PayrollInput', total: 3, pending: 1, lastActivityAt: new Date('2026-06-03T08:05:00.000Z') },
      { source: 'NOTIFICATION', serviceArea: 'PayrollInput', total: 2, lastActivityAt: new Date('2026-06-03T08:06:00.000Z') },
      { source: 'WORKFLOW', serviceArea: 'PayrollInput', total: 5, lastActivityAt: new Date('2026-06-03T08:07:00.000Z') },
      { source: 'COMMAND', serviceArea: 'AbsenceRequest', total: 2, failed: 1, lastActivityAt: new Date('2026-06-03T07:00:00.000Z') },
    ];

    const summary = buildServiceUsageSummary(tenantId, rows, new Date('2026-06-03T09:00:00.000Z'));

    expect(summary).toEqual({
      tenantId,
      generatedAt: '2026-06-03T09:00:00.000Z',
      totals: {
        commands: 6,
        failedCommands: 1,
        events: 3,
        pendingOutboxEvents: 1,
        notifications: 2,
        workflowTransitions: 5,
      },
      services: [
        {
          serviceArea: 'PAYROLL',
          commands: 4,
          failedCommands: 0,
          events: 3,
          pendingOutboxEvents: 1,
          notifications: 2,
          workflowTransitions: 5,
          lastActivityAt: '2026-06-03T08:07:00.000Z',
        },
        {
          serviceArea: 'ABSENCE_LEAVE',
          commands: 2,
          failedCommands: 1,
          events: 0,
          pendingOutboxEvents: 0,
          notifications: 0,
          workflowTransitions: 0,
          lastActivityAt: '2026-06-03T07:00:00.000Z',
        },
      ],
    });
  });
});
