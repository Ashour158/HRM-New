import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { CalibrationSession } from '../aggregates/calibration-session.aggregate.js';
import { CalibrationSessionRepository } from '../repositories/calibration-session.repository.js';
import { PerformanceEventsPublisher } from '../events/performance-events.publisher.js';

@CommandHandler('CreateCalibrationSession')
@Injectable()
export class CreateCalibrationSessionHandler {
  constructor(
    private readonly repo: CalibrationSessionRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: PerformanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      reviewCycleId: Uuid;
      facilitatorId: Uuid;
      participants?: string[];
    };
    const ar = CalibrationSession.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        reviewCycleId: payload.reviewCycleId,
        facilitatorId: payload.facilitatorId,
        participants: payload.participants,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { calibrationSessionId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'CalibrationSession'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
