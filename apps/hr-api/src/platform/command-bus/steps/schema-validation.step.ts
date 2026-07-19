import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { CommandPipelineStep } from '@hcm/command-contracts';
import { makeError } from '../command-bus-errors.js';

/** Guards that a command carries a payload before any downstream step reads it. */
export class SchemaValidationStep {
  async validate(command: HrCommandEnvelope<unknown>): Promise<void> {
    if (command.payload === undefined || command.payload === null) {
      throw makeError(command, CommandPipelineStep.VALIDATE_COMMAND_SCHEMA, 'INVALID_PAYLOAD', 'Command payload is required', false);
    }
  }
}
