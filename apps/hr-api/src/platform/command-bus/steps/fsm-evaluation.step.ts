import type { AggregateRoot } from '@hcm/shared-kernel';
import type { HrCommandEnvelope } from '@hcm/command-contracts';
import { CommandPipelineStep } from '@hcm/command-contracts';
import { makeError } from '../command-bus-errors.js';
import { inferFsmActionCandidates } from '../command-bus.utils.js';
import type { FsmInstance } from '../../workflow/fsm-framework.js';
import { FsmFramework } from '../../workflow/fsm-framework.js';

/** Workflow guard: validates expected state/version and the FSM-allowed action set. */
export class FsmEvaluationStep {
  constructor(private readonly fsmFramework: FsmFramework) {}

  async evaluate(
    command: HrCommandEnvelope<unknown>,
    aggregate?: AggregateRoot,
  ): Promise<void> {
    if (!command.expectedState) {
      return;
    }
    if (!aggregate) {
      throw makeError(
        command,
        CommandPipelineStep.EVALUATE_WORKFLOW_GUARD_EXPECTED_STATE_VERSION_EFFECTIVE_DATE,
        'AGGREGATE_NOT_LOADED',
        `Could not load ${command.aggregateType} ${command.aggregateId?.value ?? '<missing>'} for FSM validation`,
        false,
      );
    }
    const aggregateVersion = typeof aggregate.version === 'string'
      ? Number(aggregate.version)
      : aggregate.version;
    const expectedVersion = typeof command.expectedVersion === 'string'
      ? Number(command.expectedVersion)
      : command.expectedVersion;
    if (
      expectedVersion !== undefined &&
      (!Number.isFinite(aggregateVersion) || !Number.isFinite(expectedVersion) || aggregateVersion !== expectedVersion)
    ) {
      throw makeError(
        command,
        CommandPipelineStep.EVALUATE_WORKFLOW_GUARD_EXPECTED_STATE_VERSION_EFFECTIVE_DATE,
        'AGGREGATE_VERSION_CONFLICT',
        `Expected aggregate version ${command.expectedVersion}, found ${aggregate.version}`,
        false,
      );
    }
    const fsmInstance: FsmInstance<string> = {
      aggregateId: command.aggregateId!,
      aggregateType: command.aggregateType,
      currentState: command.expectedState,
      version: aggregateVersion,
      history: [],
    };
    const allowed = this.fsmFramework.getAllowedActions(fsmInstance);
    const actionCandidates = inferFsmActionCandidates(command.commandName, command.aggregateType);
    if (!actionCandidates.some((action) => allowed.includes(action))) {
      throw makeError(
        command,
        CommandPipelineStep.EVALUATE_WORKFLOW_GUARD_EXPECTED_STATE_VERSION_EFFECTIVE_DATE,
        'FSM_TRANSITION_NOT_ALLOWED',
        `Action ${actionCandidates[0]} not allowed from state ${fsmInstance.currentState}`,
        false,
      );
    }
  }
}
