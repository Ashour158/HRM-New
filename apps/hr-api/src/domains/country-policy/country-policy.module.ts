import { Module } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { HcmSetupModule } from '../hcm-setup/hcm-setup.module.js';
import { CountryPolicyController } from './api/country-policy.controller.js';
import { CountryPolicyPackFsmRegistrar } from './fsm/country-policy-pack.fsm.js';
import { CountryPolicyValidationRunFsmRegistrar } from './fsm/country-policy-validation-run.fsm.js';
import { CountryPolicyImpactSimulationFsmRegistrar } from './fsm/country-policy-impact-simulation.fsm.js';
import { CountryPolicyPackRepository } from './repositories/country-policy-pack.repository.js';
import { CountryPolicyValidationRunRepository } from './repositories/country-policy-validation-run.repository.js';
import { CountryPolicyImpactSimulationRepository } from './repositories/country-policy-impact-simulation.repository.js';
import { UploadCountryPolicyPackHandler } from './commands/upload-country-policy-pack.handler.js';
import { ParseCountryPolicyPackHandler } from './commands/parse-country-policy-pack.handler.js';
import { ValidateCountryPolicyPackHandler } from './commands/validate-country-policy-pack.handler.js';
import { RequireCountryPolicyPackImpactSimulationHandler } from './commands/require-country-policy-pack-impact-simulation.handler.js';
import { SimulateCountryPolicyPackImpactHandler } from './commands/simulate-country-policy-pack-impact.handler.js';
import { SubmitCountryPolicyPackForLegalReviewHandler } from './commands/submit-country-policy-pack-for-legal-review.handler.js';
import { SubmitCountryPolicyPackForPayrollTaxReviewHandler } from './commands/submit-country-policy-pack-for-payroll-tax-review.handler.js';
import { SubmitCountryPolicyPackForGlobalHRReviewHandler } from './commands/submit-country-policy-pack-for-global-hr-review.handler.js';
import { SubmitCountryPolicyPackForBenefitsReviewHandler } from './commands/submit-country-policy-pack-for-benefits-review.handler.js';
import { SubmitCountryPolicyPackForAbsenceReviewHandler } from './commands/submit-country-policy-pack-for-absence-review.handler.js';
import { SubmitCountryPolicyPackForComplianceReviewHandler } from './commands/submit-country-policy-pack-for-compliance-review.handler.js';
import { SubmitCountryPolicyPackForApprovalHandler } from './commands/submit-country-policy-pack-for-approval.handler.js';
import { ApproveCountryPolicyPackHandler } from './commands/approve-country-policy-pack.handler.js';
import { RejectCountryPolicyPackHandler } from './commands/reject-country-policy-pack.handler.js';
import { ScheduleCountryPolicyPackPublicationHandler } from './commands/schedule-country-policy-pack-publication.handler.js';
import { PublishCountryPolicyPackHandler } from './commands/publish-country-policy-pack.handler.js';
import { SupersedeCountryPolicyPackHandler } from './commands/supersede-country-policy-pack.handler.js';
import { RollbackCountryPolicyPackHandler } from './commands/rollback-country-policy-pack.handler.js';
import { RetireCountryPolicyPackHandler } from './commands/retire-country-policy-pack.handler.js';
import { QuarantineCountryPolicyPackHandler } from './commands/quarantine-country-policy-pack.handler.js';
import { CountryPolicyEventsPublisher } from './events/country-policy-events.publisher.js';
import { CountryPolicyPublicationSaga } from './sagas/country-policy-publication-saga.js';

/**
 * Country Policy domain module (v1.4).
 *
 * Owns CountryPolicyPack, CountryPolicyValidationRun, and CountryPolicyImpactSimulation aggregates.
 * Provides command handlers, repositories, FSM registrations, event publishing, saga coordination, and API endpoints.
 */
@Module({
  imports: [PlatformModule, HcmSetupModule],
  controllers: [CountryPolicyController],
  providers: [
    // FSM registrars
    CountryPolicyPackFsmRegistrar,
    CountryPolicyValidationRunFsmRegistrar,
    CountryPolicyImpactSimulationFsmRegistrar,
    // Repositories
    CountryPolicyPackRepository,
    CountryPolicyValidationRunRepository,
    CountryPolicyImpactSimulationRepository,
    // Command handlers
    UploadCountryPolicyPackHandler,
    ParseCountryPolicyPackHandler,
    ValidateCountryPolicyPackHandler,
    RequireCountryPolicyPackImpactSimulationHandler,
    SimulateCountryPolicyPackImpactHandler,
    SubmitCountryPolicyPackForLegalReviewHandler,
    SubmitCountryPolicyPackForPayrollTaxReviewHandler,
    SubmitCountryPolicyPackForGlobalHRReviewHandler,
    SubmitCountryPolicyPackForBenefitsReviewHandler,
    SubmitCountryPolicyPackForAbsenceReviewHandler,
    SubmitCountryPolicyPackForComplianceReviewHandler,
    SubmitCountryPolicyPackForApprovalHandler,
    ApproveCountryPolicyPackHandler,
    RejectCountryPolicyPackHandler,
    ScheduleCountryPolicyPackPublicationHandler,
    PublishCountryPolicyPackHandler,
    SupersedeCountryPolicyPackHandler,
    RollbackCountryPolicyPackHandler,
    RetireCountryPolicyPackHandler,
    QuarantineCountryPolicyPackHandler,
    // Event publisher
    CountryPolicyEventsPublisher,
    // Saga
    CountryPolicyPublicationSaga,
  ],
  exports: [CountryPolicyPackRepository, CountryPolicyValidationRunRepository, CountryPolicyImpactSimulationRepository],
})
export class CountryPolicyModule {}
