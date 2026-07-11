import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

/**
 * Finite-state machine registrar for the JobRequisition aggregate.
 *
 * States: DRAFT, PENDING_APPROVAL, APPROVED, PUBLISHED, OPEN, FILLED, CLOSED, REJECTED
 */
@Injectable()
export class JobRequisitionFsmRegistrar implements OnModuleInit {
  constructor(@Inject(FsmFramework) private readonly fsmFramework: FsmFramework) {}

  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'JobRequisition',
      states: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'OPEN', 'FILLED', 'CLOSED', 'REJECTED'],
      actions: [
        'SubmitJobRequisitionForApproval',
        'ApproveJobRequisition',
        'RejectJobRequisition',
        'PublishJobRequisition',
        'OpenJobRequisition',
        'FillJobRequisition',
        'CloseJobRequisition',
        'UpdateJobRequisition',
      ],
      transitions: [
        { action: 'SubmitJobRequisitionForApproval', from: 'DRAFT', to: 'PENDING_APPROVAL', eventName: 'JobRequisitionSubmitted' },
        { action: 'ApproveJobRequisition', from: 'PENDING_APPROVAL', to: 'APPROVED', eventName: 'JobRequisitionApproved' },
        { action: 'RejectJobRequisition', from: 'PENDING_APPROVAL', to: 'REJECTED', eventName: 'JobRequisitionRejected' },
        { action: 'PublishJobRequisition', from: 'APPROVED', to: 'PUBLISHED', eventName: 'JobRequisitionPublished' },
        { action: 'OpenJobRequisition', from: 'PUBLISHED', to: 'OPEN', eventName: 'JobRequisitionOpened' },
        { action: 'FillJobRequisition', from: 'OPEN', to: 'FILLED', eventName: 'JobRequisitionFilled' },
        { action: 'CloseJobRequisition', from: 'DRAFT', to: 'CLOSED', eventName: 'JobRequisitionClosed' },
        { action: 'CloseJobRequisition', from: 'PENDING_APPROVAL', to: 'CLOSED', eventName: 'JobRequisitionClosed' },
        { action: 'CloseJobRequisition', from: 'APPROVED', to: 'CLOSED', eventName: 'JobRequisitionClosed' },
        { action: 'CloseJobRequisition', from: 'PUBLISHED', to: 'CLOSED', eventName: 'JobRequisitionClosed' },
        { action: 'CloseJobRequisition', from: 'OPEN', to: 'CLOSED', eventName: 'JobRequisitionClosed' },
        { action: 'CloseJobRequisition', from: 'FILLED', to: 'CLOSED', eventName: 'JobRequisitionClosed' },
        { action: 'UpdateJobRequisition', from: 'DRAFT', to: 'DRAFT', eventName: 'JobRequisitionUpdated' },
        { action: 'UpdateJobRequisition', from: 'PENDING_APPROVAL', to: 'PENDING_APPROVAL', eventName: 'JobRequisitionUpdated' },
        { action: 'UpdateJobRequisition', from: 'APPROVED', to: 'APPROVED', eventName: 'JobRequisitionUpdated' },
        { action: 'UpdateJobRequisition', from: 'PUBLISHED', to: 'PUBLISHED', eventName: 'JobRequisitionUpdated' },
        { action: 'UpdateJobRequisition', from: 'OPEN', to: 'OPEN', eventName: 'JobRequisitionUpdated' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['CLOSED', 'REJECTED'],
    });
  }
}
