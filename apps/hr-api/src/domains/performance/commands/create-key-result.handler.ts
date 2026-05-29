import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { KeyResult } from '../aggregates/key-result.aggregate.js';
import { KeyResultRepository } from '../repositories/key-result.repository.js';
import { PerformanceEventsPublisher } from '../events/performance-events.publisher.js';

@CommandHandler('CreateKeyResult')
@Injectable()
export class CreateKeyResultHandler {
  constructor(
    private readonly repo: KeyResultRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: PerformanceEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as {
      objectiveId: string;
      title: string;
      description?: string;
      targetValue: number;
      currentValue?: number;
      startValue?: number;
      unit?: string;
      dueDate?: Date;
      weight?: number;
    };
    const ar = KeyResult.create(
      {
        id: Uuid.generate(),
        tenantId: command.tenantId,
        objectiveId: new Uuid(payload.objectiveId),
        title: payload.title,
        description: payload.description,
        targetValue: payload.targetValue,
        currentValue: payload.currentValue ?? 0,
        startValue: payload.startValue ?? 0,
        unit: payload.unit,
        dueDate: payload.dueDate,
      },
      command.correlationId,
    );
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { keyResultId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'KeyResult'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
