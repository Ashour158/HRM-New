import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { CalculatedFieldRepository } from '../repositories/calculated-field.repository.js';
import { ReportingEventsPublisher } from '../events/reporting-events.publisher.js';

export interface DeprecateCalculatedFieldPayload {
  calculatedFieldId: string;
}

@Injectable()
@CommandHandler('DeprecateCalculatedField')
export class DeprecateCalculatedFieldHandler {
  constructor(
    private readonly repo: CalculatedFieldRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ReportingEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as DeprecateCalculatedFieldPayload;
    const entity = await this.repo.findById(new Uuid(payload.calculatedFieldId));
    if (!entity) throw new Error('CalculatedField not found');
    entity.deprecate(command.correlationId);
    await this.repo.save(entity);
    await this.publisher.publishFromAggregate(entity);
    return {
      success: true,
      data: { calculatedFieldId: entity.id.value, status: entity.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: entity.id,
      newState: entity.status,
      newVersion: entity.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(entity.status, 'CalculatedField'),
      fieldAccessDecisions: {},
      eventsEmitted: entity.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
