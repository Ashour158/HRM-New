import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { Competency } from '../aggregates/competency.aggregate.js';
import { CompetencyRepository } from '../repositories/competency.repository.js';
import { PerformanceEventsPublisher } from '../events/performance-events.publisher.js';

@CommandHandler('CreateCompetency')
@Injectable()
export class CreateCompetencyHandler {
  constructor(
    private readonly repo: CompetencyRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: PerformanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      name: string;
      description?: string;
      category: string;
      behavioralIndicators: string[];
      proficiencyLevels: Array<{ level: number; description: string; expectedBehaviors: string[] }>;
    };
    const ar = Competency.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        name: payload.name,
        description: payload.description,
        category: payload.category,
        behavioralIndicators: payload.behavioralIndicators,
        proficiencyLevels: payload.proficiencyLevels,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { competencyId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'Competency'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
