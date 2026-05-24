import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { LearningContentPackageRepository } from '../repositories/learning-content-package.repository.js';
import { LearningEventsPublisher } from '../events/learning-events.publisher.js';

@CommandHandler('ValidateLearningContentPackage')
@Injectable()
export class ValidateLearningContentPackageHandler {
  constructor(
    private readonly repo: LearningContentPackageRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: LearningEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { learningContentPackageId: Uuid };
    const ar = await this.repo.findById(payload.learningContentPackageId);
    if (!ar) throw new Error('Content package not found');
    ar.validate(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { learningContentPackageId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'LearningContentPackage'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
