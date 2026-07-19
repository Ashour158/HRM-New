import { Uuid } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { CommandPipelineStep } from '@hcm/command-contracts';
import { makeError } from '../command-bus-errors.js';
import { readUuidValue } from '../command-bus.utils.js';

const VALID_ACTOR_TYPES = ['USER', 'SYSTEM', 'SERVICE_ACCOUNT', 'INTEGRATION'];

/** First pipeline gate: the command actor must be a well-formed, roled principal. */
export class ActorAuthStep {
  async authenticate(command: HrCommandEnvelope<unknown>): Promise<void> {
    const actorId = readUuidValue(command.actor?.actorId);
    const actorType = command.actor?.actorType;
    if (!actorType || !VALID_ACTOR_TYPES.includes(actorType) || !actorId || !Uuid.isValid(actorId)) {
      throw makeError(
        command,
        CommandPipelineStep.AUTHENTICATE_ACTOR,
        'UNAUTHENTICATED_ACTOR',
        'Command actor must be authenticated with a valid UUID actor id',
        false,
      );
    }
    if (!Array.isArray(command.actor.roles) || command.actor.roles.length === 0) {
      throw makeError(
        command,
        CommandPipelineStep.AUTHENTICATE_ACTOR,
        'UNAUTHENTICATED_ACTOR',
        'Command actor must have at least one role',
        false,
      );
    }
  }
}
