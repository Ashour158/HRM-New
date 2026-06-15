import { Inject, Injectable } from '@nestjs/common';
import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

/**
 * FSM service for CarrierReconciliationRun lifecycle management.
 *
 * States: PENDING → IN_PROGRESS → VARIANCE_DETECTED → RECONCILED
 *                                     ↘ RECONCILED
 *                                     ↘ FAILED (terminal)
 */
@Injectable()
export class CarrierReconciliationRunFsm {
  constructor(@Inject(FsmFramework) private readonly fsmFramework: FsmFramework) {}

  register(): void {
    const definition: FsmDefinition<string, string> = {
      aggregateType: 'CarrierReconciliationRun',
      states: ['PENDING', 'IN_PROGRESS', 'VARIANCE_DETECTED', 'RECONCILED', 'FAILED'],
      actions: ['Start', 'DetectVariance', 'Reconcile', 'Fail'],
      transitions: [
        { action: 'Start', from: 'PENDING', to: 'IN_PROGRESS', eventName: 'CarrierReconciliationStarted' },
        { action: 'DetectVariance', from: 'IN_PROGRESS', to: 'VARIANCE_DETECTED', eventName: 'CarrierReconciliationVarianceDetected' },
        { action: 'Reconcile', from: 'IN_PROGRESS', to: 'RECONCILED', eventName: 'CarrierReconciliationCompleted' },
        { action: 'Reconcile', from: 'VARIANCE_DETECTED', to: 'RECONCILED', eventName: 'CarrierReconciliationCompleted' },
        { action: 'Fail', from: 'PENDING', to: 'FAILED', eventName: 'CarrierReconciliationFailed' },
        { action: 'Fail', from: 'IN_PROGRESS', to: 'FAILED', eventName: 'CarrierReconciliationFailed' },
        { action: 'Fail', from: 'VARIANCE_DETECTED', to: 'FAILED', eventName: 'CarrierReconciliationFailed' },
      ],
      initialState: 'PENDING',
      terminalStates: ['RECONCILED', 'FAILED'],
    };
    this.fsmFramework.register(definition);
  }

  getAllowedActions(state: string): string[] {
    return this.fsmFramework.getAllowedActionsFromState(state, 'CarrierReconciliationRun');
  }
}
