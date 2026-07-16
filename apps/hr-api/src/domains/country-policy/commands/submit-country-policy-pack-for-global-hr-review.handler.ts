import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import { CountryPolicyPackRepository } from '../repositories/country-policy-pack.repository.js';

export interface SubmitCountryPolicyPackForGlobalHRReviewPayload {
  packId: string;
}

/**
 * Handler for the SubmitForGlobalHRReview command.
 */
@Injectable()
@CommandHandler('SubmitForGlobalHRReview')
export class SubmitCountryPolicyPackForGlobalHRReviewHandler implements ICommandHandler {
  readonly commandName = 'SubmitForGlobalHRReview';

  constructor(
    private readonly repo: CountryPolicyPackRepository,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as SubmitCountryPolicyPackForGlobalHRReviewPayload;
    const pack = await this.repo.findById(new Uuid(payload.packId));
    if (!pack) {
      throw new ValidationError('Country policy pack not found');
    }

    pack.submitForGlobalHRReview(command.correlationId);
    await this.repo.save(pack);

    return {
      success: true,
      data: { packId: pack.id.value, status: pack.status, completedReviews: pack.completedReviews },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: pack.id,
      newState: pack.status,
      newVersion: pack.aggregateVersion,
      allowedNextActions: [
        'SubmitForLegalReview',
        'SubmitForPayrollTaxReview',
        'SubmitForBenefitsReview',
        'SubmitForAbsenceReview',
        'SubmitForComplianceReview',
        'SubmitForApproval',
      ],
      fieldAccessDecisions: {},
      eventsEmitted: pack.domainEvents.map((e) => e.eventName),
      auditRecordId: Uuid.generate(),
    };
  }
}
