import { Injectable } from '@nestjs/common';
import type { CommandResult, HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import { AttendanceCorrectionRequestRepository } from '../repositories/attendance-correction-request.repository.js';
import type { AttendanceCorrectionType } from '../services/attendance-correction.service.js';
import type { TimeClockEventType } from '../aggregates/time-clock-event.aggregate.js';

@CommandHandler('CreateAttendanceCorrectionRequest')
@Injectable()
export class CreateAttendanceCorrectionRequestHandler {
  constructor(private readonly repo: AttendanceCorrectionRequestRepository) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      workerId: Uuid;
      workDate: string;
      correctionType: AttendanceCorrectionType;
      requestedEventType?: TimeClockEventType;
      requestedTimestamp?: Date;
      targetEventId?: string;
      reason: string;
    };
    const requestedAt = new Date();
    const request = await this.repo.create({
      tenantId: command.tenantId.value,
      workerId: payload.workerId.value,
      workDate: payload.workDate,
      correctionType: payload.correctionType,
      requestedEventType: payload.requestedEventType,
      requestedTimestamp: payload.requestedTimestamp,
      targetEventId: payload.targetEventId,
      reason: payload.reason,
      status: 'PENDING_MANAGER_REVIEW',
      requestedBy: command.actor.actorId.value,
      requestedAt,
      auditTrail: [{
        action: 'REQUESTED',
        actorId: command.actor.actorId.value,
        note: payload.reason,
        timestamp: requestedAt.toISOString(),
      }],
    });

    return {
      success: true,
      data: request,
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: new Uuid(request.id),
      newState: request.status,
      newVersion: 0,
      allowedNextActions: ['ReviewAttendanceCorrectionRequest'],
      eventsEmitted: ['AttendanceCorrectionRequestCreated'],
      auditRecordId: command.commandId,
    fieldAccessDecisions: {},
    } as CommandResult<unknown>;
  }
}
