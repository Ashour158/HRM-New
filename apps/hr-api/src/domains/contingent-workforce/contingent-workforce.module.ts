import { Module, OnModuleInit } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { ContingentWorkforceController } from './api/contingent-workforce.controller.js';
import { ContingentWorkforceEventsPublisher } from './events/contingent-workforce-events.publisher.js';
import { ContingentWorkerAssignmentRepository } from './repositories/contingent-worker-assignment.repository.js';
import { SowEngagementRepository } from './repositories/sow-engagement.repository.js';
import { ContractorRateCardRepository } from './repositories/contractor-rate-card.repository.js';
import { MisclassificationAssessmentRepository } from './repositories/misclassification-assessment.repository.js';
import { FsmFramework } from '../../platform/workflow/fsm-framework.js';
import { registerContingentWorkerAssignmentFsm } from './fsm/contingent-worker-assignment.fsm.js';
import { registerSowEngagementFsm } from './fsm/sow-engagement.fsm.js';
import { registerContractorRateCardFsm } from './fsm/contractor-rate-card.fsm.js';
import { registerMisclassificationAssessmentFsm } from './fsm/misclassification-assessment.fsm.js';
import { CreateContingentWorkerAssignmentHandler } from './commands/create-contingent-worker-assignment.handler.js';
import { ActivateContingentWorkerAssignmentHandler } from './commands/activate-contingent-worker-assignment.handler.js';
import { ExtendContingentWorkerAssignmentHandler } from './commands/extend-contingent-worker-assignment.handler.js';
import { TerminateContingentWorkerAssignmentHandler } from './commands/terminate-contingent-worker-assignment.handler.js';
import { CreateSowEngagementHandler } from './commands/create-sow-engagement.handler.js';
import { ActivateSowEngagementHandler } from './commands/activate-sow-engagement.handler.js';
import { StartSowEngagementHandler } from './commands/start-sow-engagement.handler.js';
import { CompleteSowEngagementHandler } from './commands/complete-sow-engagement.handler.js';
import { CloseSowEngagementHandler } from './commands/close-sow-engagement.handler.js';
import { CreateContractorRateCardHandler } from './commands/create-contractor-rate-card.handler.js';
import { ActivateContractorRateCardHandler } from './commands/activate-contractor-rate-card.handler.js';
import { ReviseContractorRateCardHandler } from './commands/revise-contractor-rate-card.handler.js';
import { ExpireContractorRateCardHandler } from './commands/expire-contractor-rate-card.handler.js';
import { CreateMisclassificationAssessmentHandler } from './commands/create-misclassification-assessment.handler.js';
import { StartMisclassificationAssessmentHandler } from './commands/start-misclassification-assessment.handler.js';
import { MarkReviewRequiredMisclassificationAssessmentHandler } from './commands/mark-review-required-misclassification-assessment.handler.js';
import { ClearMisclassificationAssessmentHandler } from './commands/clear-misclassification-assessment.handler.js';
import { FlagMisclassificationAssessmentHandler } from './commands/flag-misclassification-assessment.handler.js';

const HANDLERS = [
  CreateContingentWorkerAssignmentHandler,
  ActivateContingentWorkerAssignmentHandler,
  ExtendContingentWorkerAssignmentHandler,
  TerminateContingentWorkerAssignmentHandler,
  CreateSowEngagementHandler,
  ActivateSowEngagementHandler,
  StartSowEngagementHandler,
  CompleteSowEngagementHandler,
  CloseSowEngagementHandler,
  CreateContractorRateCardHandler,
  ActivateContractorRateCardHandler,
  ReviseContractorRateCardHandler,
  ExpireContractorRateCardHandler,
  CreateMisclassificationAssessmentHandler,
  StartMisclassificationAssessmentHandler,
  MarkReviewRequiredMisclassificationAssessmentHandler,
  ClearMisclassificationAssessmentHandler,
  FlagMisclassificationAssessmentHandler,
];

const REPOS = [
  ContingentWorkerAssignmentRepository,
  SowEngagementRepository,
  ContractorRateCardRepository,
  MisclassificationAssessmentRepository,
];

@Module({
  imports: [PlatformModule],
  controllers: [ContingentWorkforceController],
  providers: [...REPOS, ...HANDLERS, ContingentWorkforceEventsPublisher],
  exports: REPOS,
})
export class ContingentWorkforceModule implements OnModuleInit {
  constructor(private readonly fsm: FsmFramework) {}

  onModuleInit() {
    registerContingentWorkerAssignmentFsm(this.fsm);
    registerSowEngagementFsm(this.fsm);
    registerContractorRateCardFsm(this.fsm);
    registerMisclassificationAssessmentFsm(this.fsm);
  }
}
