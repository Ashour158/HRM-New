import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HcmSetupService } from '../../hcm-setup/hcm-setup.service.js';
import { TimeClockEvent, type TimeClockCaptureMethod, type TimeClockEventType } from '../aggregates/time-clock-event.aggregate.js';
import { TimeClockEventRepository } from '../repositories/time-clock-event.repository.js';
import { TimeAttendanceEventsPublisher } from '../events/time-attendance-events.publisher.js';
import { AttendanceTrustService } from '../services/attendance-trust.service.js';

@CommandHandler('RecordTimeClockEvent')
@Injectable()
export class RecordTimeClockEventHandler {
  constructor(
    private readonly repo: TimeClockEventRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: TimeAttendanceEventsPublisher,
    private readonly hcmSetupService: HcmSetupService,
    private readonly attendanceTrustService: AttendanceTrustService,
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
    const setup = await this.hcmSetupService.getSetup(command.tenantId);
    const trustEvidence = this.attendanceTrustService.evaluateClockEvidence({
      policy: setup.attendancePolicy,
      locations: setup.locations,
      workplaceCode: payload.workplaceCode,
      latitude: payload.latitude,
      longitude: payload.longitude,
      accuracyMeters: payload.accuracyMeters,
      deviceId: payload.deviceId,
    });
    if (setup.attendancePolicy.geofenceEnabled && trustEvidence.locationStatus === 'NO_GEOLOCATION') {
      const profileRequiresGeo = setup.attendancePolicy.geofenceProfiles?.some((profile) => profile.active && profile.locationCode === payload.workplaceCode && profile.requireGeolocation);
      if (profileRequiresGeo || payload.captureMethod === 'MOBILE_GEOFENCE') {
        throw new ValidationError('Geolocation evidence is required by the applied attendance policy');
      }
    }
    if (trustEvidence.deviceTrustLevel === 'BLOCKED') {
      throw new ValidationError('This device is blocked by the applied attendance policy');
    }
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
        distanceMeters: trustEvidence.distanceMeters ?? payload.distanceMeters,
        geofenceRadiusMeters: trustEvidence.geofenceRadiusMeters ?? payload.geofenceRadiusMeters,
        geofenceProfileCode: trustEvidence.geofenceProfileCode ?? payload.geofenceProfileCode,
        locationStatus: trustEvidence.locationStatus,
        deviceTrustLevel: trustEvidence.deviceTrustLevel,
        trustLevel: trustEvidence.trustLevel,
        trustScore: trustEvidence.trustScore,
        trustRequiresApproval: trustEvidence.requiresApproval,
        trustReasons: trustEvidence.reasons.length ? trustEvidence.reasons : payload.trustReasons,
        deviceId: payload.deviceId,
        captureMethod: payload.captureMethod,
        captureDeviceKind: payload.captureDeviceKind,
        captureReference: payload.captureReference,
        verificationStatus: payload.verificationStatus,
        captureEvidence: {
          ...(payload.captureEvidence ?? {}),
          policyEvidence: {
            engine: 'AttendanceTrustService',
            geofenceEnabled: setup.attendancePolicy.geofenceEnabled,
            minClockTrustScore: setup.attendancePolicy.minClockTrustScore ?? 60,
            decision: trustEvidence.requiresApproval ? 'REQUIRES_APPROVAL' : 'ACCEPTED',
            reasons: trustEvidence.reasons,
          },
        },
      },
      command.correlationId,
    );
    await this.repo.save(ev);
    await this.publisher.publishFromAggregate(ev);
    return {
      success: true,
      data: {
        timeClockEventId: ev.id.value,
        workerId: ev.workerId.value,
        status: ev.status,
        eventType: ev.eventType,
        timestamp: ev.timestamp.toISOString(),
        workplaceCode: ev.workplaceCode,
        locationStatus: ev.locationStatus,
        trustLevel: ev.trustLevel,
        trustScore: ev.trustScore,
        trustRequiresApproval: ev.trustRequiresApproval,
      },
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
