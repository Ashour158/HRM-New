import { Injectable } from '@nestjs/common';
import type { CommandResult, HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import { TimeClockEvent } from '../aggregates/time-clock-event.aggregate.js';
import { AttendanceCorrectionRequestRepository } from '../repositories/attendance-correction-request.repository.js';
import { AttendanceDailyLedgerRepository } from '../repositories/attendance-daily-ledger.repository.js';
import { TimeClockEventRepository } from '../repositories/time-clock-event.repository.js';
import { TimeAttendanceEventsPublisher } from '../events/time-attendance-events.publisher.js';
import { AttendanceCorrectionService } from '../services/attendance-correction.service.js';

@CommandHandler('ApplyAttendanceCorrectionRequest')
@Injectable()
export class ApplyAttendanceCorrectionRequestHandler {
  constructor(
    private readonly correctionRepo: AttendanceCorrectionRequestRepository,
    private readonly dailyLedgerRepo: AttendanceDailyLedgerRepository,
    private readonly timeClockEventRepo: TimeClockEventRepository,
    private readonly correctionService: AttendanceCorrectionService,
    private readonly publisher: TimeAttendanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { correctionRequestId: Uuid };
    const request = await this.correctionRepo.findById(payload.correctionRequestId);
    if (!request) throw new Error('Correction request not found');

    const lockedSnapshots = await this.dailyLedgerRepo.findByDate(command.tenantId, request.workDate);
    if (lockedSnapshots.some((snapshot) => snapshot.locked)) {
      throw new Error('Correction cannot be applied after the attendance ledger is locked');
    }

    const appliedEventId = Uuid.generate();
    const applied = this.correctionService.apply(request, {
      appliedBy: command.actor.actorId.value,
      appliedEventId: appliedEventId.value,
    });

    if (applied.clockEventMutation?.operation === 'CREATE') {
      const draft = applied.clockEventMutation.event;
      const clockEvent = TimeClockEvent.record({
        id: new Uuid(draft.id),
        tenantId: new Uuid(draft.tenantId),
        workerId: new Uuid(draft.workerId),
        eventType: draft.eventType,
        timestamp: draft.timestamp,
        location: draft.location,
        deviceId: draft.deviceId,
      }, command.correlationId);
      await this.timeClockEventRepo.save(clockEvent);
      await this.publisher.publishFromAggregate(clockEvent);
    } else if (applied.clockEventMutation?.operation === 'UPDATE') {
      const target = await this.timeClockEventRepo.findById(new Uuid(applied.clockEventMutation.targetEventId));
      if (!target) throw new Error('Target clock event not found');
      if (target.workerId.value !== request.workerId) throw new Error('Target clock event belongs to a different employee');
      target.eventType = applied.clockEventMutation.eventType;
      target.timestamp = applied.clockEventMutation.timestamp;
      target.deviceId = applied.clockEventMutation.deviceId;
      target.updatedAt = new Date();
      target.incrementVersion();
      await this.timeClockEventRepo.save(target);
    } else if (applied.clockEventMutation?.operation === 'DELETE') {
      const target = await this.timeClockEventRepo.findById(new Uuid(applied.clockEventMutation.targetEventId));
      if (!target) throw new Error('Target clock event not found');
      if (target.workerId.value !== request.workerId) throw new Error('Target clock event belongs to a different employee');
      await this.timeClockEventRepo.delete(new Uuid(applied.clockEventMutation.targetEventId));
    }

    const saved = await this.correctionRepo.save(applied.request);

    return {
      success: true,
      data: saved,
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: new Uuid(saved.id),
      newState: saved.status,
      newVersion: 0,
      allowedNextActions: [],
      eventsEmitted: ['AttendanceCorrectionRequestApplied'],
      auditRecordId: command.commandId,
    fieldAccessDecisions: {},
    } as CommandResult<unknown>;
  }
}
