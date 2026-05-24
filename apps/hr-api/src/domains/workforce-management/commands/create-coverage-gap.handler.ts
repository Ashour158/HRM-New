import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { CoverageGap } from '../aggregates/coverage-gap.aggregate.js';
import { CoverageGapRepository } from '../repositories/coverage-gap.repository.js';
import { WorkforceManagementEventsPublisher } from '../events/workforce-management-events.publisher.js';

@CommandHandler('CreateCoverageGap')
@Injectable()
export class CreateCoverageGapHandler {
  constructor(
    private readonly repo: CoverageGapRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: WorkforceManagementEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      departmentId: Uuid;
      shiftDate: Date;
      startTime: Date;
      endTime: Date;
      requiredSkills?: string[];
    };
    const ar = CoverageGap.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        departmentId: payload.departmentId,
        shiftDate: payload.shiftDate,
        startTime: payload.startTime,
        endTime: payload.endTime,
        requiredSkills: payload.requiredSkills,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { coverageGapId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'CoverageGap'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
