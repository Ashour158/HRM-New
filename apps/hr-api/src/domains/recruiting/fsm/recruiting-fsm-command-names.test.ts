import { describe, expect, it } from 'vitest';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';
import { JobRequisitionFsmRegistrar } from './job-requisition.fsm.js';
import { OfferFsmRegistrar } from './offer.fsm.js';

/**
 * Regression coverage for HCM-P0-7: both FSMs previously registered the
 * submit-for-approval transition under the bare action name
 * 'SubmitForApproval', which collided across aggregates in CommandBus's
 * global (commandName -> handler) map (apps/hr-api/src/platform/command-bus/command-bus.ts).
 * Handler command names must exactly match their FSM action names, since
 * the FSM guard step matches the raw command name with no fuzzy inference
 * for aggregate-type-embedded-mid-string cases.
 */
describe('Recruiting FSM command name alignment', () => {
  it('JobRequisition FSM allows SubmitJobRequisitionForApproval from DRAFT', () => {
    const fsm = new FsmFramework();
    new JobRequisitionFsmRegistrar(fsm).onModuleInit();

    const allowed = fsm.getAllowedActionsFromState('DRAFT', 'JobRequisition');

    expect(allowed).toContain('SubmitJobRequisitionForApproval');
    expect(allowed).not.toContain('SubmitForApproval');
  });

  it('Offer FSM allows SubmitOfferForApproval from DRAFT', () => {
    const fsm = new FsmFramework();
    new OfferFsmRegistrar(fsm).onModuleInit();

    const allowed = fsm.getAllowedActionsFromState('DRAFT', 'Offer');

    expect(allowed).toContain('SubmitOfferForApproval');
    expect(allowed).not.toContain('SubmitForApproval');
  });

  it('JobRequisition and Offer submit-for-approval action names do not collide', () => {
    const fsm = new FsmFramework();
    new JobRequisitionFsmRegistrar(fsm).onModuleInit();
    new OfferFsmRegistrar(fsm).onModuleInit();

    const jobRequisitionActions = fsm.getAllowedActionsFromState('DRAFT', 'JobRequisition');
    const offerActions = fsm.getAllowedActionsFromState('DRAFT', 'Offer');

    const overlap = jobRequisitionActions.filter((action) => offerActions.includes(action));
    expect(overlap).toEqual([]);
  });
});
