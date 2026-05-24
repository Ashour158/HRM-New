import { Module } from '@nestjs/common';
import { OnboardingController } from './api/onboarding.controller.js';
import { OnboardingPlanFsmRegistrar } from './fsm/onboarding-plan.fsm.js';
import { OnboardingTaskFsmRegistrar } from './fsm/onboarding-task.fsm.js';
import { OnboardingPlanRepository } from './repositories/onboarding-plan.repository.js';
import { OnboardingTaskRepository } from './repositories/onboarding-task.repository.js';
import { CreateOnboardingPlanHandler } from './commands/create-onboarding-plan.handler.js';
import { StartOnboardingHandler } from './commands/start-onboarding.handler.js';
import { CompleteOnboardingHandler } from './commands/complete-onboarding.handler.js';
import { CreateOnboardingTaskHandler } from './commands/create-onboarding-task.handler.js';
import { CompleteOnboardingTaskHandler } from './commands/complete-onboarding-task.handler.js';
import { SkipOnboardingTaskHandler } from './commands/skip-onboarding-task.handler.js';
import { OnboardingEventsPublisher } from './events/onboarding-events.publisher.js';

/**
 * Onboarding domain module.
 *
 * Owns OnboardingPlan and OnboardingTask aggregates.
 * Provides command handlers, repositories, FSM registrations, and event publishing.
 */
@Module({
  controllers: [OnboardingController],
  providers: [
    // FSM registrars
    OnboardingPlanFsmRegistrar,
    OnboardingTaskFsmRegistrar,
    // Repositories
    OnboardingPlanRepository,
    OnboardingTaskRepository,
    // Command handlers
    CreateOnboardingPlanHandler,
    StartOnboardingHandler,
    CompleteOnboardingHandler,
    CreateOnboardingTaskHandler,
    CompleteOnboardingTaskHandler,
    SkipOnboardingTaskHandler,
    // Event publisher
    OnboardingEventsPublisher,
  ],
  exports: [OnboardingPlanRepository, OnboardingTaskRepository],
})
export class OnboardingModule {}
