import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { CommandPipelineStep } from '@hcm/command-contracts';
import { AccessControlService } from '@hcm/access-control';
import { makeError } from '../command-bus-errors.js';
import { inferActionFromCommand } from '../command-bus.utils.js';

/** Segregation-of-duties gate. */
export class SodStep {
  constructor(private readonly accessControl: AccessControlService) {}

  async evaluate(command: HrCommandEnvelope<unknown>): Promise<void> {
    const action = inferActionFromCommand(command.commandName);
    const result = this.accessControl.checkSoD(action, command.actor.roles);
    if (result.violated) {
      throw makeError(
        command,
        CommandPipelineStep.EVALUATE_SOD_POLICY,
        'SOD_VIOLATION',
        result.message ?? 'Segregation of duties violation',
        false,
      );
    }
  }
}
