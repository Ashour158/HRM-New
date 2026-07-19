import { Module } from '@nestjs/common';
import { PositionControlModule } from '../position-control/position-control.module.js';
import { CompensationModule } from '../compensation/compensation.module.js';
import { RecruitingController } from './api/recruiting.controller.js';
import { JobRequisitionFsmRegistrar } from './fsm/job-requisition.fsm.js';
import { CandidateFsmRegistrar } from './fsm/candidate.fsm.js';
import { InterviewPlanFsmRegistrar } from './fsm/interview-plan.fsm.js';
import { OfferFsmRegistrar } from './fsm/offer.fsm.js';
import { JobRequisitionRepository } from './repositories/job-requisition.repository.js';
import { CandidateRepository } from './repositories/candidate.repository.js';
import { InterviewPlanRepository } from './repositories/interview-plan.repository.js';
import { OfferRepository } from './repositories/offer.repository.js';
import { CreateJobRequisitionHandler } from './commands/create-job-requisition.handler.js';
import { SubmitJobRequisitionForApprovalHandler } from './commands/submit-job-requisition-for-approval.handler.js';
import { ApproveJobRequisitionHandler } from './commands/approve-job-requisition.handler.js';
import { RejectJobRequisitionHandler } from './commands/reject-job-requisition.handler.js';
import { PublishJobRequisitionHandler } from './commands/publish-job-requisition.handler.js';
import { OpenJobRequisitionHandler } from './commands/open-job-requisition.handler.js';
import { FillJobRequisitionHandler } from './commands/fill-job-requisition.handler.js';
import { CloseJobRequisitionHandler } from './commands/close-job-requisition.handler.js';
import { SubmitCandidateApplicationHandler } from './commands/submit-candidate-application.handler.js';
import { ScreenCandidateHandler } from './commands/screen-candidate.handler.js';
import { ScheduleInterviewHandler } from './commands/schedule-interview.handler.js';
import { StartInterviewHandler } from './commands/start-interview.handler.js';
import { CompleteInterviewHandler } from './commands/complete-interview.handler.js';
import { CancelInterviewHandler } from './commands/cancel-interview.handler.js';
import { MakeOfferPendingHandler } from './commands/make-offer-pending.handler.js';
import { HireCandidateHandler } from './commands/hire-candidate.handler.js';
import { RejectCandidateHandler } from './commands/reject-candidate.handler.js';
import { WithdrawCandidateHandler } from './commands/withdraw-candidate.handler.js';
import { CreateOfferHandler } from './commands/create-offer.handler.js';
import { ApproveOfferHandler } from './commands/approve-offer.handler.js';
import { SendOfferHandler } from './commands/send-offer.handler.js';
import { AcceptOfferHandler } from './commands/accept-offer.handler.js';
import { OfferCompensationGateService } from './services/offer-compensation-gate.service.js';
import { DeclineOfferHandler } from './commands/decline-offer.handler.js';
import { ExpireOfferHandler } from './commands/expire-offer.handler.js';
import { WithdrawOfferHandler } from './commands/withdraw-offer.handler.js';
import { RecruitingEventsPublisher } from './events/recruiting-events.publisher.js';
import { OfferToHireSaga } from './sagas/offer-to-hire.saga.js';

/**
 * Recruiting domain module.
 *
 * Owns JobRequisition, Candidate, InterviewPlan, and Offer aggregates.
 * Provides command handlers, repositories, FSM registrations, event publishing,
 * and the OfferToHire saga.
 */
@Module({
  imports: [PositionControlModule, CompensationModule],
  controllers: [RecruitingController],
  providers: [
    // FSM registrars
    JobRequisitionFsmRegistrar,
    CandidateFsmRegistrar,
    InterviewPlanFsmRegistrar,
    OfferFsmRegistrar,
    // Repositories
    JobRequisitionRepository,
    CandidateRepository,
    InterviewPlanRepository,
    OfferRepository,
    // Services
    OfferCompensationGateService,
    // Command handlers
    CreateJobRequisitionHandler,
    SubmitJobRequisitionForApprovalHandler,
    ApproveJobRequisitionHandler,
    RejectJobRequisitionHandler,
    PublishJobRequisitionHandler,
    OpenJobRequisitionHandler,
    FillJobRequisitionHandler,
    CloseJobRequisitionHandler,
    SubmitCandidateApplicationHandler,
    ScreenCandidateHandler,
    ScheduleInterviewHandler,
    StartInterviewHandler,
    CompleteInterviewHandler,
    CancelInterviewHandler,
    MakeOfferPendingHandler,
    HireCandidateHandler,
    RejectCandidateHandler,
    WithdrawCandidateHandler,
    CreateOfferHandler,
    ApproveOfferHandler,
    SendOfferHandler,
    AcceptOfferHandler,
    DeclineOfferHandler,
    ExpireOfferHandler,
    WithdrawOfferHandler,
    // Event publisher
    RecruitingEventsPublisher,
    // Saga
    OfferToHireSaga,
  ],
  exports: [JobRequisitionRepository, CandidateRepository, InterviewPlanRepository, OfferRepository],
})
export class RecruitingModule {}
