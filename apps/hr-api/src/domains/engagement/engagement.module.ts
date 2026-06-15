import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { FsmFramework } from '../../platform/workflow/fsm-framework.js';
import { EngagementController } from './api/engagement.controller.js';
import { EngagementSurveyRepository } from './repositories/engagement-survey.repository.js';
import { SurveyResponseRepository } from './repositories/survey-response.repository.js';
import { Feedback360CycleRepository } from './repositories/feedback-360-cycle.repository.js';
import { RecognitionProgramRepository } from './repositories/recognition-program.repository.js';
import { RecognitionRecordRepository } from './repositories/recognition-record.repository.js';
import { CreateEngagementSurveyHandler } from './commands/create-engagement-survey.handler.js';
import { PublishEngagementSurveyHandler } from './commands/publish-engagement-survey.handler.js';
import { ActivateEngagementSurveyHandler } from './commands/activate-engagement-survey.handler.js';
import { CloseEngagementSurveyHandler } from './commands/close-engagement-survey.handler.js';
import { AnalyzeEngagementSurveyHandler } from './commands/analyze-engagement-survey.handler.js';
import { CreateSurveyResponseHandler } from './commands/create-survey-response.handler.js';
import { CompleteSurveyResponseHandler } from './commands/complete-survey-response.handler.js';
import { SubmitSurveyResponseHandler } from './commands/submit-survey-response.handler.js';
import { CreateFeedback360CycleHandler } from './commands/create-feedback-360-cycle.handler.js';
import { ActivateFeedback360CycleHandler } from './commands/activate-feedback-360-cycle.handler.js';
import { StartFeedback360CycleHandler } from './commands/start-feedback-360-cycle.handler.js';
import { CompleteFeedback360CycleHandler } from './commands/complete-feedback-360-cycle.handler.js';
import { SubmitFeedback360ResponseHandler } from './commands/submit-feedback-360-response.handler.js';
import { CreateRecognitionProgramHandler } from './commands/create-recognition-program.handler.js';
import { ActivateRecognitionProgramHandler } from './commands/activate-recognition-program.handler.js';
import { SuspendRecognitionProgramHandler } from './commands/suspend-recognition-program.handler.js';
import { CloseRecognitionProgramHandler } from './commands/close-recognition-program.handler.js';
import { CreateRecognitionRecordHandler } from './commands/create-recognition-record.handler.js';
import { ApproveRecognitionRecordHandler } from './commands/approve-recognition-record.handler.js';
import { AwardRecognitionRecordHandler } from './commands/award-recognition-record.handler.js';
import { CancelRecognitionRecordHandler } from './commands/cancel-recognition-record.handler.js';
import { RejectRecognitionRecordHandler } from './commands/reject-recognition-record.handler.js';
import { EngagementEventsPublisher } from './events/engagement-events.publisher.js';
import { registerEngagementSurveyFsm } from './fsm/engagement-survey.fsm.js';
import { registerSurveyResponseFsm } from './fsm/survey-response.fsm.js';
import { registerFeedback360CycleFsm } from './fsm/feedback-360-cycle.fsm.js';
import { registerRecognitionProgramFsm } from './fsm/recognition-program.fsm.js';
import { registerRecognitionRecordFsm } from './fsm/recognition-record.fsm.js';

@Module({
  imports: [PlatformModule],
  controllers: [EngagementController],
  providers: [
    EngagementSurveyRepository,
    SurveyResponseRepository,
    Feedback360CycleRepository,
    RecognitionProgramRepository,
    RecognitionRecordRepository,
    CreateEngagementSurveyHandler,
    PublishEngagementSurveyHandler,
    ActivateEngagementSurveyHandler,
    CloseEngagementSurveyHandler,
    AnalyzeEngagementSurveyHandler,
    CreateSurveyResponseHandler,
    CompleteSurveyResponseHandler,
    SubmitSurveyResponseHandler,
    CreateFeedback360CycleHandler,
    ActivateFeedback360CycleHandler,
    StartFeedback360CycleHandler,
    CompleteFeedback360CycleHandler,
    SubmitFeedback360ResponseHandler,
    CreateRecognitionProgramHandler,
    ActivateRecognitionProgramHandler,
    SuspendRecognitionProgramHandler,
    CloseRecognitionProgramHandler,
    CreateRecognitionRecordHandler,
    ApproveRecognitionRecordHandler,
    AwardRecognitionRecordHandler,
    CancelRecognitionRecordHandler,
    RejectRecognitionRecordHandler,
    EngagementEventsPublisher,
  ],
  exports: [EngagementSurveyRepository, SurveyResponseRepository, Feedback360CycleRepository, RecognitionProgramRepository, RecognitionRecordRepository],
})
export class EngagementModule implements OnModuleInit {
  constructor(@Inject(FsmFramework) private readonly fsm: FsmFramework) {}

  onModuleInit(): void {
    registerEngagementSurveyFsm(this.fsm);
    registerSurveyResponseFsm(this.fsm);
    registerFeedback360CycleFsm(this.fsm);
    registerRecognitionProgramFsm(this.fsm);
    registerRecognitionRecordFsm(this.fsm);
  }
}
