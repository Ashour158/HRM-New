import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrKnowledgeArticleRepository } from '../repositories/hr-knowledge-article.repository.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';

@CommandHandler('PublishHrKnowledgeArticle')
@Injectable()
export class PublishHrKnowledgeArticleHandler {
  constructor(
    private readonly repo: HrKnowledgeArticleRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrServiceDeliveryEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { hrKnowledgeArticleId: Uuid };
    const ar = await this.repo.findById(payload.hrKnowledgeArticleId);
    if (!ar) throw new Error('HR knowledge article not found');
    ar.publish(command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { hrKnowledgeArticleId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'HrKnowledgeArticle'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
