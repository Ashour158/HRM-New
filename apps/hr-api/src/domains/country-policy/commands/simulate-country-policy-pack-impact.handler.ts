import { Injectable } from '@nestjs/common';
import { CommandHandler } from '../../../platform/command-bus/command-handler.decorator.js';
import type { HrCommandEnvelope, CommandResult } from '@hcm/command-contracts';
import type { CommandHandler as ICommandHandler } from '../../../platform/command-bus/command-bus.js';
import { Uuid, ValidationError } from '@hcm/shared-kernel';
import { evaluateCountryPolicyPackImpact } from '@hcm/policy-engines';
import { CountryPolicyPackRepository } from '../repositories/country-policy-pack.repository.js';
import { CountryPolicyImpactSimulationRepository } from '../repositories/country-policy-impact-simulation.repository.js';
import { CountryPolicyImpactSimulation } from '../aggregates/country-policy-impact-simulation.aggregate.js';

export interface SimulateCountryPolicyPackImpactPayload {
  packId: string;
  simulationRunId: string;
  simulationScope: string;
}

/**
 * Handler for the SimulateCountryPolicyPackImpact command.
 */
@Injectable()
@CommandHandler('SimulateCountryPolicyPackImpact')
export class SimulateCountryPolicyPackImpactHandler implements ICommandHandler {
  readonly commandName = 'SimulateCountryPolicyPackImpact';

  constructor(
    private readonly packRepo: CountryPolicyPackRepository,
    private readonly simRepo: CountryPolicyImpactSimulationRepository,
  ) {}

  async handle(command: HrCommandEnvelope<unknown>): Promise<CommandResult<unknown>> {
    const payload = command.payload as SimulateCountryPolicyPackImpactPayload;
    const pack = await this.packRepo.findById(new Uuid(payload.packId));
    if (!pack) {
      throw new ValidationError('Country policy pack not found');
    }

    const sim = CountryPolicyImpactSimulation.create(
      {
        id: new Uuid(payload.simulationRunId),
        tenantId: command.tenantId,
        policyPackId: pack.id,
      },
      command.correlationId,
    );
    sim.start(command.correlationId);

    // Real structural impact estimation derived from the pack's sections.
    const impact = evaluateCountryPolicyPackImpact({ sections: pack.sections });
    const results: Record<string, unknown> = {
      scope: payload.simulationScope,
      impactLevel: impact.impactLevel,
      impactedDomains: impact.impactedDomains,
      impactedSectionCount: impact.impactedSectionCount,
      recalculationRequired: impact.recalculationRequired,
    };

    sim.complete(command.correlationId, results, impact.impactLevel, {
      workers: [],
      payrollRuns: [],
      taxAssignments: [],
      leaveBalances: [],
      benefits: [],
    });
    pack.simulateImpact(command.correlationId, sim.id, impact.recalculationRequired);

    await this.simRepo.save(sim);
    await this.packRepo.save(pack);

    return {
      success: true,
      data: { packId: pack.id.value, status: pack.status, simulationRunId: sim.id.value },
      commandId: command.commandId,
      correlationId: command.correlationId,
      aggregateId: pack.id,
      newState: pack.status,
      newVersion: pack.aggregateVersion,
      allowedNextActions: ['SubmitForLegalReview', 'SubmitCountryPolicyPackForApproval'],
      fieldAccessDecisions: {},
      eventsEmitted: [...pack.domainEvents.map((e) => e.eventName), ...sim.domainEvents.map((e) => e.eventName)],
      auditRecordId: Uuid.generate(),
    };
  }
}
