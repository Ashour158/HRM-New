import { describe, expect, it } from 'vitest';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { PolicyDocumentFsmRegistrar } from './policy-document.fsm.js';

/**
 * Regression coverage for HCM-P0-18: PolicyDocument's FSM previously
 * registered its submit-for-approval transition under the bare action name
 * 'SubmitForApproval', which country-policy-pack.fsm.ts also uses for a
 * different aggregate -- a live collision risk in CommandBus's global
 * (commandName -> handler) map. Fixed by renaming to the aggregate-qualified
 * 'SubmitPolicyDocumentForApproval', matching the HCM-P0-7 remediation
 * pattern (see recruiting-fsm-command-names.test.ts).
 */
describe('PolicyDocument FSM command name alignment', () => {
  it('allows SubmitPolicyDocumentForApproval from DRAFT', () => {
    const fsm = new FsmFramework();
    new PolicyDocumentFsmRegistrar(fsm).onModuleInit();

    const allowed = fsm.getAllowedActionsFromState('DRAFT', 'PolicyDocument');

    expect(allowed).toContain('SubmitPolicyDocumentForApproval');
    expect(allowed).not.toContain('SubmitForApproval');
  });
});
