import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { RedisCacheService } from '@hcm/platform-core';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';
import type { AttritionRiskSnapshot, AttendancePayrollAnomalySnapshot } from '../../domains/intelligence/repositories/intelligence.repository.js';
import { IntelligenceRepository } from '../../domains/intelligence/repositories/intelligence.repository.js';
import type { HrCaseTask } from '../../domains/hr-service-delivery/aggregates/hr-case-task.aggregate.js';
import type { HrServiceCase } from '../../domains/hr-service-delivery/aggregates/hr-service-case.aggregate.js';
import { HrCaseTaskRepository } from '../../domains/hr-service-delivery/repositories/hr-case-task.repository.js';
import { HrServiceCaseRepository } from '../../domains/hr-service-delivery/repositories/hr-service-case.repository.js';
import type { LearningAssignment } from '../../domains/learning/aggregates/learning-assignment.aggregate.js';
import { LearningAssignmentRepository } from '../../domains/learning/repositories/learning-assignment.repository.js';
import type { OnboardingTask } from '../../domains/onboarding/aggregates/onboarding-task.aggregate.js';
import { OnboardingTaskRepository } from '../../domains/onboarding/repositories/onboarding-task.repository.js';
import { WorkerRepository } from '../../domains/hr-core/repositories/worker.repository.js';
import { PlatformNotificationRepository, type PlatformNotificationRecord } from '../notifications/platform-notification.repository.js';
import { ReminderDispatchLogRepository, type ReminderDispatchLogRecord } from '../scheduler/reminder-dispatch-log.repository.js';
import { ApprovalWorkflowService } from '../workflow/approval-workflow.service.js';
import type { ApprovalChain, ApprovalStepProps } from '../workflow/approval-chain.aggregate.js';

export type MeInboxSectionKey = 'approvals' | 'tasks' | 'reminders' | 'notifications' | 'insights';
export type MeInboxSeverity = 'INFO' | 'DUE' | 'OVERDUE' | 'AT_RISK';

export interface MeInboxAction {
  label: string;
  commandPath: string;
  body?: Record<string, unknown>;
}

export interface MeInboxItem {
  id: string;
  title: string;
  subtitle?: string;
  severity: MeInboxSeverity;
  dueAt?: string;
  deepLink: string;
  actions?: MeInboxAction[];
}

export interface MeInboxSection {
  key: MeInboxSectionKey;
  title: string;
  count: number;
  items: MeInboxItem[];
}

export interface MeInbox {
  generatedAt: string;
  sections: MeInboxSection[];
}

interface ApprovalWorkflowPort {
  findPendingForActor(tenantId: Uuid, actorRoles: string[], actorId?: Uuid): Promise<ApprovalChain[]>;
}

interface NotificationPort {
  findWorkerIdForActor(tenantId: string, actorId: string, email?: string): Promise<string | undefined>;
  findByWorker(tenantId: string, workerId: string, limit?: number): Promise<PlatformNotificationRecord[]>;
}

interface OnboardingTaskPort {
  findByAssignee(assigneeId: Uuid): Promise<OnboardingTaskLike[]>;
}

interface HrCaseTaskPort {
  findByAssignee(assigneeId: Uuid): Promise<HrCaseTaskLike[]>;
}

interface HrServiceCasePort {
  findByRequester(tenantId: Uuid, requesterWorkerId: Uuid): Promise<HrServiceCaseLike[]>;
}

interface LearningAssignmentPort {
  findByWorker(workerId: Uuid): Promise<LearningAssignmentLike[]>;
}

interface ReminderLogPort {
  findRecentForAudience(tenantId: Uuid, workerId: Uuid, limit?: number): Promise<ReminderDispatchLogLike[]>;
}

interface IntelligencePort {
  attritionRiskForTenant(tenantId: Uuid): Promise<AttritionRiskLike[]>;
  anomaliesForTenant(tenantId: Uuid): Promise<AnomalyLike[]>;
}

interface WorkerPort {
  findByManagerForTenant(managerId: Uuid, tenantId: Uuid): Promise<Array<{ id: Uuid }>>;
}

interface MeInboxRequest {
  tenantId: Uuid;
  actor: HrActor & { email?: string };
  now?: Date;
}

const SECTION_TITLES: Record<MeInboxSectionKey, string> = {
  approvals: 'Approvals',
  tasks: 'Tasks',
  reminders: 'Reminders',
  notifications: 'Notifications',
  insights: 'Insights',
};

@Injectable()
export class MeInboxService {
  private readonly logger = new Logger(MeInboxService.name);

  constructor(
    @Inject(ApprovalWorkflowService)
    private readonly workflow: ApprovalWorkflowPort,
    @Inject(PlatformNotificationRepository)
    private readonly notifications: NotificationPort,
    @Optional()
    @Inject(OnboardingTaskRepository)
    private readonly onboardingTasks?: OnboardingTaskPort,
    @Optional()
    @Inject(HrCaseTaskRepository)
    private readonly hrCaseTasks?: HrCaseTaskPort,
    @Optional()
    @Inject(HrServiceCaseRepository)
    private readonly hrServiceCases?: HrServiceCasePort,
    @Optional()
    @Inject(LearningAssignmentRepository)
    private readonly learningAssignments?: LearningAssignmentPort,
    @Optional()
    @Inject(ReminderDispatchLogRepository)
    private readonly reminderLog?: ReminderLogPort,
    @Optional()
    @Inject(IntelligenceRepository)
    private readonly intelligence?: IntelligencePort,
    @Optional()
    @Inject(WorkerRepository)
    private readonly workers?: WorkerPort,
    @Optional()
    @Inject(RedisCacheService)
    private readonly cache?: Pick<RedisCacheService, 'getOrSet'>,
  ) {}

  async getInbox({ tenantId, actor, now = new Date() }: MeInboxRequest): Promise<MeInbox> {
    const build = async () => this.buildInbox(tenantId, actor, now);
    const cacheKey = `hcm:${tenantId.value}:me-inbox:${idValue(actor.actorId)}`;
    return this.cache?.getOrSet(cacheKey, build, 30) ?? build();
  }

  private async buildInbox(tenantId: Uuid, actor: HrActor & { email?: string }, now: Date): Promise<MeInbox> {
    const sections = await Promise.all([
      this.safeSection('approvals', () => this.approvalItems(tenantId, actor, now)),
      this.safeSection('tasks', () => this.taskItems(tenantId, actor, now)),
      this.safeSection('reminders', () => this.reminderItems(tenantId, actor)),
      this.safeSection('notifications', () => this.notificationItems(tenantId, actor)),
      this.safeSection('insights', () => this.insightItems(tenantId, actor)),
    ]);

    return {
      generatedAt: now.toISOString(),
      sections,
    };
  }

  private async safeSection(key: MeInboxSectionKey, load: () => Promise<MeInboxItem[]>): Promise<MeInboxSection> {
    try {
      const items = await load();
      return {
        key,
        title: SECTION_TITLES[key],
        count: items.length,
        items,
      };
    } catch (error) {
      this.logger.warn(`Me inbox source ${key} failed: ${error instanceof Error ? error.message : String(error)}`);
      return this.emptySection(key);
    }
  }

  private emptySection(key: MeInboxSectionKey): MeInboxSection {
    return {
      key,
      title: SECTION_TITLES[key],
      count: 0,
      items: [],
    };
  }

  private async approvalItems(tenantId: Uuid, actor: HrActor, now: Date): Promise<MeInboxItem[]> {
    const chains = await this.workflow.findPendingForActor(tenantId, actor.roles, actor.actorId);
    return chains
      .map((chain) => this.toApprovalItem(chain, actor, now))
      .filter((item): item is MeInboxItem => Boolean(item))
      .slice(0, 20);
  }

  private toApprovalItem(chain: ApprovalChain, actor: HrActor, now: Date): MeInboxItem | undefined {
    const step = chain.steps.find((candidate) => this.isActionableStep(candidate, actor));
    if (!step) return undefined;
    const chainId = chain.id.value;
    const stepId = step.id.value;
    const dueAt = step.slaDueAt?.toISOString();

    return {
      id: `${chainId}:${stepId}`,
      title: chain.commandName,
      subtitle: `${step.label} · ${chain.aggregateType}`,
      severity: step.slaDueAt && step.slaDueAt.getTime() < now.getTime() ? 'OVERDUE' : 'DUE',
      dueAt,
      deepLink: `/manager/approvals?chain=${chainId}`,
      actions: [
        {
          label: 'Approve',
          commandPath: `/platform/workflow/approval-chains/${chainId}/steps/${stepId}/commands/approve`,
          body: { reason: 'Approved from For You' },
        },
        {
          label: 'Reject',
          commandPath: `/platform/workflow/approval-chains/${chainId}/steps/${stepId}/commands/reject`,
          body: { reason: 'Rejected from For You' },
        },
      ],
    };
  }

  private isActionableStep(step: ApprovalStepProps, actor: HrActor): boolean {
    if (!['PENDING', 'DELEGATED', 'ESCALATED'].includes(step.state)) return false;
    const actorId = idValue(actor.actorId);
    if (step.delegatedToWorkerId?.value === actorId) return true;
    if (step.approverWorkerId?.value === actorId) return true;
    if (step.escalationApproverRole && actor.roles.includes(step.escalationApproverRole)) return true;
    return Boolean(step.approverRole && actor.roles.includes(step.approverRole));
  }

  private async notificationItems(tenantId: Uuid, actor: HrActor & { email?: string }): Promise<MeInboxItem[]> {
    const workerId = await this.notifications.findWorkerIdForActor(tenantId.value, idValue(actor.actorId), actor.email);
    if (!workerId) return [];
    const records = await this.notifications.findByWorker(tenantId.value, workerId, 20);
    return records
      .filter((record) => !record.readAt)
      .map((record) => ({
        id: record.id,
        title: record.title,
        subtitle: record.body,
        severity: 'INFO' as const,
        deepLink: this.notificationDeepLink(record),
      }))
      .slice(0, 20);
  }

  private notificationDeepLink(record: PlatformNotificationRecord): string {
    switch (record.category) {
      case 'PAYROLL':
        return '/employee/payslips';
      case 'BENEFITS':
        return '/employee/benefits';
      case 'PERFORMANCE':
        return '/employee/performance';
      default:
        return '/employee/services';
    }
  }

  private async taskItems(tenantId: Uuid, actor: HrActor & { email?: string }, now: Date): Promise<MeInboxItem[]> {
    const workerId = await this.resolveWorkerId(tenantId, actor);
    if (!workerId) return [];
    const workerUuid = new Uuid(workerId);

    const [onboarding, serviceTasks, serviceCases, learning] = await Promise.all([
      this.onboardingTasks?.findByAssignee(workerUuid) ?? Promise.resolve([]),
      this.hrCaseTasks?.findByAssignee(workerUuid) ?? Promise.resolve([]),
      this.hrServiceCases?.findByRequester(tenantId, workerUuid) ?? Promise.resolve([]),
      this.learningAssignments?.findByWorker(workerUuid) ?? Promise.resolve([]),
    ]);

    return [
      ...onboarding
        .filter((task) => !['COMPLETED', 'SKIPPED'].includes(String(task.status)))
        .map((task) => this.toTaskItem({
          id: `onboarding:${idValue(task.id)}`,
          title: task.title,
          subtitle: task.description,
          dueAt: dateIso(task.dueDate),
          deepLink: `/employee/onboarding?task=${idValue(task.id)}`,
          commandPath: `/onboarding/tasks/${idValue(task.id)}/commands/complete`,
          now,
        })),
      ...serviceTasks
        .filter((task) => !['COMPLETED', 'CANCELLED'].includes(String(task.status)))
        .map((task) => this.toTaskItem({
          id: `service-task:${idValue(task.id)}`,
          title: task.title,
          subtitle: 'HR service task',
          dueAt: dateIso(task.dueDate),
          deepLink: `/employee/services?task=${idValue(task.id)}`,
          commandPath: `/hr-service-delivery/tasks/${idValue(task.id)}/commands/complete`,
          now,
        })),
      ...serviceCases
        .filter((serviceCase) => !['RESOLVED', 'CLOSED'].includes(String(serviceCase.status)))
        .map((serviceCase) => this.toTaskItem({
          id: `service-case:${idValue(serviceCase.id)}`,
          title: `${serviceCase.caseNumber} · ${serviceCase.caseType}`,
          subtitle: `Priority ${serviceCase.priority}`,
          dueAt: dateIso(serviceCase.slaDeadline),
          deepLink: `/employee/services?case=${idValue(serviceCase.id)}`,
          now,
        })),
      ...learning
        .filter((assignment) => !['COMPLETED', 'EXPIRED', 'CANCELLED'].includes(String(assignment.status)))
        .map((assignment) => this.toTaskItem({
          id: `learning:${idValue(assignment.id)}`,
          title: 'Learning assignment due',
          subtitle: `Course ${idValue(assignment.courseId)}`,
          dueAt: dateIso(assignment.dueDate),
          deepLink: `/employee/learning?assignment=${idValue(assignment.id)}`,
          commandPath: `/learning/assignments/${idValue(assignment.id)}/commands/complete`,
          body: { score: 100 },
          now,
        })),
    ]
      .sort(sortBySeverityAndDueDate)
      .slice(0, 20);
  }

  private toTaskItem(input: {
    id: string;
    title: string;
    subtitle?: string;
    dueAt?: string;
    deepLink: string;
    commandPath?: string;
    body?: Record<string, unknown>;
    now: Date;
  }): MeInboxItem {
    return {
      id: input.id,
      title: input.title,
      subtitle: input.subtitle,
      severity: severityFromDueAt(input.dueAt, input.now),
      dueAt: input.dueAt,
      deepLink: input.deepLink,
      actions: input.commandPath
        ? [{ label: 'Complete', commandPath: input.commandPath, body: input.body }]
        : undefined,
    };
  }

  private async reminderItems(tenantId: Uuid, actor: HrActor & { email?: string }): Promise<MeInboxItem[]> {
    const workerId = await this.resolveWorkerId(tenantId, actor);
    if (!workerId || !this.reminderLog) return [];
    const reminders = await this.reminderLog.findRecentForAudience(tenantId, new Uuid(workerId), 20);
    return reminders.map((reminder) => ({
      id: reminder.id,
      title: reminder.reminderType,
      subtitle: `${reminder.subjectType} · ${reminder.escalationTier}`,
      severity: 'DUE' as const,
      dueAt: reminder.dueDateBucket,
      deepLink: this.reminderDeepLink(reminder),
    })).slice(0, 20);
  }

  private reminderDeepLink(reminder: ReminderDispatchLogLike): string {
    switch (reminder.subjectType) {
      case 'LearningAssignment':
      case 'Certification':
        return '/employee/learning';
      case 'OnboardingPlan':
      case 'OnboardingTask':
        return '/employee/onboarding';
      case 'AbsenceRequest':
        return '/employee/time-off';
      case 'AttendanceDailyLedger':
      case 'Timesheet':
        return '/employee/attendance';
      default:
        return '/employee/services';
    }
  }

  private async insightItems(tenantId: Uuid, actor: HrActor): Promise<MeInboxItem[]> {
    if (!this.intelligence) return [];
    const [risks, anomalies] = await Promise.all([
      this.intelligence.attritionRiskForTenant(tenantId),
      this.intelligence.anomaliesForTenant(tenantId),
    ]);
    const visibleWorkerIds = await this.visibleInsightWorkerIds(tenantId, actor);
    return [
      ...risks
        .filter((risk) => this.canSeeInsight(risk.workerId, visibleWorkerIds))
        .filter((risk) => ['HIGH', 'CRITICAL'].includes(String(risk.band)))
        .map((risk) => ({
          id: `insight:attrition:${risk.id}`,
          title: `Attrition risk is ${risk.band}`,
          subtitle: this.factorSummary(risk.factors),
          severity: 'AT_RISK' as const,
          deepLink: actor.roles.includes('MANAGER')
            ? `/manager/team?worker=${risk.workerId}`
            : `/admin/insights?worker=${risk.workerId}`,
        })),
      ...anomalies
        .filter((anomaly) => this.canSeeInsight(anomaly.workerId, visibleWorkerIds))
        .filter((anomaly) => ['HIGH', 'CRITICAL'].includes(String(anomaly.band)))
        .map((anomaly) => ({
          id: `insight:anomaly:${anomaly.id}`,
          title: `${anomaly.anomalyType} anomaly`,
          subtitle: this.factorSummary(anomaly.factors),
          severity: 'AT_RISK' as const,
          deepLink: '/admin/insights?worker=' + anomaly.workerId,
        })),
    ].slice(0, 20);
  }

  private async visibleInsightWorkerIds(tenantId: Uuid, actor: HrActor): Promise<Set<string> | undefined> {
    if (actor.roles.some((role) => role === 'HR_ADMIN' || role === 'EXECUTIVE_VIEWER')) return undefined;
    if (!actor.roles.includes('MANAGER') || !this.workers) return new Set();
    const reports = await this.workers.findByManagerForTenant(new Uuid(idValue(actor.actorId)), tenantId);
    return new Set(reports.map((worker) => idValue(worker.id)));
  }

  private canSeeInsight(workerId: string, visibleWorkerIds: Set<string> | undefined): boolean {
    return !visibleWorkerIds || visibleWorkerIds.has(workerId);
  }

  private factorSummary(factors: unknown): string | undefined {
    if (!Array.isArray(factors) || factors.length === 0) return undefined;
    const first = factors[0] as { label?: unknown; factor?: unknown; detail?: unknown };
    if (typeof first.label === 'string') return first.label;
    if (typeof first.factor === 'string') return first.factor;
    if (typeof first.detail === 'string') return first.detail;
    return undefined;
  }

  private async resolveWorkerId(tenantId: Uuid, actor: HrActor & { email?: string }): Promise<string | undefined> {
    return this.notifications.findWorkerIdForActor(tenantId.value, idValue(actor.actorId), actor.email);
  }
}

function idValue(value: Uuid | { value: string } | string): string {
  if (typeof value === 'string') return value;
  return value.value;
}

function dateIso(value: Date | string | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function severityFromDueAt(dueAt: string | undefined, now: Date): MeInboxSeverity {
  if (!dueAt) return 'INFO';
  return new Date(dueAt).getTime() < now.getTime() ? 'OVERDUE' : 'DUE';
}

function sortBySeverityAndDueDate(a: MeInboxItem, b: MeInboxItem): number {
  const severityScore: Record<MeInboxSeverity, number> = { OVERDUE: 0, AT_RISK: 1, DUE: 2, INFO: 3 };
  const bySeverity = severityScore[a.severity] - severityScore[b.severity];
  if (bySeverity !== 0) return bySeverity;
  return new Date(a.dueAt ?? '9999-12-31').getTime() - new Date(b.dueAt ?? '9999-12-31').getTime();
}

type OnboardingTaskLike = Pick<OnboardingTask, 'id' | 'title' | 'description' | 'dueDate' | 'status'>;
type HrCaseTaskLike = Pick<HrCaseTask, 'id' | 'title' | 'dueDate' | 'status'>;
type HrServiceCaseLike = Pick<HrServiceCase, 'id' | 'caseNumber' | 'caseType' | 'priority' | 'slaDeadline' | 'status'>;
type LearningAssignmentLike = Pick<LearningAssignment, 'id' | 'courseId' | 'dueDate' | 'status'>;
type ReminderDispatchLogLike = ReminderDispatchLogRecord;
type AttritionRiskLike = Pick<AttritionRiskSnapshot, 'id' | 'workerId' | 'band' | 'factors'>;
type AnomalyLike = Pick<AttendancePayrollAnomalySnapshot, 'id' | 'workerId' | 'band' | 'anomalyType' | 'factors'>;
