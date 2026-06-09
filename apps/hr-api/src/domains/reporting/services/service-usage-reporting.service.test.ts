import { describe, expect, it } from 'vitest';
import { buildHrReportsDashboard, buildServiceUsageSummary, type ServiceUsageMetricRow } from './service-usage-reporting.service.js';

describe('service usage reporting summary', () => {
  it('combines command, outbox, notification, and workflow usage into service rows', () => {
    const tenantId = '00000000-0000-0000-0000-000000000001';
    const rows: ServiceUsageMetricRow[] = [
      { source: 'COMMAND', serviceArea: 'PayrollInput', total: 4, lastActivityAt: new Date('2026-06-03T08:00:00.000Z') },
      {
        source: 'OUTBOX',
        serviceArea: 'PayrollInput',
        total: 3,
        pending: 1,
        exhausted: 1,
        oldestQueueBacklogAt: new Date('2026-06-03T08:02:00.000Z'),
        lastActivityAt: new Date('2026-06-03T08:05:00.000Z'),
      },
      {
        source: 'INBOX_QUEUE',
        serviceArea: 'PayrollInput',
        total: 5,
        inProgress: 1,
        failedRetryable: 2,
        failedNonRetryable: 1,
        skipped: 1,
        oldestQueueBacklogAt: new Date('2026-06-03T08:01:00.000Z'),
        lastActivityAt: new Date('2026-06-03T08:08:00.000Z'),
      },
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
        exhaustedOutboxEvents: 1,
        inboxInProgressEvents: 1,
        inboxFailedRetryableEvents: 2,
        inboxFailedNonRetryableEvents: 1,
        inboxSkippedEvents: 1,
        oldestQueueBacklogAt: '2026-06-03T08:01:00.000Z',
        notifications: 2,
        workflowTransitions: 5,
      },
      queueHealth: {
        outbox: {
          pendingEvents: 1,
          exhaustedEvents: 1,
          oldestBacklogAt: '2026-06-03T08:02:00.000Z',
        },
        inbox: {
          inProgressEvents: 1,
          failedRetryableEvents: 2,
          failedNonRetryableEvents: 1,
          skippedEvents: 1,
          oldestBacklogAt: '2026-06-03T08:01:00.000Z',
        },
      },
      services: [
        {
          serviceArea: 'PAYROLL',
          commands: 4,
          failedCommands: 0,
          events: 3,
          pendingOutboxEvents: 1,
          exhaustedOutboxEvents: 1,
          inboxInProgressEvents: 1,
          inboxFailedRetryableEvents: 2,
          inboxFailedNonRetryableEvents: 1,
          inboxSkippedEvents: 1,
          oldestQueueBacklogAt: '2026-06-03T08:01:00.000Z',
          notifications: 2,
          workflowTransitions: 5,
          lastActivityAt: '2026-06-03T08:08:00.000Z',
        },
        {
          serviceArea: 'ABSENCE_LEAVE',
          commands: 2,
          failedCommands: 1,
          events: 0,
          pendingOutboxEvents: 0,
          exhaustedOutboxEvents: 0,
          inboxInProgressEvents: 0,
          inboxFailedRetryableEvents: 0,
          inboxFailedNonRetryableEvents: 0,
          inboxSkippedEvents: 0,
          notifications: 0,
          workflowTransitions: 0,
          lastActivityAt: '2026-06-03T07:00:00.000Z',
        },
      ],
    });
  });

  it('proves enterprise usage rows are counted through commands, events, notifications, workflows, and queues', () => {
    const tenantId = '00000000-0000-0000-0000-000000000001';
    const rows: ServiceUsageMetricRow[] = [
      { source: 'COMMAND', serviceArea: 'AbsenceRequest', total: 1, lastActivityAt: new Date('2026-06-03T08:00:00.000Z') },
      { source: 'OUTBOX', serviceArea: 'AbsenceRequest', total: 1, pending: 0, exhausted: 0, lastActivityAt: new Date('2026-06-03T08:01:00.000Z') },
      { source: 'NOTIFICATION', serviceArea: 'AbsenceRequest', total: 2, lastActivityAt: new Date('2026-06-03T08:02:00.000Z') },
      { source: 'WORKFLOW', serviceArea: 'AbsenceRequest', total: 1, lastActivityAt: new Date('2026-06-03T08:03:00.000Z') },
      {
        source: 'INBOX_QUEUE',
        serviceArea: 'AbsenceRequest',
        total: 1,
        inProgress: 0,
        failedRetryable: 0,
        failedNonRetryable: 0,
        skipped: 0,
        lastActivityAt: new Date('2026-06-03T08:04:00.000Z'),
      },
      { source: 'COMMAND', serviceArea: 'PolicyRevision', total: 1, lastActivityAt: new Date('2026-06-03T08:05:00.000Z') },
      { source: 'OUTBOX', serviceArea: 'AccessReviewCampaign', total: 1, pending: 1, oldestQueueBacklogAt: new Date('2026-06-03T08:06:00.000Z'), lastActivityAt: new Date('2026-06-03T08:06:00.000Z') },
      { source: 'OUTBOX', serviceArea: 'ServiceUsageMetric', total: 1, pending: 0, exhausted: 0, lastActivityAt: new Date('2026-06-03T08:07:00.000Z') },
      { source: 'OUTBOX', serviceArea: 'EventContractRegistry', total: 1, pending: 0, exhausted: 0, lastActivityAt: new Date('2026-06-03T08:08:00.000Z') },
    ];

    const summary = buildServiceUsageSummary(tenantId, rows, new Date('2026-06-03T09:00:00.000Z'));
    const absence = summary.services.find((service) => service.serviceArea === 'ABSENCE_LEAVE');

    expect(absence).toMatchObject({
      commands: 1,
      events: 1,
      notifications: 2,
      workflowTransitions: 1,
      inboxInProgressEvents: 0,
    });
    expect(summary.services.find((service) => service.serviceArea === 'POLICY_CENTER')?.commands).toBe(1);
    expect(summary.services.find((service) => service.serviceArea === 'ACCESS_GOVERNANCE')?.pendingOutboxEvents).toBe(1);
    expect(summary.services.find((service) => service.serviceArea === 'REPORTING')?.events).toBe(1);
    expect(summary.services.find((service) => service.serviceArea === 'SYSTEM_GOVERNANCE')?.events).toBe(1);
    expect(summary.queueHealth.outbox.pendingEvents).toBe(1);
    expect(summary.totals).toMatchObject({
      commands: 2,
      events: 4,
      notifications: 2,
      workflowTransitions: 1,
      pendingOutboxEvents: 1,
    });
  });

  it('keeps thinner commercial domains visible as their own service usage rows', () => {
    const tenantId = '00000000-0000-0000-0000-000000000001';
    const rows: ServiceUsageMetricRow[] = [
      { source: 'COMMAND', serviceArea: 'BenefitsEnrollment', total: 1 },
      { source: 'OUTBOX', serviceArea: 'BenefitsLifeEvent', total: 1 },
      { source: 'WORKFLOW', serviceArea: 'EngagementSurvey', total: 1 },
      { source: 'NOTIFICATION', serviceArea: 'RecognitionRecord', total: 1 },
      { source: 'COMMAND', serviceArea: 'DeiReport', total: 1 },
      { source: 'OUTBOX', serviceArea: 'PayEquityReview', total: 1 },
      { source: 'COMMAND', serviceArea: 'WorkAuthorizationCase', total: 1 },
    ];

    const summary = buildServiceUsageSummary(tenantId, rows, new Date('2026-06-03T09:00:00.000Z'));

    expect(summary.services.find((service) => service.serviceArea === 'BENEFITS')).toMatchObject({
      commands: 1,
      events: 1,
    });
    expect(summary.services.find((service) => service.serviceArea === 'ENGAGEMENT')).toMatchObject({
      notifications: 1,
      workflowTransitions: 1,
    });
    expect(summary.services.find((service) => service.serviceArea === 'DEI_ANALYTICS')).toMatchObject({
      commands: 1,
      events: 1,
    });
    expect(summary.services.find((service) => service.serviceArea === 'COUNTRY_POLICY')).toMatchObject({
      commands: 1,
    });
    expect(summary.services.find((service) => service.serviceArea === 'REPORTING')).toBeUndefined();
  });

  it('builds business HR report groups from cross-module service usage evidence', () => {
    const tenantId = '00000000-0000-0000-0000-000000000001';
    const rows: ServiceUsageMetricRow[] = [
      { source: 'COMMAND', serviceArea: 'AttendanceLedger', total: 8, failed: 1, lastActivityAt: new Date('2026-06-03T08:00:00.000Z') },
      { source: 'OUTBOX', serviceArea: 'AttendanceLedger', total: 5, pending: 2, oldestQueueBacklogAt: new Date('2026-06-03T08:01:00.000Z') },
      { source: 'COMMAND', serviceArea: 'AbsenceRequest', total: 4 },
      { source: 'NOTIFICATION', serviceArea: 'AbsenceRequest', total: 6 },
      { source: 'COMMAND', serviceArea: 'PayrollCycle', total: 3 },
      { source: 'WORKFLOW', serviceArea: 'PerformanceReview', total: 7 },
      { source: 'COMMAND', serviceArea: 'BenefitsEnrollment', total: 2 },
      { source: 'NOTIFICATION', serviceArea: 'EngagementSurvey', total: 9 },
    ];
    const usage = buildServiceUsageSummary(tenantId, rows, new Date('2026-06-03T09:00:00.000Z'));

    const dashboard = buildHrReportsDashboard(usage);

    expect(dashboard.totals).toMatchObject({
      reportGroups: 8,
      activeReportGroups: 6,
      totalActivity: 44,
      queueBacklog: 2,
      issues: 3,
    });
    expect(dashboard.reports.find((report) => report.code === 'ATTENDANCE')).toMatchObject({
      title: 'Attendance Report',
      category: 'Workforce',
      services: ['TIME_ATTENDANCE'],
      activity: 13,
      issues: 3,
      readiness: 'Attention',
    });
    expect(dashboard.reports.find((report) => report.code === 'LEAVE')).toMatchObject({
      title: 'Leave Report',
      activity: 10,
      readiness: 'Live',
    });
    expect(dashboard.reports.find((report) => report.code === 'PAYROLL')).toMatchObject({
      title: 'Payroll Report',
      activity: 3,
    });
    expect(dashboard.reports.find((report) => report.code === 'PERFORMANCE')).toMatchObject({
      title: 'Performance Report',
      activity: 7,
    });
    expect(dashboard.reports.find((report) => report.code === 'BENEFITS')).toMatchObject({
      title: 'Benefits Report',
      activity: 2,
    });
    expect(dashboard.reports.find((report) => report.code === 'ENGAGEMENT')).toMatchObject({
      title: 'Engagement Report',
      activity: 9,
    });
    expect(dashboard.activityByReport).toEqual(expect.arrayContaining([
      { label: 'Attendance Report', activity: 13, issues: 3 },
      { label: 'Leave Report', activity: 10, issues: 0 },
    ]));
  });
});
