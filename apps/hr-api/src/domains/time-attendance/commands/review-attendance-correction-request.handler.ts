import { Injectable } from '@nestjs/common';
import type { CommandResult, HrCommandEnvelope } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import { AttendanceCorrectionRequestRepository } from '../repositories/attendance-correction-request.repository.js';
import { AttendanceCorrectionService } from '../services/attendance-correction.service.js';

@CommandHandler('ReviewAttendanceCorrectionRequest')
@Injectable()
export class ReviewAttendanceCorrectionRequestHandler {
  constructor(
    private readonly repo: AttendanceCorrectionRequestRepository,
    private readonly service: AttendanceCorrectionService,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      correctionRequestId: Uuid;
      decision: 'APPROVE' | 'REJECT';
      note?: string;
    };
    const request = await this.repo.findById(payload.correctionRequestId);
    if (!request) throw new Error('Correction request not found');

    const reviewed = this.service.review(request, {
      reviewerId: command.actor.actorId.value,
      decision: payload.decision,
      note: payload.note,
    });
    const saved = await this.repo.save(reviewed);

    return {
      success: true,
      data: saved,
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: new Uuid(saved.id),
      newState: saved.status,
      newVersion: 0,
      allowedNextActions: saved.status === 'APPROVED' ? ['ApplyAttendanceCorrectionRequest'] : [],
      eventsEmitted: [`AttendanceCorrectionRequest${saved.status === 'APPROVED' ? 'Approved' : 'Rejected'}`],
      auditRecordId: command.commandId,
    fieldAccessDecisions: {},
    } as CommandResult<unknown>;
  }
}
