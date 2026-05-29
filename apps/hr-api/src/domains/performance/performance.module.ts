import { Module, OnModuleInit } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { FsmFramework } from '../../platform/workflow/fsm-framework.js';
import { PerformanceController } from './api/performance.controller.js';

// Repositories — existing
import { PerformanceReviewCycleRepository } from './repositories/performance-review-cycle.repository.js';
import { PerformanceReviewRepository } from './repositories/performance-review.repository.js';
import { GoalRepository } from './repositories/goal.repository.js';
import { CalibrationSessionRepository } from './repositories/calibration-session.repository.js';
import { PerformanceImprovementPlanRepository } from './repositories/performance-improvement-plan.repository.js';

// Repositories — new
import { Feedback360CycleRepository } from './repositories/feedback-360-cycle.repository.js';
import { Feedback360ResponseRepository } from './repositories/feedback-360-response.repository.js';
import { ObjectiveRepository } from './repositories/objective.repository.js';
import { KeyResultRepository } from './repositories/key-result.repository.js';
import { KpiRepository } from './repositories/kpi.repository.js';
import { KpiMeasurementRepository } from './repositories/kpi-measurement.repository.js';
import { ReviewTemplateRepository } from './repositories/review-template.repository.js';
import { CompetencyRepository } from './repositories/competency.repository.js';
import { DevelopmentPlanRepository } from './repositories/development-plan.repository.js';
import { WorkerRepository } from '../hr-core/repositories/worker.repository.js';

// Handlers — existing Performance Review Cycle
import { CreatePerformanceReviewCycleHandler } from './commands/create-performance-review-cycle.handler.js';
import { SetupPerformanceReviewCycleHandler } from './commands/setup-performance-review-cycle.handler.js';
import { ActivatePerformanceReviewCycleHandler } from './commands/activate-performance-review-cycle.handler.js';
import { StartPerformanceReviewCycleHandler } from './commands/start-performance-review-cycle.handler.js';
import { EnterCalibrationPerformanceReviewCycleHandler } from './commands/enter-calibration-performance-review-cycle.handler.js';
import { EnterReviewPerformanceReviewCycleHandler } from './commands/enter-review-performance-review-cycle.handler.js';
import { ClosePerformanceReviewCycleHandler } from './commands/close-performance-review-cycle.handler.js';

// Handlers — existing Performance Review
import { CreatePerformanceReviewHandler } from './commands/create-performance-review.handler.js';
import { SubmitSelfReviewHandler } from './commands/submit-self-review.handler.js';
import { SubmitManagerReviewHandler } from './commands/submit-manager-review.handler.js';
import { CalibratePerformanceReviewHandler } from './commands/calibrate-performance-review.handler.js';
import { FinalizePerformanceReviewHandler } from './commands/finalize-performance-review.handler.js';
import { AcknowledgePerformanceReviewHandler } from './commands/acknowledge-performance-review.handler.js';
import { DisputePerformanceReviewHandler } from './commands/dispute-performance-review.handler.js';

// Handlers — existing Goal
import { CreateGoalHandler } from './commands/create-goal.handler.js';
import { ActivateGoalHandler } from './commands/activate-goal.handler.js';
import { UpdateGoalProgressHandler } from './commands/update-goal-progress.handler.js';
import { MarkGoalAchievedHandler } from './commands/mark-goal-achieved.handler.js';
import { MarkGoalMissedHandler } from './commands/mark-goal-missed.handler.js';
import { CancelGoalHandler } from './commands/cancel-goal.handler.js';

// Handlers — existing Calibration
import { CreateCalibrationSessionHandler } from './commands/create-calibration-session.handler.js';
import { ScheduleCalibrationSessionHandler } from './commands/schedule-calibration-session.handler.js';
import { StartCalibrationSessionHandler } from './commands/start-calibration-session.handler.js';
import { CompleteCalibrationSessionHandler } from './commands/complete-calibration-session.handler.js';
import { FinalizeCalibrationSessionHandler } from './commands/finalize-calibration-session.handler.js';

// Handlers — existing PIP
import { CreatePerformanceImprovementPlanHandler } from './commands/create-performance-improvement-plan.handler.js';
import { ActivatePerformanceImprovementPlanHandler } from './commands/activate-performance-improvement-plan.handler.js';
import { EnterReviewPerformanceImprovementPlanHandler } from './commands/enter-review-performance-improvement-plan.handler.js';
import { CompletePerformanceImprovementPlanHandler } from './commands/complete-performance-improvement-plan.handler.js';
import { ClosePerformanceImprovementPlanHandler } from './commands/close-performance-improvement-plan.handler.js';
import { ExtendPerformanceImprovementPlanHandler } from './commands/extend-performance-improvement-plan.handler.js';
import { TerminatePerformanceImprovementPlanHandler } from './commands/terminate-performance-improvement-plan.handler.js';

// Handlers — new Feedback 360
import { CreateFeedback360CycleHandler } from './commands/create-feedback-360-cycle.handler.js';
import { ActivateFeedback360CycleHandler } from './commands/activate-feedback-360-cycle.handler.js';
import { LaunchFeedback360CycleHandler } from './commands/launch-feedback-360-cycle.handler.js';
import { CloseFeedback360CycleHandler } from './commands/close-feedback-360-cycle.handler.js';
import { ArchiveFeedback360CycleHandler } from './commands/archive-feedback-360-cycle.handler.js';
import { CreateFeedback360ResponseHandler } from './commands/create-feedback-360-response.handler.js';
import { SubmitFeedback360ResponseHandler } from './commands/submit-feedback-360-response.handler.js';

// Handlers — new OKR
import { CreateObjectiveHandler } from './commands/create-objective.handler.js';
import { ActivateObjectiveHandler } from './commands/activate-objective.handler.js';
import { UpdateObjectiveProgressHandler } from './commands/update-objective-progress.handler.js';
import { MarkObjectiveAchievedHandler } from './commands/mark-objective-achieved.handler.js';
import { CancelObjectiveHandler } from './commands/cancel-objective.handler.js';
import { CreateKeyResultHandler } from './commands/create-key-result.handler.js';
import { ActivateKeyResultHandler } from './commands/activate-key-result.handler.js';
import { UpdateKeyResultProgressHandler } from './commands/update-key-result-progress.handler.js';
import { CompleteKeyResultHandler } from './commands/complete-key-result.handler.js';
import { CancelKeyResultHandler } from './commands/cancel-key-result.handler.js';

// Handlers — new KPI
import { CreateKpiHandler } from './commands/create-kpi.handler.js';
import { ActivateKpiHandler } from './commands/activate-kpi.handler.js';
import { UpdateKpiActualHandler } from './commands/update-kpi-actual.handler.js';
import { AssignKpiOwnerHandler } from './commands/assign-kpi-owner.handler.js';
import { ArchiveKpiHandler } from './commands/archive-kpi.handler.js';
import { RecordKpiMeasurementHandler } from './commands/record-kpi-measurement.handler.js';
import { ValidateKpiMeasurementHandler } from './commands/validate-kpi-measurement.handler.js';

// Handlers — new Templates / Competencies / Development Plans
import { CreateReviewTemplateHandler } from './commands/create-review-template.handler.js';
import { PublishReviewTemplateHandler } from './commands/publish-review-template.handler.js';
import { ArchiveReviewTemplateHandler } from './commands/archive-review-template.handler.js';
import { CreateCompetencyHandler } from './commands/create-competency.handler.js';
import { ActivateCompetencyHandler } from './commands/activate-competency.handler.js';
import { DeactivateCompetencyHandler } from './commands/deactivate-competency.handler.js';
import { CreateDevelopmentPlanHandler } from './commands/create-development-plan.handler.js';
import { ActivateDevelopmentPlanHandler } from './commands/activate-development-plan.handler.js';
import { RecordDevelopmentMilestoneHandler } from './commands/record-development-milestone.handler.js';
import { CompleteDevelopmentPlanHandler } from './commands/complete-development-plan.handler.js';
import { CloseDevelopmentPlanHandler } from './commands/close-development-plan.handler.js';

import { PerformanceEventsPublisher } from './events/performance-events.publisher.js';

// FSM registrars — existing
import { registerPerformanceReviewCycleFsm } from './fsm/performance-review-cycle.fsm.js';
import { registerPerformanceReviewFsm } from './fsm/performance-review.fsm.js';
import { registerGoalFsm } from './fsm/goal.fsm.js';
import { registerCalibrationSessionFsm } from './fsm/calibration-session.fsm.js';
import { registerPerformanceImprovementPlanFsm } from './fsm/performance-improvement-plan.fsm.js';

// FSM registrars — new
import { registerFeedback360CycleFsm } from './fsm/feedback-360-cycle.fsm.js';
import { registerFeedback360ResponseFsm } from './fsm/feedback-360-response.fsm.js';
import { registerObjectiveFsm } from './fsm/objective.fsm.js';
import { registerKeyResultFsm } from './fsm/key-result.fsm.js';
import { registerKpiFsm } from './fsm/kpi.fsm.js';
import { registerKpiMeasurementFsm } from './fsm/kpi-measurement.fsm.js';
import { registerReviewTemplateFsm } from './fsm/review-template.fsm.js';
import { registerCompetencyFsm } from './fsm/competency.fsm.js';
import { registerDevelopmentPlanFsm } from './fsm/development-plan.fsm.js';

@Module({
  imports: [PlatformModule],
  controllers: [PerformanceController],
  providers: [
    // Repositories — existing
    PerformanceReviewCycleRepository,
    PerformanceReviewRepository,
    GoalRepository,
    CalibrationSessionRepository,
    PerformanceImprovementPlanRepository,

    // Repositories — new
    Feedback360CycleRepository,
    Feedback360ResponseRepository,
    ObjectiveRepository,
    KeyResultRepository,
    KpiRepository,
    KpiMeasurementRepository,
    ReviewTemplateRepository,
    CompetencyRepository,
    DevelopmentPlanRepository,
    WorkerRepository,

    // Handlers — existing Performance Review Cycle
    CreatePerformanceReviewCycleHandler,
    SetupPerformanceReviewCycleHandler,
    ActivatePerformanceReviewCycleHandler,
    StartPerformanceReviewCycleHandler,
    EnterCalibrationPerformanceReviewCycleHandler,
    EnterReviewPerformanceReviewCycleHandler,
    ClosePerformanceReviewCycleHandler,

    // Handlers — existing Performance Review
    CreatePerformanceReviewHandler,
    SubmitSelfReviewHandler,
    SubmitManagerReviewHandler,
    CalibratePerformanceReviewHandler,
    FinalizePerformanceReviewHandler,
    AcknowledgePerformanceReviewHandler,
    DisputePerformanceReviewHandler,

    // Handlers — existing Goal
    CreateGoalHandler,
    ActivateGoalHandler,
    UpdateGoalProgressHandler,
    MarkGoalAchievedHandler,
    MarkGoalMissedHandler,
    CancelGoalHandler,

    // Handlers — existing Calibration
    CreateCalibrationSessionHandler,
    ScheduleCalibrationSessionHandler,
    StartCalibrationSessionHandler,
    CompleteCalibrationSessionHandler,
    FinalizeCalibrationSessionHandler,

    // Handlers — existing PIP
    CreatePerformanceImprovementPlanHandler,
    ActivatePerformanceImprovementPlanHandler,
    EnterReviewPerformanceImprovementPlanHandler,
    CompletePerformanceImprovementPlanHandler,
    ClosePerformanceImprovementPlanHandler,
    ExtendPerformanceImprovementPlanHandler,
    TerminatePerformanceImprovementPlanHandler,

    // Handlers — new Feedback 360
    CreateFeedback360CycleHandler,
    ActivateFeedback360CycleHandler,
    LaunchFeedback360CycleHandler,
    CloseFeedback360CycleHandler,
    ArchiveFeedback360CycleHandler,
    CreateFeedback360ResponseHandler,
    SubmitFeedback360ResponseHandler,

    // Handlers — new OKR
    CreateObjectiveHandler,
    ActivateObjectiveHandler,
    UpdateObjectiveProgressHandler,
    MarkObjectiveAchievedHandler,
    CancelObjectiveHandler,
    CreateKeyResultHandler,
    ActivateKeyResultHandler,
    UpdateKeyResultProgressHandler,
    CompleteKeyResultHandler,
    CancelKeyResultHandler,

    // Handlers — new KPI
    CreateKpiHandler,
    ActivateKpiHandler,
    UpdateKpiActualHandler,
    AssignKpiOwnerHandler,
    ArchiveKpiHandler,
    RecordKpiMeasurementHandler,
    ValidateKpiMeasurementHandler,

    // Handlers — new Templates / Competencies / Development Plans
    CreateReviewTemplateHandler,
    PublishReviewTemplateHandler,
    ArchiveReviewTemplateHandler,
    CreateCompetencyHandler,
    ActivateCompetencyHandler,
    DeactivateCompetencyHandler,
    CreateDevelopmentPlanHandler,
    ActivateDevelopmentPlanHandler,
    RecordDevelopmentMilestoneHandler,
    CompleteDevelopmentPlanHandler,
    CloseDevelopmentPlanHandler,

    PerformanceEventsPublisher,
  ],
  exports: [
    PerformanceReviewCycleRepository,
    PerformanceReviewRepository,
    GoalRepository,
    CalibrationSessionRepository,
    PerformanceImprovementPlanRepository,
    Feedback360CycleRepository,
    Feedback360ResponseRepository,
    ObjectiveRepository,
    KeyResultRepository,
    KpiRepository,
    KpiMeasurementRepository,
    ReviewTemplateRepository,
    CompetencyRepository,
    DevelopmentPlanRepository,
  ],
})
export class PerformanceModule implements OnModuleInit {
  constructor(private readonly fsm: FsmFramework) {}

  onModuleInit(): void {
    registerPerformanceReviewCycleFsm(this.fsm);
    registerPerformanceReviewFsm(this.fsm);
    registerGoalFsm(this.fsm);
    registerCalibrationSessionFsm(this.fsm);
    registerPerformanceImprovementPlanFsm(this.fsm);

    registerFeedback360CycleFsm(this.fsm);
    registerFeedback360ResponseFsm(this.fsm);
    registerObjectiveFsm(this.fsm);
    registerKeyResultFsm(this.fsm);
    registerKpiFsm(this.fsm);
    registerKpiMeasurementFsm(this.fsm);
    registerReviewTemplateFsm(this.fsm);
    registerCompetencyFsm(this.fsm);
    registerDevelopmentPlanFsm(this.fsm);
  }
}
