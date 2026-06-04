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
import { ValidateCountryPolicyPackHandler } from './commands/validate-country-policy-pack.handler.js';
import { SimulateCountryPolicyPackImpactHandler } from './commands/simulate-country-policy-pack-impact.handler.js';
import { ApproveCountryPolicyPackHandler } from './commands/approve-country-policy-pack.handler.js';
import { PublishCountryPolicyPackHandler } from './commands/publish-country-policy-pack.handler.js';
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
    ValidateCountryPolicyPackHandler,
    SimulateCountryPolicyPackImpactHandler,
    ApproveCountryPolicyPackHandler,
    PublishCountryPolicyPackHandler,
    // Event publisher
    CountryPolicyEventsPublisher,
    // Saga
    CountryPolicyPublicationSaga,
  ],
  exports: [CountryPolicyPackRepository, CountryPolicyValidationRunRepository, CountryPolicyImpactSimulationRepository],
})
export class CountryPolicyModule {}
