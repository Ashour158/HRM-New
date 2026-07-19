import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { CommandPipelineStep } from '@hcm/command-contracts';
import { selfServiceAuthorityEngine } from '@hcm/policy-engines';
import { makeError } from '../command-bus-errors.js';
import { inferCommandType, mapActorType, resolveSubjectWorkerId } from '../command-bus.utils.js';

/** Self-service authority policy-engine gate. */
export class PolicyEngineStep {
  async evaluate(command: HrCommandEnvelope<unknown>): Promise<void> {
    if (command.actor.actorType === 'SYSTEM' || command.actor.actorType === 'SERVICE_ACCOUNT') {
      return;
    }
    if (command.aggregateType === 'ApprovalChain') {
      return;
    }

    const subjectWorkerId = resolveSubjectWorkerId(command);
    const decision = await selfServiceAuthorityEngine.execute({
      actorType: mapActorType(command.actor.actorType, command.actor.roles),
      commandName: command.commandName,
      actorRoles: command.actor.roles,
      abacContext: {
        aggregateType: command.aggregateType,
        aggregateId: command.aggregateId?.value,
        commandType: inferCommandType(command.commandName),
        subjectWorkerId: subjectWorkerId?.value,
        expectedState: command.expectedState,
        clientType: command.metadata.clientType,
      },
    }, {
      tenantId: command.tenantId,
      actorId: command.actor.actorId,
      correlationId: command.correlationId,
      effectiveDate: new Date(),
      workerId: subjectWorkerId,
    });

    if (decision.decisionCode === 'FORBIDDEN') {
      throw makeError(
        command,
        CommandPipelineStep.EVALUATE_LEGAL_HOLD_RETENTION_COUNTRY_LABOR_LAW_APPROVAL_STATE,
        'POLICY_ENGINE_DENIED',
        decision.explanation,
        false,
      );
    }
  }
}
