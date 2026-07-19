import { describe, expect, it } from 'vitest';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { registerEmploymentRelationshipFsm } from './employment-relationship.fsm.js';

/**
 * Regression coverage for HCM-P0-8: StartProbation/ConfirmEmployment were
 * bare, non-aggregate-qualified action names -- the same naming shape that
 * caused the HCM-P0-7 cross-aggregate collision in CommandBus's global
 * (commandName -> handler) map. Renamed to StartProbationEmploymentRelationship
 * and CompleteProbationEmploymentRelationship (the latter also matching the
 * command name ProbationPeriodEndJob's scheduler already dispatches).
 */
describe('EmploymentRelationship FSM command name alignment', () => {
  it('allows StartProbationEmploymentRelationship from ACTIVE and CompleteProbationEmploymentRelationship from PROBATION', () => {
    const fsm = new FsmFramework();
    registerEmploymentRelationshipFsm(fsm);

    const activeActions = fsm.getAllowedActionsFromState('ACTIVE', 'EmploymentRelationship');
    expect(activeActions).toContain('StartProbationEmploymentRelationship');
    expect(activeActions).not.toContain('StartProbation');

    const probationActions = fsm.getAllowedActionsFromState('PROBATION', 'EmploymentRelationship');
    expect(probationActions).toContain('CompleteProbationEmploymentRelationship');
    expect(probationActions).not.toContain('ConfirmEmployment');
  });
});
