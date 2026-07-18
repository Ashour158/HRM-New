import { Module } from '@nestjs/common';
import { PositionControlModule } from '../position-control/position-control.module.js';
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
import { PublishJobRequisitionHandler } from './commands/publish-job-requisition.handler.js';
import { CloseJobRequisitionHandler } from './commands/close-job-requisition.handler.js';
import { SubmitCandidateApplicationHandler } from './commands/submit-candidate-application.handler.js';
import { ScreenCandidateHandler } from './commands/screen-candidate.handler.js';
import { ScheduleInterviewHandler } from './commands/schedule-interview.handler.js';
import { CompleteInterviewHandler } from './commands/complete-interview.handler.js';
import { CancelInterviewHandler } from './commands/cancel-interview.handler.js';
import { CreateOfferHandler } from './commands/create-offer.handler.js';
import { ApproveOfferHandler } from './commands/approve-offer.handler.js';
import { SendOfferHandler } from './commands/send-offer.handler.js';
import { AcceptOfferHandler } from './commands/accept-offer.handler.js';
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
  imports: [PositionControlModule],
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
    // Command handlers
    CreateJobRequisitionHandler,
    SubmitJobRequisitionForApprovalHandler,
    ApproveJobRequisitionHandler,
    PublishJobRequisitionHandler,
    CloseJobRequisitionHandler,
    SubmitCandidateApplicationHandler,
    ScreenCandidateHandler,
    ScheduleInterviewHandler,
    CompleteInterviewHandler,
    CancelInterviewHandler,
    CreateOfferHandler,
    ApproveOfferHandler,
    SendOfferHandler,
    AcceptOfferHandler,
    // Event publisher
    RecruitingEventsPublisher,
    // Saga
    OfferToHireSaga,
  ],
  exports: [JobRequisitionRepository, CandidateRepository, InterviewPlanRepository, OfferRepository],
})
export class RecruitingModule {}
