import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { TimeClockEvent, type TimeClockCaptureMethod, type TimeClockEventType } from '../aggregates/time-clock-event.aggregate.js';
import { TimeClockEventRepository } from '../repositories/time-clock-event.repository.js';
import { TimeAttendanceEventsPublisher } from '../events/time-attendance-events.publisher.js';

@CommandHandler('RecordTimeClockEvent')
@Injectable()
export class RecordTimeClockEventHandler {
  constructor(
    private readonly repo: TimeClockEventRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: TimeAttendanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      workerId: Uuid;
      eventType: TimeClockEventType;
      timestamp: Date;
      location?: string;
      latitude?: number;
      longitude?: number;
      accuracyMeters?: number;
      workplaceCode?: string;
      distanceMeters?: number;
      geofenceRadiusMeters?: number;
      geofenceProfileCode?: string;
      locationStatus?: string;
      deviceTrustLevel?: string;
      trustLevel?: string;
      trustScore?: number;
      trustRequiresApproval?: boolean;
      trustReasons?: string[];
      deviceId?: string;
      captureMethod?: TimeClockCaptureMethod;
      captureDeviceKind?: string;
      captureReference?: string;
      verificationStatus?: 'FAILED' | 'NOT_REQUIRED' | 'PENDING' | 'VERIFIED';
      captureEvidence?: Record<string, unknown>;
    };
    const ev = TimeClockEvent.record(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        workerId: payload.workerId,
        eventType: payload.eventType,
        timestamp: payload.timestamp,
        location: payload.location,
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracyMeters: payload.accuracyMeters,
        workplaceCode: payload.workplaceCode,
        distanceMeters: payload.distanceMeters,
        geofenceRadiusMeters: payload.geofenceRadiusMeters,
        geofenceProfileCode: payload.geofenceProfileCode,
        locationStatus: payload.locationStatus,
        deviceTrustLevel: payload.deviceTrustLevel,
        trustLevel: payload.trustLevel,
        trustScore: payload.trustScore,
        trustRequiresApproval: payload.trustRequiresApproval,
        trustReasons: payload.trustReasons,
        deviceId: payload.deviceId,
        captureMethod: payload.captureMethod,
        captureDeviceKind: payload.captureDeviceKind,
        captureReference: payload.captureReference,
        verificationStatus: payload.verificationStatus,
        captureEvidence: payload.captureEvidence,
      },
      command.correlationId,
    );
    await this.repo.save(ev);
    await this.publisher.publishFromAggregate(ev);
    return {
      success: true,
      data: { timeClockEventId: ev.id.value, status: ev.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ev.id,
      newState: ev.status,
      newVersion: ev.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ev.status, 'TimeClockEvent'),
      eventsEmitted: ev.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    fieldAccessDecisions: {},
    } as CommandResult<unknown>;
  }
}
