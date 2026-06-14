import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { HrServiceCatalogItem } from '../aggregates/hr-service-catalog-item.aggregate.js';
import { HrServiceCatalogItemRepository } from '../repositories/hr-service-catalog-item.repository.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';

@CommandHandler('CreateHrServiceCatalogItem')
@Injectable()
export class CreateHrServiceCatalogItemHandler {
  constructor(
    private readonly repo: HrServiceCatalogItemRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrServiceDeliveryEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { serviceCode: string; serviceName: string; description: string; category: string; slaHours: number; fulfillmentProcess: string };
    const ar = HrServiceCatalogItem.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        serviceCode: payload.serviceCode,
        serviceName: payload.serviceName,
        description: payload.description,
        category: payload.category,
        slaHours: payload.slaHours,
        fulfillmentProcess: payload.fulfillmentProcess,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { hrServiceCatalogItemId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'HrServiceCatalogItem'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
