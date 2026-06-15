import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import { Uuid } from '@hcm/shared-kernel';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { toOptionalDate, toOptionalUuid, toUuid } from '../../common/uuid-normalizer.js';
import { EapReferral } from '../aggregates/eap-referral.aggregate.js';
import { EapReferralRepository } from '../repositories/eap-referral.repository.js';
import { WellbeingEapEventsPublisher } from '../events/wellbeing-eap-events.publisher.js';

@CommandHandler('CreateEapReferral')
@Injectable()
export class CreateEapReferralHandler {
  constructor(
    private readonly repo: EapReferralRepository,
    private readonly fsm: FsmFramework,
    private readonly publisher: WellbeingEapEventsPublisher,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as { workerId: Uuid | string; reason: string; scheduledDate?: Date | string; completedDate?: Date | string; providerId?: Uuid | string; notes?: string };
    const ar = EapReferral.create({
      id: Uuid.generate(),
      tenantId: command.tenantId,
      workerId: toUuid(payload.workerId),
      reason: payload.reason,
      scheduledDate: toOptionalDate(payload.scheduledDate),
      completedDate: toOptionalDate(payload.completedDate),
      providerId: toOptionalUuid(payload.providerId),
      notes: payload.notes,
    }, command.correlationId);
    await this.repo.save(ar);
    await this.publisher.publishFromAggregate(ar);
    return {
      success: true,
      data: { eapReferralId: ar.id.value, status: ar.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: ar.id,
      newState: ar.status,
      newVersion: ar.aggregateVersion,
      allowedNextActions: this.fsm.getAllowedActionsFromState(ar.status, 'EapReferral'),
      eventsEmitted: ar.domainEvents.map((e) => e.eventName),
      auditRecordId: command.commandId,
    } as CommandResult<unknown>;
  }
}
