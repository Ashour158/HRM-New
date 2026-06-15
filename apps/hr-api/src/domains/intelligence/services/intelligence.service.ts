import { ForbiddenException, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  detectAttendancePayrollAnomaly,
  scoreAttritionRisk,
  type AttendancePayrollAnomalyFeatures,
  type AttritionRiskFeatures,
} from '@hcm/hr-intelligence';
import { HR_ANALYTICS, type HrEventEnvelope } from '@hcm/event-schemas';
import { Uuid } from '@hcm/shared-kernel';
import type { HrActor } from '@hcm/command-contracts';
import { EventBus, type EventHandler } from '../../../platform/event-bus/event-bus.js';
import { WorkerRepository } from '../../hr-core/repositories/worker.repository.js';
import { IntelligenceRepository } from '../repositories/intelligence.repository.js';

export interface IntelligenceSignalInput {
  signalType: 'ATTRITION_RISK' | 'ATTENDANCE_PAYROLL_ANOMALY';
  workerId: string;
  periodKey: string;
  features: AttritionRiskFeatures | AttendancePayrollAnomalyFeatures;
  anomalyType?: string;
  audienceWorkerIds?: string[];
}

@Injectable()
export class IntelligenceService implements OnModuleInit {
  constructor(
    private readonly repository: IntelligenceRepository,
    private readonly workerRepo: WorkerRepository,
    @Inject(EventBus) private readonly eventBus: EventBus,
  ) {}

  onModuleInit(): void {
    const handler: EventHandler = {
      consumerGroup: 'intelligence-read-models',
      handle: async (event) => {
        if (event.eventName === 'IntelligenceSignalRecorded') {
          await this.consumeSignalEvent(event as HrEventEnvelope<IntelligenceSignalInput>);
        }
      },
    };
    this.eventBus.subscribe(HR_ANALYTICS, 'intelligence-read-models', handler);
  }

  async publishSignal(tenantId: Uuid, input: IntelligenceSignalInput): Promise<{ eventId: string }> {
    const eventId = Uuid.generate();
    const event: HrEventEnvelope<IntelligenceSignalInput> = {
      eventId,
      eventName: 'IntelligenceSignalRecorded',
      eventSchemaVersion: 1,
      tenantId,
      aggregateType: 'IntelligenceSignal',
      aggregateId: new Uuid(input.workerId),
      payload: input,
      metadata: {
        correlationId: Uuid.generate(),
        requestHash: `intelligence:${input.signalType}:${input.workerId}:${input.periodKey}`,
        clientType: 'HR_ADMIN',
        topic: HR_ANALYTICS,
        eventSchemaVersion: 1,
        envelopeVersion: 1,
      },
      privacy: {
        piiClassification: input.signalType === 'ATTENDANCE_PAYROLL_ANOMALY' ? 'HIGH' : 'MEDIUM',
        employeeDataCategory: input.signalType === 'ATTENDANCE_PAYROLL_ANOMALY' ? 'PAYROLL' : 'PERFORMANCE',
        subjectWorkerId: input.workerId,
        managerVisible: true,
        employeeVisible: false,
        hrRestricted: false,
        redactionApplied: true,
      },
      occurredAt: new Date(),
      version: 1,
    };
    await this.eventBus.publish(event);
    await this.consumeSignalEvent(event);
    return { eventId: eventId.value };
  }

  async consumeSignalEvent(event: HrEventEnvelope<IntelligenceSignalInput>): Promise<void> {
    const payload = event.payload;
    if (payload.signalType === 'ATTRITION_RISK') {
      const result = scoreAttritionRisk(payload.features as AttritionRiskFeatures);
      await this.repository.saveAttritionRiskSnapshot({
        tenantId: event.tenantId,
        workerId: new Uuid(payload.workerId),
        periodKey: payload.periodKey,
        modelKey: result.modelKey,
        modelVersion: result.modelVersion,
        score: result.score,
        band: result.band,
        factors: result.factors,
        featureSnapshot: payload.features as AttritionRiskFeatures,
        sourceEventId: event.eventId,
      });
      return;
    }

    const result = detectAttendancePayrollAnomaly(payload.features as AttendancePayrollAnomalyFeatures);
    const notificationEventId = result.band === 'HIGH'
      ? await this.publishAnomalyReminder(event, payload)
      : undefined;
    await this.repository.saveAttendancePayrollAnomalySnapshot({
      tenantId: event.tenantId,
      workerId: new Uuid(payload.workerId),
      periodKey: payload.periodKey,
      modelKey: result.modelKey,
      modelVersion: result.modelVersion,
      score: result.score,
      band: result.band,
      anomalyType: payload.anomalyType ?? 'ATTENDANCE_PAYROLL',
      factors: result.factors,
      featureSnapshot: payload.features as AttendancePayrollAnomalyFeatures,
      notificationEventId,
      sourceEventId: event.eventId,
    });
  }

  async latestAttritionRiskForWorker(tenantId: Uuid, workerId: Uuid, actor: HrActor) {
    await this.assertCanReadWorkerInsight(tenantId, workerId, actor);
    return this.repository.latestAttritionRiskForWorker(tenantId, workerId);
  }

  async attritionRiskForTenant(tenantId: Uuid, actor: HrActor) {
    const scopedWorkers = await this.scopedWorkerIds(tenantId, actor);
    if (scopedWorkers) return this.repository.attritionRiskForWorkers(tenantId, scopedWorkers);
    return this.repository.attritionRiskForTenant(tenantId);
  }

  async anomaliesForTenant(tenantId: Uuid, actor: HrActor) {
    const scopedWorkers = await this.scopedWorkerIds(tenantId, actor);
    if (scopedWorkers) return this.repository.anomaliesForWorkers(tenantId, scopedWorkers);
    return this.repository.anomaliesForTenant(tenantId);
  }

  private async assertCanReadWorkerInsight(tenantId: Uuid, workerId: Uuid, actor: HrActor): Promise<void> {
    const scopedWorkers = await this.scopedWorkerIds(tenantId, actor);
    if (!scopedWorkers) return;
    if (!scopedWorkers.some((scopedWorkerId) => scopedWorkerId.value === workerId.value)) {
      throw new ForbiddenException('Managers can read intelligence only for their direct reports');
    }
  }

  private async scopedWorkerIds(tenantId: Uuid, actor: HrActor): Promise<Uuid[] | undefined> {
    if (this.canReadTenantIntelligence(actor)) return undefined;
    if (!actor.roles.includes('MANAGER')) {
      throw new ForbiddenException('Intelligence reads require HR, executive, or manager scope');
    }
    const manager = await this.resolveManagerWorker(tenantId, actor);
    const reports = await this.workerRepo.findByManagerForTenant(manager, tenantId);
    return reports.map((worker) => worker.id);
  }

  private canReadTenantIntelligence(actor: HrActor): boolean {
    return actor.roles.some((role) => role === 'HR_ADMIN' || role === 'EXECUTIVE_VIEWER');
  }

  private async resolveManagerWorker(tenantId: Uuid, actor: HrActor): Promise<Uuid> {
    const actorId = actor.actorId instanceof Uuid
      ? actor.actorId.value
      : (actor.actorId as { value?: unknown } | undefined)?.value;
    if (typeof actorId === 'string' && Uuid.isValid(actorId)) {
      const worker = await this.workerRepo.findByIdForTenant(new Uuid(actorId), tenantId);
      if (worker) return worker.id;
    }
    const email = (actor as HrActor & { email?: unknown }).email;
    if (typeof email === 'string' && email.trim()) {
      const worker = await this.workerRepo.findByEmailForTenant(email, tenantId);
      if (worker) return worker.id;
    }
    throw new ForbiddenException('No manager employee profile is linked to the authenticated user');
  }

  private async publishAnomalyReminder(
    sourceEvent: HrEventEnvelope<IntelligenceSignalInput>,
    input: IntelligenceSignalInput,
  ): Promise<Uuid> {
    const eventId = Uuid.generate();
    await this.eventBus.publish({
      eventId,
      eventName: 'ReminderDue',
      eventSchemaVersion: 1,
      tenantId: sourceEvent.tenantId,
      aggregateType: 'IntelligenceInsight',
      aggregateId: new Uuid(input.workerId),
      payload: {
        reminderType: 'ATTENDANCE_PAYROLL_ANOMALY',
        subjectId: input.workerId,
        dueDate: new Date().toISOString().slice(0, 10),
        audienceWorkerIds: input.audienceWorkerIds ?? [],
        notifyHrOperations: true,
        title: 'Attendance and payroll anomaly detected',
        message: 'A high-risk attendance or payroll anomaly needs review.',
      },
      metadata: {
        correlationId: sourceEvent.metadata.correlationId,
        causationId: sourceEvent.eventId,
        requestHash: `reminder:attendance-payroll-anomaly:${input.workerId}:${input.periodKey}`,
        clientType: 'SYSTEM',
        topic: HR_ANALYTICS,
        eventSchemaVersion: 1,
        envelopeVersion: 1,
      },
      privacy: {
        piiClassification: 'HIGH',
        employeeDataCategory: 'PAYROLL',
        subjectWorkerId: input.workerId,
        managerVisible: true,
        employeeVisible: false,
        hrRestricted: false,
        redactionApplied: true,
      },
      occurredAt: new Date(),
      version: 1,
    });
    return eventId;
  }
}
