import { Module } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { ComplianceController } from './api/compliance.controller.js';
import { PolicyDocumentFsmRegistrar } from './fsm/policy-document.fsm.js';
import { PolicyAcknowledgementFsmRegistrar } from './fsm/policy-acknowledgement.fsm.js';
import { LegalHoldFsmRegistrar } from './fsm/legal-hold.fsm.js';
import { StatutoryReportFsmRegistrar } from './fsm/statutory-report.fsm.js';
import { PolicyDocumentRepository } from './repositories/policy-document.repository.js';
import { PolicyAcknowledgementRepository } from './repositories/policy-acknowledgement.repository.js';
import { LegalHoldRepository } from './repositories/legal-hold.repository.js';
import { StatutoryReportRepository } from './repositories/statutory-report.repository.js';
import { CreatePolicyDocumentHandler } from './commands/create-policy-document.handler.js';
import { ApprovePolicyDocumentHandler } from './commands/approve-policy-document.handler.js';
import { PublishPolicyDocumentHandler } from './commands/publish-policy-document.handler.js';
import { RequirePolicyAcknowledgementHandler } from './commands/require-policy-acknowledgement.handler.js';
import { RecordPolicyAcknowledgementHandler } from './commands/record-policy-acknowledgement.handler.js';
import { PlaceLegalHoldHandler } from './commands/place-legal-hold.handler.js';
import { ReleaseLegalHoldHandler } from './commands/release-legal-hold.handler.js';
import { SubmitStatutoryReportHandler } from './commands/submit-statutory-report.handler.js';
import { ComplianceEventsPublisher } from './events/compliance-events.publisher.js';

/**
 * Compliance domain module.
 *
 * Owns PolicyDocument, PolicyAcknowledgement, LegalHold, and StatutoryReport aggregates.
 * Provides command handlers, repositories, FSM registrations, event publishing, and API endpoints.
 */
@Module({
  imports: [PlatformModule],
  controllers: [ComplianceController],
  providers: [
    // FSM registrars
    PolicyDocumentFsmRegistrar,
    PolicyAcknowledgementFsmRegistrar,
    LegalHoldFsmRegistrar,
    StatutoryReportFsmRegistrar,
    // Repositories
    PolicyDocumentRepository,
    PolicyAcknowledgementRepository,
    LegalHoldRepository,
    StatutoryReportRepository,
    // Command handlers
    CreatePolicyDocumentHandler,
    ApprovePolicyDocumentHandler,
    PublishPolicyDocumentHandler,
    RequirePolicyAcknowledgementHandler,
    RecordPolicyAcknowledgementHandler,
    PlaceLegalHoldHandler,
    ReleaseLegalHoldHandler,
    SubmitStatutoryReportHandler,
    // Event publisher
    ComplianceEventsPublisher,
  ],
  exports: [PolicyDocumentRepository, LegalHoldRepository, StatutoryReportRepository],
})
export class ComplianceModule {}
