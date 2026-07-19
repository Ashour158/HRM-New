import { describe, expect, it } from 'vitest';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { CountryPolicyPackFsmRegistrar } from './country-policy-pack.fsm.js';
import { PolicyDocumentFsmRegistrar } from '../../compliance/fsm/policy-document.fsm.js';

/**
 * Regression coverage for HCM-P0-19: CountryPolicyPack's FSM previously
 * registered its submit-for-approval transition under the bare action name
 * 'SubmitForApproval', which compliance/policy-document.fsm.ts also used for
 * a different aggregate -- a live collision risk in CommandBus's global
 * (commandName -> handler) map. Fixed by renaming to the aggregate-qualified
 * 'SubmitCountryPolicyPackForApproval', matching the HCM-P0-7/HCM-P0-18
 * remediation pattern.
 */
describe('CountryPolicyPack FSM command name alignment', () => {
  it('allows SubmitCountryPolicyPackForApproval from every review-pending state', () => {
    const fsm = new FsmFramework();
    new CountryPolicyPackFsmRegistrar(fsm).onModuleInit();

    for (const state of [
      'IMPACT_SIMULATED',
      'LEGAL_REVIEW_PENDING',
      'PAYROLL_TAX_REVIEW_PENDING',
      'GLOBAL_HR_REVIEW_PENDING',
      'BENEFITS_REVIEW_PENDING',
      'ABSENCE_REVIEW_PENDING',
      'COMPLIANCE_REVIEW_PENDING',
    ]) {
      const allowed = fsm.getAllowedActionsFromState(state, 'CountryPolicyPack');
      expect(allowed, `expected SubmitCountryPolicyPackForApproval to be allowed from ${state}`).toContain(
        'SubmitCountryPolicyPackForApproval',
      );
      expect(allowed).not.toContain('SubmitForApproval');
    }
  });

  it('CountryPolicyPack and PolicyDocument submit-for-approval action names do not collide', () => {
    const fsm = new FsmFramework();
    new CountryPolicyPackFsmRegistrar(fsm).onModuleInit();
    new PolicyDocumentFsmRegistrar(fsm).onModuleInit();

    const countryPolicyPackActions = fsm.getAllowedActionsFromState('IMPACT_SIMULATED', 'CountryPolicyPack');
    const policyDocumentActions = fsm.getAllowedActionsFromState('DRAFT', 'PolicyDocument');

    const overlap = countryPolicyPackActions.filter((action) => policyDocumentActions.includes(action));
    expect(overlap).toEqual([]);
  });
});
