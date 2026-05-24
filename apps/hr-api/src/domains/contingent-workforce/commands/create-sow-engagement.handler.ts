import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { SowEngagement } from '../aggregates/sow-engagement.aggregate.js';
import { SowEngagementRepository } from '../repositories/sow-engagement.repository.js';
import { ContingentWorkforceEventsPublisher } from '../events/contingent-workforce-events.publisher.js';

@CommandHandler('CreateSowEngagement')
@Injectable()
export class CreateSowEngagementHandler {
  constructor(
    private readonly repo: SowEngagementRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: ContingentWorkforceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { sowNumber: string; vendorId: Uuid; projectName: string; totalValue: number; currency: string; startDate: Date; endDate: Date; milestones?: string[] };
    const ar = SowEngagement.create({ id: Uuid.generate(), tenantId: command.tenantId, ...payload }, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { sowEngagementId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'SowEngagement'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
