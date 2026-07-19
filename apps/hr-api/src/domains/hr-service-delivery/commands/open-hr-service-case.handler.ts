import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { toOptionalDate, toOptionalUuid, toUuid } from '../../common/uuid-normalizer.js';
import { HrServiceCase } from '../aggregates/hr-service-case.aggregate.js';
import { HrServiceCaseRepository } from '../repositories/hr-service-case.repository.js';
import { HrServiceCatalogItemRepository } from '../repositories/hr-service-catalog-item.repository.js';
import { HrServiceDeliveryEventsPublisher } from '../events/hr-service-delivery-events.publisher.js';
import { deriveOwnerGroupFromCatalogItem, deriveSlaDeadlineFromCatalogItem } from './catalog-linkage.util.js';

@CommandHandler('OpenHrServiceCase')
@Injectable()
export class OpenHrServiceCaseHandler {
  constructor(
    private readonly repo: HrServiceCaseRepository,
    private readonly catalogItemRepo: HrServiceCatalogItemRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: HrServiceDeliveryEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      caseNumber: string;
      requesterWorkerId: Uuid | string;
      caseType: string;
      priority: string;
      description: string;
      assignedTo?: Uuid | string;
      slaDeadline?: Date | string;
      catalogItemId?: Uuid | string;
      ownerGroup?: string;
    };

    const catalogItemId = toOptionalUuid(payload.catalogItemId);
    let slaDeadline = toOptionalDate(payload.slaDeadline);
    let ownerGroup = payload.ownerGroup;

    if (catalogItemId) {
      const catalogItem = await this.catalogItemRepo.findById(catalogItemId);
      if (!catalogItem) throw new Error('HR service catalog item not found');
      // Auto-derive the SLA target from the catalog item's configured SLA
      // hours unless the caller explicitly supplied a deadline override.
      slaDeadline = slaDeadline ?? deriveSlaDeadlineFromCatalogItem(catalogItem);
      // Auto-suggest the owner group from the catalog item's configured
      // default owner group (or category as a fallback) unless the caller
      // explicitly supplied one.
      ownerGroup = ownerGroup ?? deriveOwnerGroupFromCatalogItem(catalogItem);
    }

    const ar = HrServiceCase.open(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        caseNumber: payload.caseNumber,
        requesterWorkerId: toUuid(payload.requesterWorkerId),
        caseType: payload.caseType,
        priority: payload.priority,
        description: payload.description,
        assignedTo: toOptionalUuid(payload.assignedTo),
        slaDeadline,
        catalogItemId,
        ownerGroup,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: {
        hrServiceCaseId: ar.id.value,
        caseNumber: ar.caseNumber,
        caseType: ar.caseType,
        priority: ar.priority,
        status: ar.status,
        catalogItemId: ar.catalogItemId?.value,
        ownerGroup: ar.ownerGroup,
        slaDeadline: ar.slaDeadline?.toISOString(),
      },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'HrServiceCase'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
