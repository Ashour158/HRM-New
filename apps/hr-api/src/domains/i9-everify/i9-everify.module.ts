import { Module } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { IntegrationsModule } from '../../integrations/integrations.module.js';
import { I9CaseFsmRegistrar } from './fsm/i9-case.fsm.js';
import { EverifyCaseFsmRegistrar } from './fsm/everify-case.fsm.js';
import { I9CaseRepository } from './repositories/i9-case.repository.js';
import { EverifyCaseRepository } from './repositories/everify-case.repository.js';
import { CreateI9CaseHandler } from './commands/create-i9-case.handler.js';
import {
  CompleteI9CaseSection1Handler,
  CompleteI9CaseSection2Handler,
  RejectI9CaseHandler,
} from './commands/i9-case-lifecycle.handlers.js';
import {
  SubmitEverifyCaseHandler,
  RecordEverifyResultHandler,
  ContestEverifyTentativeNonconfirmationHandler,
} from './commands/everify-case-lifecycle.handlers.js';
import { I9EverifyEventsPublisher } from './events/i9-everify-events.publisher.js';

/**
 * I9/E-Verify domain module.
 *
 * Owns the I9Case and EverifyCase aggregates: employment-eligibility
 * verification (Form I-9 Section 1/2) and the optional federal E-Verify
 * submission sub-lifecycle. Provides command handlers, repositories, and FSM
 * registrations. Depends on {@link IntegrationsModule} for the {@link EverifyAdapter}
 * used by SubmitEverifyCase.
 */
@Module({
  imports: [PlatformModule, IntegrationsModule],
  providers: [
    // FSM registrars
    I9CaseFsmRegistrar,
    EverifyCaseFsmRegistrar,
    // Repositories
    I9CaseRepository,
    EverifyCaseRepository,
    // Command handlers
    CreateI9CaseHandler,
    CompleteI9CaseSection1Handler,
    CompleteI9CaseSection2Handler,
    RejectI9CaseHandler,
    SubmitEverifyCaseHandler,
    RecordEverifyResultHandler,
    ContestEverifyTentativeNonconfirmationHandler,
    // Event publisher
    I9EverifyEventsPublisher,
  ],
  exports: [I9CaseRepository, EverifyCaseRepository],
})
export class I9EverifyModule {}
