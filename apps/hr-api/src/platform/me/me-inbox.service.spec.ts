import { describe, expect, it, vi } from 'vitest';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';
import { ApprovalChain } from '../workflow/approval-chain.aggregate.js';
import { MeInboxService } from './me-inbox.service.js';

const tenantId = new Uuid('00000000-0000-0000-0000-000000000001');
const managerId = new Uuid('00000000-0000-0000-0000-000000000011');
const workerId = '00000000-0000-0000-0000-000000000012';

const actor: HrActor & { email?: string } = {
  actorId: managerId,
  actorType: 'USER',
  roles: ['MANAGER'],
  permissions: ['WORKFLOW_APPROVE'],
  email: 'manager@example.com',
  mfaAuthenticated: true,
};

function approvalChain() {
  return new ApprovalChain({
    id: new Uuid('10000000-0000-0000-0000-000000000001'),
    tenantId,
    commandName: 'ApproveAbsenceRequest',
    aggregateType: 'AbsenceRequest',
    aggregateId: new Uuid('10000000-0000-0000-0000-000000000002'),
    requestedBy: new Uuid(workerId),
    commandEnvelope: {},
    status: 'IN_PROGRESS',
    currentStepOrder: 1,
    correlationId: new Uuid('10000000-0000-0000-0000-000000000003'),
    steps: [{
      id: new Uuid('10000000-0000-0000-0000-000000000004'),
      code: 'MANAGER_REVIEW',
      label: 'Manager review',
      order: 1,
      mode: 'SEQUENTIAL',
      approverType: 'ROLE',
      approverRole: 'MANAGER',
      state: 'PENDING',
      slaDueAt: new Date('2026-06-14T09:00:00.000Z'),
    }],
  });
}

describe('MeInboxService', () => {
  it('aggregates actionable approvals and unread notifications for the authenticated actor', async () => {
    const service = new MeInboxService(
      {
        findPendingForActor: vi.fn().mockResolvedValue([approvalChain()]),
      },
      {
        findWorkerIdForActor: vi.fn().mockResolvedValue(workerId),
        findByWorker: vi.fn().mockResolvedValue([
          {
            id: 'notification-1',
            title: 'Leave approved',
            body: 'Your annual leave was approved',
            category: 'LEAVE',
            relatedAggregateType: 'AbsenceRequest',
            relatedAggregateId: '10000000-0000-0000-0000-000000000002',
            createdAt: new Date('2026-06-15T08:00:00.000Z'),
          },
          {
            id: 'notification-2',
            title: 'Already read',
            body: 'Hidden from unread inbox',
            category: 'SYSTEM',
            relatedAggregateType: 'Notification',
            relatedAggregateId: 'notification-2',
            readAt: new Date('2026-06-15T08:30:00.000Z'),
            createdAt: new Date('2026-06-15T08:30:00.000Z'),
          },
        ]),
      },
    );

    const inbox = await service.getInbox({ tenantId, actor, now: new Date('2026-06-15T10:00:00.000Z') });

    const approvals = inbox.sections.find((section) => section.key === 'approvals');
    expect(approvals?.count).toBe(1);
    expect(approvals?.items[0]).toMatchObject({
      title: 'ApproveAbsenceRequest',
      subtitle: 'Manager review · AbsenceRequest',
      severity: 'OVERDUE',
      deepLink: '/manager/approvals?chain=10000000-0000-0000-0000-000000000001',
    });
    expect(approvals?.items[0]?.actions?.[0]).toMatchObject({
      label: 'Approve',
      commandPath: '/platform/workflow/approval-chains/10000000-0000-0000-0000-000000000001/steps/10000000-0000-0000-0000-000000000004/commands/approve',
    });

    const notifications = inbox.sections.find((section) => section.key === 'notifications');
    expect(notifications?.count).toBe(1);
    expect(notifications?.items[0]).toMatchObject({
      id: 'notification-1',
      title: 'Leave approved',
      severity: 'INFO',
      deepLink: '/employee/services',
    });
  });

  it('aggregates due tasks, reminders, and scoped intelligence insights from existing sources', async () => {
    const service = new MeInboxService(
      {
        findPendingForActor: vi.fn().mockResolvedValue([]),
      },
      {
        findWorkerIdForActor: vi.fn().mockResolvedValue(workerId),
        findByWorker: vi.fn().mockResolvedValue([]),
      },
      {
        findByAssignee: vi.fn().mockResolvedValue([
          {
            id: new Uuid('20000000-0000-0000-0000-000000000001'),
            title: 'Upload residency documents',
            description: 'Passport and work authorization',
            dueDate: new Date('2026-06-14T09:00:00.000Z'),
            status: 'PENDING',
          },
        ]),
      },
      {
        findByAssignee: vi.fn().mockResolvedValue([
          {
            id: new Uuid('20000000-0000-0000-0000-000000000002'),
            title: 'Confirm IT access',
            dueDate: new Date('2026-06-16T09:00:00.000Z'),
            status: 'IN_PROGRESS',
          },
        ]),
      },
      {
        findByRequester: vi.fn().mockResolvedValue([
          {
            id: new Uuid('20000000-0000-0000-0000-000000000003'),
            caseNumber: 'CASE-101',
            caseType: 'PAYROLL',
            priority: 'HIGH',
            slaDeadline: new Date('2026-06-14T12:00:00.000Z'),
            status: 'OPEN',
          },
        ]),
      },
      {
        findByWorker: vi.fn().mockResolvedValue([
          {
            id: new Uuid('20000000-0000-0000-0000-000000000004'),
            courseId: new Uuid('20000000-0000-0000-0000-000000000005'),
            dueDate: new Date('2026-06-20T09:00:00.000Z'),
            status: 'ASSIGNED',
          },
        ]),
      },
      {
        findRecentForAudience: vi.fn().mockResolvedValue([
          {
            id: 'reminder-1',
            reminderType: 'CERTIFICATION_EXPIRY',
            subjectType: 'Certification',
            subjectId: '20000000-0000-0000-0000-000000000006',
            dueDateBucket: '2026-06-18',
            escalationTier: 'T-7',
          },
        ]),
      },
      {
        attritionRiskForTenant: vi.fn().mockResolvedValue([
          {
            id: 'risk-1',
            workerId,
            periodKey: '2026-06',
            score: 82,
            band: 'HIGH',
            factors: [{ label: 'Engagement dropped', impact: 18 }],
            createdAt: new Date('2026-06-15T08:00:00.000Z'),
          },
        ]),
        anomaliesForTenant: vi.fn().mockResolvedValue([
          {
            id: 'anomaly-1',
            workerId,
            periodKey: '2026-06',
            score: 91,
            band: 'HIGH',
            anomalyType: 'OVERTIME_SPIKE',
            factors: [{ label: 'Overtime increased', impact: 22 }],
            createdAt: new Date('2026-06-15T08:15:00.000Z'),
          },
        ]),
      },
      {
        findByManagerForTenant: vi.fn().mockResolvedValue([{ id: new Uuid(workerId) }]),
      },
    );

    const inbox = await service.getInbox({ tenantId, actor, now: new Date('2026-06-15T10:00:00.000Z') });

    const tasks = inbox.sections.find((section) => section.key === 'tasks');
    expect(tasks?.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'onboarding:20000000-0000-0000-0000-000000000001',
        title: 'Upload residency documents',
        severity: 'OVERDUE',
        deepLink: '/employee/onboarding?task=20000000-0000-0000-0000-000000000001',
      }),
      expect.objectContaining({
        id: 'learning:20000000-0000-0000-0000-000000000004',
        title: 'Learning assignment due',
        severity: 'DUE',
        deepLink: '/employee/learning?assignment=20000000-0000-0000-0000-000000000004',
      }),
    ]));

    const reminders = inbox.sections.find((section) => section.key === 'reminders');
    expect(reminders?.items[0]).toMatchObject({
      id: 'reminder-1',
      title: 'CERTIFICATION_EXPIRY',
      severity: 'DUE',
      dueAt: '2026-06-18',
      deepLink: '/employee/learning',
    });

    const insights = inbox.sections.find((section) => section.key === 'insights');
    expect(insights?.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'insight:attrition:risk-1',
        title: 'Attrition risk is HIGH',
        severity: 'AT_RISK',
        deepLink: '/manager/team?worker=00000000-0000-0000-0000-000000000012',
      }),
      expect.objectContaining({
        id: 'insight:anomaly:anomaly-1',
        title: 'OVERTIME_SPIKE anomaly',
        severity: 'AT_RISK',
        deepLink: '/admin/insights?worker=00000000-0000-0000-0000-000000000012',
      }),
    ]));
  });

  it('fault-isolates failing sources into empty sections instead of failing the inbox', async () => {
    const service = new MeInboxService(
      {
        findPendingForActor: vi.fn().mockRejectedValue(new Error('workflow unavailable')),
      },
      {
        findWorkerIdForActor: vi.fn().mockRejectedValue(new Error('worker lookup unavailable')),
        findByWorker: vi.fn(),
      },
    );

    const inbox = await service.getInbox({ tenantId, actor, now: new Date('2026-06-15T10:00:00.000Z') });

    expect(inbox.sections).toHaveLength(5);
    expect(inbox.sections.every((section) => section.count === 0)).toBe(true);
  });
});
