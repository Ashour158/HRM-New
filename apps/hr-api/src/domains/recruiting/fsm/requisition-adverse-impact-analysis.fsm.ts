import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

/**
 * Finite-state machine registrar for the RequisitionAdverseImpactAnalysis
 * aggregate.
 *
 * States: ANALYZED, REVIEWED
 *
 * The initial ANALYZED state is produced directly by
 * `AnalyzeRequisitionAdverseImpact` (a create-and-compute command, matching
 * the dei-analytics `Generate*` convention) rather than through an FSM
 * transition — only the post-creation review step is FSM-governed.
 */
@Injectable()
export class RequisitionAdverseImpactAnalysisFsmRegistrar implements OnModuleInit {
  constructor(@Inject(FsmFramework) private readonly fsmFramework: FsmFramework) {}

  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'RequisitionAdverseImpactAnalysis',
      states: ['ANALYZED', 'REVIEWED'],
      actions: ['ReviewRequisitionAdverseImpactAnalysis'],
      transitions: [
        {
          action: 'ReviewRequisitionAdverseImpactAnalysis',
          from: 'ANALYZED',
          to: 'REVIEWED',
          eventName: 'RequisitionAdverseImpactAnalysisReviewed',
        },
      ],
      initialState: 'ANALYZED',
      terminalStates: ['REVIEWED'],
    });
  }
}
