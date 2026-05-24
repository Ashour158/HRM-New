import { Module } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { GlobalHrController } from './api/global-hr.controller.js';
import { CountryRuleSetFsmRegistrar } from './fsm/country-rule-set.fsm.js';
import { StatutoryLeaveTypeFsmRegistrar } from './fsm/statutory-leave-type.fsm.js';
import { WorksCouncilConsultationFsmRegistrar } from './fsm/works-council-consultation.fsm.js';
import { WorkAuthorizationCaseFsmRegistrar } from './fsm/work-authorization-case.fsm.js';
import { CountryRuleSetRepository } from './repositories/country-rule-set.repository.js';
import { StatutoryLeaveTypeRepository } from './repositories/statutory-leave-type.repository.js';
import { WorksCouncilConsultationRepository } from './repositories/works-council-consultation.repository.js';
import { WorkAuthorizationCaseRepository } from './repositories/work-authorization-case.repository.js';
import { CreateCountryRuleSetHandler } from './commands/create-country-rule-set.handler.js';
import { CreateStatutoryLeaveTypeHandler } from './commands/create-statutory-leave-type.handler.js';
import { CreateWorksCouncilConsultationHandler } from './commands/create-works-council-consultation.handler.js';
import { CreateWorkAuthorizationCaseHandler } from './commands/create-work-authorization-case.handler.js';
import { GlobalHrEventsPublisher } from './events/global-hr-events.publisher.js';
import { GlobalComplianceSaga } from './sagas/global-compliance-saga.js';

/**
 * Global HR domain module.
 *
 * Owns CountryRuleSet, StatutoryLeaveType, WorksCouncilConsultation, and WorkAuthorizationCase aggregates.
 * Provides command handlers, repositories, FSM registrations, event publishing, saga coordination, and API endpoints.
 */
@Module({
  imports: [PlatformModule],
  controllers: [GlobalHrController],
  providers: [
    // FSM registrars
    CountryRuleSetFsmRegistrar,
    StatutoryLeaveTypeFsmRegistrar,
    WorksCouncilConsultationFsmRegistrar,
    WorkAuthorizationCaseFsmRegistrar,
    // Repositories
    CountryRuleSetRepository,
    StatutoryLeaveTypeRepository,
    WorksCouncilConsultationRepository,
    WorkAuthorizationCaseRepository,
    // Command handlers
    CreateCountryRuleSetHandler,
    CreateStatutoryLeaveTypeHandler,
    CreateWorksCouncilConsultationHandler,
    CreateWorkAuthorizationCaseHandler,
    // Event publisher
    GlobalHrEventsPublisher,
    // Saga
    GlobalComplianceSaga,
  ],
  exports: [CountryRuleSetRepository, WorksCouncilConsultationRepository, WorkAuthorizationCaseRepository],
})
export class GlobalHrModule {}
