/**
 * Integrations Module
 *
 * Aggregates all external adapter modules, registers every adapter with the
 * {@link IntegrationOrchestrator}, and wires event consumers via the inbox
 * pattern.
 *
 * Architecture rules:
 * - HR Core owns worker/employment truth
 * - IAM owns login identity and credentials
 * - Payroll produces pay-cycle facts; Finance/ERP owns GL
 * - Benefits integrates with carriers
 * - Learning integrates with external LMS (SCORM/xAPI)
 * - Tax integrates with tax authorities
 * - Contingent integrates with VMS
 * - Analytics exports to data warehouse
 * - No integration may directly mutate another domain's tables
 */

import { Module, OnModuleInit } from '@nestjs/common';
import { PlatformModule } from '../platform/platform.module.js';
import { IntegrationOrchestrator } from './integration-orchestrator.service.js';
import { IntegrationHealthService } from './integration-health.service.js';
import { IntegrationsController } from './api/integrations.controller.js';

// Adapters
import {
  IamProvisioningAdapter,
  PayrollExportAdapter,
  BenefitsCarrierAdapter,
  LmsIntegrationAdapter,
  TaxAuthorityAdapter,
  VmsIntegrationAdapter,
  DataWarehouseAdapter,
  EmailNotificationAdapter,
} from './adapters/index.js';

// Consumers
import {
  IamEventConsumer,
  PayrollExportConsumer,
  BenefitsCarrierConsumer,
  LearningLmsConsumer,
  TaxFilingConsumer,
  VmsSyncConsumer,
  WarehouseExportConsumer,
  EmailNotificationEventConsumer,
  EmailNotificationRecipientResolver,
} from './consumers/index.js';

const ADAPTERS = [
  IamProvisioningAdapter,
  PayrollExportAdapter,
  BenefitsCarrierAdapter,
  LmsIntegrationAdapter,
  TaxAuthorityAdapter,
  VmsIntegrationAdapter,
  DataWarehouseAdapter,
  EmailNotificationAdapter,
];

const CONSUMERS = [
  IamEventConsumer,
  PayrollExportConsumer,
  BenefitsCarrierConsumer,
  LearningLmsConsumer,
  TaxFilingConsumer,
  VmsSyncConsumer,
  WarehouseExportConsumer,
  EmailNotificationEventConsumer,
];

@Module({
  imports: [PlatformModule],
  controllers: [IntegrationsController],
  providers: [
    IntegrationOrchestrator,
    IntegrationHealthService,
    ...ADAPTERS,
    ...CONSUMERS,
    EmailNotificationRecipientResolver,
  ],
  exports: [IntegrationOrchestrator, IntegrationHealthService, ...ADAPTERS],
})
export class IntegrationsModule implements OnModuleInit {
  constructor(
    private readonly orchestrator: IntegrationOrchestrator,
    private readonly iam: IamProvisioningAdapter,
    private readonly payroll: PayrollExportAdapter,
    private readonly benefits: BenefitsCarrierAdapter,
    private readonly lms: LmsIntegrationAdapter,
    private readonly tax: TaxAuthorityAdapter,
    private readonly vms: VmsIntegrationAdapter,
    private readonly warehouse: DataWarehouseAdapter,
    private readonly email: EmailNotificationAdapter,
  ) {}

  onModuleInit(): void {
    this.orchestrator.registerAdapter(this.iam);
    this.orchestrator.registerAdapter(this.payroll);
    this.orchestrator.registerAdapter(this.benefits);
    this.orchestrator.registerAdapter(this.lms);
    this.orchestrator.registerAdapter(this.tax);
    this.orchestrator.registerAdapter(this.vms);
    this.orchestrator.registerAdapter(this.warehouse);
    this.orchestrator.registerAdapter(this.email);
  }
}
