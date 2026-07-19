import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import { CountryPolicyPackRepository } from '../repositories/country-policy-pack.repository.js';

export interface SubmitCountryPolicyPackForApprovalPayload {
  packId: string;
}

/**
 * Handler for the SubmitCountryPolicyPackForApproval command.
 *
 * Delegates to {@link CountryPolicyPack.submitForApproval}, which is the
 * real review gate: it rejects the transition unless every entry in
 * `requiredApprovals` has a matching entry in `completedReviews`.
 *
 * NOTE: registered under the aggregate-qualified command name (not the bare
 * `SubmitForApproval`) because `PolicyDocument`'s FSM also uses the bare name
 * for its own submit-for-approval transition, and CommandBus's handler
 * registry is a single global `commandName -> handler` map (see
 * `country-policy-pack-fsm-command-names.test.ts`, HCM-P0-19).
 */
@Injectable()
@CommandHandler('SubmitCountryPolicyPackForApproval')
export class SubmitCountryPolicyPackForApprovalHandler implements ICommandHandler {
  readonly commandName = 'SubmitCountryPolicyPackForApproval';

  constructor(
    private readonly repo: CountryPolicyPackRepository,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as SubmitCountryPolicyPackForApprovalPayload;
    const pack = await this.repo.findById(new Uuid(payload.packId));
    if (!pack) {
      throw new ValidationError('Country policy pack not found');
    }

    pack.submitForApproval(command.correlationId);
    await this.repo.save(pack);

    return {
      success: true,
      data: { packId: pack.id.value, status: pack.status, completedReviews: pack.completedReviews },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: pack.id,
      newState: pack.status,
      newVersion: pack.aggregateVersion,
      allowedNextActions: ['ApproveCountryPolicyPack', 'RejectCountryPolicyPack'],
      fieldAccessDecisions: {},
      eventsEmitted: pack.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
