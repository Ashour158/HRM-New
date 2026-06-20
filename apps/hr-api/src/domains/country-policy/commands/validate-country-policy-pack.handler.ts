import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import { evaluateCountryPolicyPackValidation } from '@hcm/policy-engines';
import { HcmSetupService } from '../../hcm-setup/hcm-setup.service.js';
import { CountryPolicyPackRepository } from '../repositories/country-policy-pack.repository.js';
import { CountryPolicyValidationRunRepository } from '../repositories/country-policy-validation-run.repository.js';
import { CountryPolicyValidationRun } from '../aggregates/country-policy-validation-run.aggregate.js';

export interface ValidateCountryPolicyPackPayload {
  packId: string;
  validationRunId: string;
  validationType: string;
}

/**
 * Handler for the ValidateCountryPolicyPack command.
 */
@Injectable()
@CommandHandler('ValidateCountryPolicyPack')
export class ValidateCountryPolicyPackHandler implements ICommandHandler {
  readonly commandName = 'ValidateCountryPolicyPack';

  constructor(
    private readonly packRepo: CountryPolicyPackRepository,
    private readonly runRepo: CountryPolicyValidationRunRepository,
    private readonly hcmSetupService: HcmSetupService,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as ValidateCountryPolicyPackPayload;
    const pack = await this.packRepo.findById(new Uuid(payload.packId));
    if (!pack) {
      throw new ValidationError('Country policy pack not found');
    }
    const setup = await this.hcmSetupService.getSetup(command.tenantId);
    const runtime = (setup.countryPolicyRuntime ?? {}) as {
      validationEnabled?: boolean;
      allowedCountryCodes?: string[];
      requiredValidationTypes?: string[];
      policyEvidenceRevisionId?: string;
    };
    if (runtime.validationEnabled === false) {
      throw new ValidationError('Country policy validation is disabled by the applied country policy runtime');
    }
    const packCountryCode = (pack as unknown as { countryCode?: string }).countryCode;
    if (packCountryCode && runtime.allowedCountryCodes?.length && !runtime.allowedCountryCodes.includes(packCountryCode)) {
      throw new ValidationError(`Country ${packCountryCode} is not enabled by the applied country policy runtime`);
    }
    if (runtime.requiredValidationTypes?.length && !runtime.requiredValidationTypes.includes(payload.validationType)) {
      throw new ValidationError(`Validation type ${payload.validationType} is not enabled by the applied country policy runtime`);
    }

    const run = CountryPolicyValidationRun.create(
      {
        id: new Uuid(payload.validationRunId),
        tenantId: command.tenantId,
        policyPackId: pack.id,
        validationType: payload.validationType,
      },
      command.correlationId,
    );
    run.start(command.correlationId);

    // Real structural/semantic validation via the country-policy validation engine.
    const validation = evaluateCountryPolicyPackValidation({
      countryCode: pack.countryCode,
      sections: pack.sections,
      requiredApprovals: pack.requiredApprovals,
      sourceEvidence: pack.sourceEvidence,
      effectiveFrom: pack.effectiveFrom,
      effectiveUntil: pack.effectiveUntil,
      validationType: payload.validationType,
    });

    const results: Record<string, unknown> = {
      valid: validation.valid,
      decisionCode: validation.decisionCode,
      violations: validation.violations,
      policyEvidence: {
        engine: 'country-policy-validation',
        revisionId: runtime.policyEvidenceRevisionId,
        validationEnabled: runtime.validationEnabled ?? true,
        allowedCountryCodes: runtime.allowedCountryCodes,
        requiredValidationTypes: runtime.requiredValidationTypes,
      },
    };

    if (validation.valid) {
      run.complete(command.correlationId, results);
      pack.validate(command.correlationId, run.id, true);
    } else {
      run.fail(command.correlationId, 'Validation failed', {
        errors: validation.violations.filter((v) => v.severity === 'ERROR'),
      });
      pack.validate(command.correlationId, run.id, false);
    }

    await this.runRepo.save(run);
    await this.packRepo.save(pack);

    return {
      success: true,
      data: {
        packId: pack.id.value,
        status: pack.status,
        validationRunId: run.id.value,
        valid: validation.valid,
        decisionCode: validation.decisionCode,
        violations: validation.violations,
        policyEvidence: results.policyEvidence,
      },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: pack.id,
      newState: pack.status,
      newVersion: pack.aggregateVersion,
      allowedNextActions: validation.valid ? ['RequireImpactSimulation'] : ['Quarantine'],
      fieldAccessDecisions: {},
      eventsEmitted: [...pack.domainEvents.map((e) => e.eventName), ...run.domainEvents.map((e) => e.eventName)],
      auditRecordId: Uuid.generate(),
    };
  }
}
