import { Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

/**
 * Finite-state machine registrar for the StatutoryReport aggregate.
 *
 * States: DRAFT, SUBMITTED, VALIDATED, FILED, ACCEPTED, REJECTED
 */
@Injectable()
export class StatutoryReportFsmRegistrar implements OnModuleInit {
  constructor(private readonly fsmFramework: FsmFramework) {}

  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'StatutoryReport',
      states: ['DRAFT', 'SUBMITTED', 'VALIDATED', 'FILED', 'ACCEPTED', 'REJECTED'],
      actions: [
        'SubmitStatutoryReport',
        'ValidateStatutoryReport',
        'FileStatutoryReport',
        'AcceptStatutoryReport',
        'RejectStatutoryReport',
      ],
      transitions: [
        { action: 'SubmitStatutoryReport', from: 'DRAFT', to: 'SUBMITTED', eventName: 'StatutoryReportSubmitted' },
        { action: 'ValidateStatutoryReport', from: 'SUBMITTED', to: 'VALIDATED', eventName: 'StatutoryReportValidated' },
        { action: 'FileStatutoryReport', from: 'VALIDATED', to: 'FILED', eventName: 'StatutoryReportFiled' },
        { action: 'AcceptStatutoryReport', from: 'FILED', to: 'ACCEPTED', eventName: 'StatutoryReportAccepted' },
        { action: 'RejectStatutoryReport', from: 'SUBMITTED', to: 'REJECTED', eventName: 'StatutoryReportRejected' },
        { action: 'RejectStatutoryReport', from: 'VALIDATED', to: 'REJECTED', eventName: 'StatutoryReportRejected' },
        { action: 'RejectStatutoryReport', from: 'FILED', to: 'REJECTED', eventName: 'StatutoryReportRejected' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['ACCEPTED', 'REJECTED'],
    });
  }
}
