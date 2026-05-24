import { Module, OnModuleInit } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { FsmFramework } from '../../platform/workflow/fsm-framework.js';
import { PerformanceController } from './api/performance.controller.js';
import { PerformanceReviewCycleRepository } from './repositories/performance-review-cycle.repository.js';
import { PerformanceReviewRepository } from './repositories/performance-review.repository.js';
import { GoalRepository } from './repositories/goal.repository.js';
import { CalibrationSessionRepository } from './repositories/calibration-session.repository.js';
import { PerformanceImprovementPlanRepository } from './repositories/performance-improvement-plan.repository.js';
import { CreatePerformanceReviewCycleHandler } from './commands/create-performance-review-cycle.handler.js';
import { SetupPerformanceReviewCycleHandler } from './commands/setup-performance-review-cycle.handler.js';
import { ActivatePerformanceReviewCycleHandler } from './commands/activate-performance-review-cycle.handler.js';
import { StartPerformanceReviewCycleHandler } from './commands/start-performance-review-cycle.handler.js';
import { EnterCalibrationPerformanceReviewCycleHandler } from './commands/enter-calibration-performance-review-cycle.handler.js';
import { EnterReviewPerformanceReviewCycleHandler } from './commands/enter-review-performance-review-cycle.handler.js';
import { ClosePerformanceReviewCycleHandler } from './commands/close-performance-review-cycle.handler.js';
import { CreatePerformanceReviewHandler } from './commands/create-performance-review.handler.js';
import { SubmitSelfReviewHandler } from './commands/submit-self-review.handler.js';
import { SubmitManagerReviewHandler } from './commands/submit-manager-review.handler.js';
import { CalibratePerformanceReviewHandler } from './commands/calibrate-performance-review.handler.js';
import { FinalizePerformanceReviewHandler } from './commands/finalize-performance-review.handler.js';
import { AcknowledgePerformanceReviewHandler } from './commands/acknowledge-performance-review.handler.js';
import { DisputePerformanceReviewHandler } from './commands/dispute-performance-review.handler.js';
import { CreateGoalHandler } from './commands/create-goal.handler.js';
import { ActivateGoalHandler } from './commands/activate-goal.handler.js';
import { UpdateGoalProgressHandler } from './commands/update-goal-progress.handler.js';
import { MarkGoalAchievedHandler } from './commands/mark-goal-achieved.handler.js';
import { MarkGoalMissedHandler } from './commands/mark-goal-missed.handler.js';
import { CancelGoalHandler } from './commands/cancel-goal.handler.js';
import { CreateCalibrationSessionHandler } from './commands/create-calibration-session.handler.js';
import { ScheduleCalibrationSessionHandler } from './commands/schedule-calibration-session.handler.js';
import { StartCalibrationSessionHandler } from './commands/start-calibration-session.handler.js';
import { CompleteCalibrationSessionHandler } from './commands/complete-calibration-session.handler.js';
import { FinalizeCalibrationSessionHandler } from './commands/finalize-calibration-session.handler.js';
import { CreatePerformanceImprovementPlanHandler } from './commands/create-performance-improvement-plan.handler.js';
import { ActivatePerformanceImprovementPlanHandler } from './commands/activate-performance-improvement-plan.handler.js';
import { EnterReviewPerformanceImprovementPlanHandler } from './commands/enter-review-performance-improvement-plan.handler.js';
import { CompletePerformanceImprovementPlanHandler } from './commands/complete-performance-improvement-plan.handler.js';
import { ClosePerformanceImprovementPlanHandler } from './commands/close-performance-improvement-plan.handler.js';
import { ExtendPerformanceImprovementPlanHandler } from './commands/extend-performance-improvement-plan.handler.js';
import { TerminatePerformanceImprovementPlanHandler } from './commands/terminate-performance-improvement-plan.handler.js';
import { PerformanceEventsPublisher } from './events/performance-events.publisher.js';
import { registerPerformanceReviewCycleFsm } from './fsm/performance-review-cycle.fsm.js';
import { registerPerformanceReviewFsm } from './fsm/performance-review.fsm.js';
import { registerGoalFsm } from './fsm/goal.fsm.js';
import { registerCalibrationSessionFsm } from './fsm/calibration-session.fsm.js';
import { registerPerformanceImprovementPlanFsm } from './fsm/performance-improvement-plan.fsm.js';

@Module({
  imports: [PlatformModule],
  controllers: [PerformanceController],
  providers: [
    PerformanceReviewCycleRepository,
    PerformanceReviewRepository,
    GoalRepository,
    CalibrationSessionRepository,
    PerformanceImprovementPlanRepository,
    CreatePerformanceReviewCycleHandler,
    SetupPerformanceReviewCycleHandler,
    ActivatePerformanceReviewCycleHandler,
    StartPerformanceReviewCycleHandler,
    EnterCalibrationPerformanceReviewCycleHandler,
    EnterReviewPerformanceReviewCycleHandler,
    ClosePerformanceReviewCycleHandler,
    CreatePerformanceReviewHandler,
    SubmitSelfReviewHandler,
    SubmitManagerReviewHandler,
    CalibratePerformanceReviewHandler,
    FinalizePerformanceReviewHandler,
    AcknowledgePerformanceReviewHandler,
    DisputePerformanceReviewHandler,
    CreateGoalHandler,
    ActivateGoalHandler,
    UpdateGoalProgressHandler,
    MarkGoalAchievedHandler,
    MarkGoalMissedHandler,
    CancelGoalHandler,
    CreateCalibrationSessionHandler,
    ScheduleCalibrationSessionHandler,
    StartCalibrationSessionHandler,
    CompleteCalibrationSessionHandler,
    FinalizeCalibrationSessionHandler,
    CreatePerformanceImprovementPlanHandler,
    ActivatePerformanceImprovementPlanHandler,
    EnterReviewPerformanceImprovementPlanHandler,
    CompletePerformanceImprovementPlanHandler,
    ClosePerformanceImprovementPlanHandler,
    ExtendPerformanceImprovementPlanHandler,
    TerminatePerformanceImprovementPlanHandler,
    PerformanceEventsPublisher,
  ],
  exports: [PerformanceReviewCycleRepository, PerformanceReviewRepository, GoalRepository, CalibrationSessionRepository, PerformanceImprovementPlanRepository],
})
export class PerformanceModule implements OnModuleInit {
  constructor(private readonly fsm: FsmFramework) {}

  onModuleInit(): void {
    registerPerformanceReviewCycleFsm(this.fsm);
    registerPerformanceReviewFsm(this.fsm);
    registerGoalFsm(this.fsm);
    registerCalibrationSessionFsm(this.fsm);
    registerPerformanceImprovementPlanFsm(this.fsm);
  }
}
