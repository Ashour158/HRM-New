import { Module, OnModuleInit } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { HcmSetupModule } from '../hcm-setup/hcm-setup.module.js';
import { BenefitsController } from './api/benefits.controller.js';

import { BenefitsProgramRepository } from './repositories/benefits-program.repository.js';
import { BenefitsEnrollmentRepository } from './repositories/benefits-enrollment.repository.js';
import { BenefitsLifeEventRepository } from './repositories/benefits-life-event.repository.js';
import { SpendingAccountRepository } from './repositories/spending-account.repository.js';
import { CarrierReconciliationRunRepository } from './repositories/carrier-reconciliation-run.repository.js';

import { BenefitsProgramFsm } from './fsm/benefits-program.fsm.js';
import { BenefitsEnrollmentFsm } from './fsm/benefits-enrollment.fsm.js';
import { BenefitsLifeEventFsm } from './fsm/benefits-life-event.fsm.js';
import { SpendingAccountFsm } from './fsm/spending-account.fsm.js';
import { CarrierReconciliationRunFsm } from './fsm/carrier-reconciliation-run.fsm.js';

import { BenefitsEventsPublisher } from './events/benefits-events.publisher.js';

import { CreateBenefitsProgramHandler } from './commands/create-benefits-program.handler.js';
import { ActivateBenefitsProgramHandler } from './commands/activate-benefits-program.handler.js';
import { SuspendBenefitsProgramHandler } from './commands/suspend-benefits-program.handler.js';
import { CloseBenefitsProgramHandler } from './commands/close-benefits-program.handler.js';
import { CreateBenefitsEnrollmentHandler } from './commands/create-benefits-enrollment.handler.js';
import { CreateBenefitsLifeEventHandler } from './commands/create-benefits-life-event.handler.js';
import { ApproveBenefitsEnrollmentHandler } from './commands/approve-benefits-enrollment.handler.js';
import { RejectBenefitsEnrollmentHandler } from './commands/reject-benefits-enrollment.handler.js';
import { MakeEffectiveBenefitsEnrollmentHandler } from './commands/make-effective-benefits-enrollment.handler.js';
import { TerminateBenefitsEnrollmentHandler } from './commands/terminate-benefits-enrollment.handler.js';
import { ProcessBenefitsLifeEventHandler } from './commands/process-benefits-life-event.handler.js';
import { RejectBenefitsLifeEventHandler } from './commands/reject-benefits-life-event.handler.js';
import { CreateSpendingAccountHandler } from './commands/create-spending-account.handler.js';
import { RecordSpendingAccountUsageHandler } from './commands/record-spending-account-usage.handler.js';
import { CloseSpendingAccountHandler } from './commands/close-spending-account.handler.js';
import { CreateCarrierReconciliationRunHandler } from './commands/create-carrier-reconciliation-run.handler.js';
import { DetectCarrierReconciliationVarianceHandler } from './commands/detect-carrier-reconciliation-variance.handler.js';
import { ReconcileCarrierReconciliationRunHandler } from './commands/reconcile-carrier-reconciliation-run.handler.js';
import { FailCarrierReconciliationRunHandler } from './commands/fail-carrier-reconciliation-run.handler.js';

/**
 * Benefits domain module.
 *
 * Owns BenefitsProgram, BenefitsEnrollment, BenefitsLifeEvent,
 * SpendingAccount, and CarrierReconciliationRun aggregates.
 */
@Module({
  imports: [PlatformModule, HcmSetupModule],
  controllers: [BenefitsController],
  providers: [
    BenefitsProgramRepository,
    BenefitsEnrollmentRepository,
    BenefitsLifeEventRepository,
    SpendingAccountRepository,
    CarrierReconciliationRunRepository,
    BenefitsProgramFsm,
    BenefitsEnrollmentFsm,
    BenefitsLifeEventFsm,
    SpendingAccountFsm,
    CarrierReconciliationRunFsm,
    BenefitsEventsPublisher,
    CreateBenefitsProgramHandler,
    ActivateBenefitsProgramHandler,
    SuspendBenefitsProgramHandler,
    CloseBenefitsProgramHandler,
    CreateBenefitsEnrollmentHandler,
    CreateBenefitsLifeEventHandler,
    ApproveBenefitsEnrollmentHandler,
    RejectBenefitsEnrollmentHandler,
    MakeEffectiveBenefitsEnrollmentHandler,
    TerminateBenefitsEnrollmentHandler,
    ProcessBenefitsLifeEventHandler,
    RejectBenefitsLifeEventHandler,
    CreateSpendingAccountHandler,
    RecordSpendingAccountUsageHandler,
    CloseSpendingAccountHandler,
    CreateCarrierReconciliationRunHandler,
    DetectCarrierReconciliationVarianceHandler,
    ReconcileCarrierReconciliationRunHandler,
    FailCarrierReconciliationRunHandler,
  ],
  exports: [
    BenefitsProgramRepository,
    BenefitsEnrollmentRepository,
    BenefitsLifeEventRepository,
    SpendingAccountRepository,
    CarrierReconciliationRunRepository,
  ],
})
export class BenefitsModule implements OnModuleInit {
  constructor(
    private readonly programFsm: BenefitsProgramFsm,
    private readonly enrollmentFsm: BenefitsEnrollmentFsm,
    private readonly lifeEventFsm: BenefitsLifeEventFsm,
    private readonly spendingAccountFsm: SpendingAccountFsm,
    private readonly reconciliationRunFsm: CarrierReconciliationRunFsm,
  ) {}

  onModuleInit(): void {
    this.programFsm.register();
    this.enrollmentFsm.register();
    this.lifeEventFsm.register();
    this.spendingAccountFsm.register();
    this.reconciliationRunFsm.register();
  }
}
