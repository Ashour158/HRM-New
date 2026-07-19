import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { CommandPipelineStep } from '@hcm/command-contracts';
import { AccessControlService } from '@hcm/access-control';
import { makeError } from '../command-bus-errors.js';
import { inferCommandType } from '../command-bus.utils.js';

/** Segregation-of-duties gate. */
export class SodStep {
  constructor(private readonly accessControl: AccessControlService) {}

  async evaluate(command: HrCommandEnvelope<unknown>): Promise<void> {
    // checkSoD requires the full command shape (not just the command name)
    // so the permission the command actually requires can be correctly
    // inferred -- a preparer/approver conflict can only be detected when we
    // know which side of the pair (e.g. PAYROLL_CREATE vs PAYROLL_APPROVE)
    // the current action is on (HCM-P0-5).
    const acCommand = {
      commandName: command.commandName,
      commandType: inferCommandType(command.commandName),
      aggregateType: command.aggregateType,
      aggregateId: command.aggregateId,
      payload: command.payload as Record<string, unknown>,
    };
    const result = this.accessControl.checkSoD(acCommand, command.actor.roles);
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
