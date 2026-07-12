import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import { CountryPolicyPackRepository } from '../repositories/country-policy-pack.repository.js';

export interface SubmitForLegalReviewPayload {
  packId: string;
}

/**
 * Handler for the SubmitForLegalReview command.
 */
@Injectable()
@CommandHandler('SubmitForLegalReview')
export class SubmitCountryPolicyPackForLegalReviewHandler implements ICommandHandler {
  readonly commandName = 'SubmitForLegalReview';

  constructor(
    private readonly repo: CountryPolicyPackRepository,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as SubmitForLegalReviewPayload;
    const pack = await this.repo.findById(new Uuid(payload.packId));
    if (!pack) {
      throw new ValidationError('Country policy pack not found');
    }

    pack.submitForLegalReview(command.correlationId);
    await this.repo.save(pack);

    return {
      success: true,
      data: { packId: pack.id.value, status: pack.status },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: pack.id,
      newState: pack.status,
      newVersion: pack.aggregateVersion,
      allowedNextActions: [
        'SubmitForPayrollTaxReview',
        'SubmitForGlobalHRReview',
        'SubmitForBenefitsReview',
        'SubmitForAbsenceReview',
        'SubmitForComplianceReview',
        'SubmitCountryPolicyPackForApproval',
      ],
      fieldAccessDecisions: {},
      eventsEmitted: pack.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
