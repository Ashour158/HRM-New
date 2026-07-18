import { Module, OnModuleInit } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { CompensationController } from './api/compensation.controller.js';

import { CompensationPlanRepository } from './repositories/compensation-plan.repository.js';
import { CompensationBandRepository } from './repositories/compensation-band.repository.js';
import { CompensationChangeRepository } from './repositories/compensation-change.repository.js';
import { BonusCycleRepository } from './repositories/bonus-cycle.repository.js';
import { EquityGrantRepository } from './repositories/equity-grant.repository.js';
import { VariableCompPlanRepository } from './repositories/variable-comp-plan.repository.js';
import { PayScaleRepository } from './repositories/pay-scale.repository.js';
import { TotalCompensationStatementRepository } from './repositories/total-compensation-statement.repository.js';

import { CompensationPlanFsm } from './fsm/compensation-plan.fsm.js';
import { CompensationBandFsm } from './fsm/compensation-band.fsm.js';
import { CompensationChangeFsm } from './fsm/compensation-change.fsm.js';
import { BonusCycleFsm } from './fsm/bonus-cycle.fsm.js';
import { EquityGrantFsm } from './fsm/equity-grant.fsm.js';
import { VariableCompPlanFsm } from './fsm/variable-comp-plan.fsm.js';
import { PayScaleFsm } from './fsm/pay-scale.fsm.js';
import { TotalCompensationStatementFsm } from './fsm/total-compensation-statement.fsm.js';

import { CompensationEventsPublisher } from './events/compensation-events.publisher.js';

import { CreateCompensationPlanHandler } from './commands/create-compensation-plan.handler.js';
import { ActivateCompensationPlanHandler } from './commands/activate-compensation-plan.handler.js';
import { SuspendCompensationPlanHandler } from './commands/suspend-compensation-plan.handler.js';
import { CloseCompensationPlanHandler } from './commands/close-compensation-plan.handler.js';
import { CreateCompensationBandHandler } from './commands/create-compensation-band.handler.js';
import { ActivateCompensationBandHandler } from './commands/activate-compensation-band.handler.js';
import { ReviseCompensationBandHandler } from './commands/revise-compensation-band.handler.js';
import { CloseCompensationBandHandler } from './commands/close-compensation-band.handler.js';
import { CreateCompensationChangeHandler } from './commands/create-compensation-change.handler.js';
import { ApproveCompensationChangeHandler } from './commands/approve-compensation-change.handler.js';
import { MakeEffectiveCompensationChangeHandler } from './commands/make-effective-compensation-change.handler.js';
import { CreateBonusCycleHandler } from './commands/create-bonus-cycle.handler.js';
import { ActivateBonusCycleHandler } from './commands/activate-bonus-cycle.handler.js';
import { StartBonusCycleCalculationHandler } from './commands/start-bonus-cycle-calculation.handler.js';
import { StartBonusCycleReviewHandler } from './commands/start-bonus-cycle-review.handler.js';
import { ApproveBonusCycleHandler } from './commands/approve-bonus-cycle.handler.js';
import { MarkBonusCyclePaidHandler } from './commands/mark-bonus-cycle-paid.handler.js';
import { CloseBonusCycleHandler } from './commands/close-bonus-cycle.handler.js';
import { CreateEquityGrantHandler } from './commands/create-equity-grant.handler.js';
import { StartEquityGrantVestingHandler } from './commands/start-equity-grant-vesting.handler.js';
import { RecordEquityGrantVestingHandler } from './commands/record-equity-grant-vesting.handler.js';
import { ExerciseEquityGrantHandler } from './commands/exercise-equity-grant.handler.js';
import { ExpireEquityGrantHandler } from './commands/expire-equity-grant.handler.js';
import { ForfeitEquityGrantHandler } from './commands/forfeit-equity-grant.handler.js';
import { CreateVariableCompPlanHandler } from './commands/create-variable-comp-plan.handler.js';
import { ActivateVariableCompPlanHandler } from './commands/activate-variable-comp-plan.handler.js';
import { CloseVariableCompPlanHandler } from './commands/close-variable-comp-plan.handler.js';
import { CreatePayScaleHandler } from './commands/create-pay-scale.handler.js';
import { ActivatePayScaleHandler } from './commands/activate-pay-scale.handler.js';
import { RevisePayScaleHandler } from './commands/revise-pay-scale.handler.js';
import { ClosePayScaleHandler } from './commands/close-pay-scale.handler.js';
import { CreateTotalCompensationStatementHandler } from './commands/create-total-compensation-statement.handler.js';
import { DeliverTotalCompensationStatementHandler } from './commands/deliver-total-compensation-statement.handler.js';
import { AcknowledgeTotalCompensationStatementHandler } from './commands/acknowledge-total-compensation-statement.handler.js';

/**
 * Compensation domain module.
 *
 * Owns CompensationPlan, CompensationBand, CompensationChange, BonusCycle,
 * EquityGrant, VariableCompPlan, PayScale, and TotalCompensationStatement aggregates.
 */
@Module({
  imports: [PlatformModule],
  controllers: [CompensationController],
  providers: [
    CompensationPlanRepository,
    CompensationBandRepository,
    CompensationChangeRepository,
    BonusCycleRepository,
    EquityGrantRepository,
    VariableCompPlanRepository,
    PayScaleRepository,
    TotalCompensationStatementRepository,
    CompensationPlanFsm,
    CompensationBandFsm,
    CompensationChangeFsm,
    BonusCycleFsm,
    EquityGrantFsm,
    VariableCompPlanFsm,
    PayScaleFsm,
    TotalCompensationStatementFsm,
    CompensationEventsPublisher,
    CreateCompensationPlanHandler,
    ActivateCompensationPlanHandler,
    SuspendCompensationPlanHandler,
    CloseCompensationPlanHandler,
    CreateCompensationBandHandler,
    ActivateCompensationBandHandler,
    ReviseCompensationBandHandler,
    CloseCompensationBandHandler,
    CreateCompensationChangeHandler,
    ApproveCompensationChangeHandler,
    MakeEffectiveCompensationChangeHandler,
    CreateBonusCycleHandler,
    ActivateBonusCycleHandler,
    StartBonusCycleCalculationHandler,
    StartBonusCycleReviewHandler,
    ApproveBonusCycleHandler,
    MarkBonusCyclePaidHandler,
    CloseBonusCycleHandler,
    CreateEquityGrantHandler,
    StartEquityGrantVestingHandler,
    RecordEquityGrantVestingHandler,
    ExerciseEquityGrantHandler,
    ExpireEquityGrantHandler,
    ForfeitEquityGrantHandler,
    CreateVariableCompPlanHandler,
    ActivateVariableCompPlanHandler,
    CloseVariableCompPlanHandler,
    CreatePayScaleHandler,
    ActivatePayScaleHandler,
    RevisePayScaleHandler,
    ClosePayScaleHandler,
    CreateTotalCompensationStatementHandler,
    DeliverTotalCompensationStatementHandler,
    AcknowledgeTotalCompensationStatementHandler,
  ],
  exports: [
    CompensationPlanRepository,
    CompensationBandRepository,
    CompensationChangeRepository,
    BonusCycleRepository,
    EquityGrantRepository,
    VariableCompPlanRepository,
    PayScaleRepository,
    TotalCompensationStatementRepository,
  ],
})
export class CompensationModule implements OnModuleInit {
  constructor(
    private readonly planFsm: CompensationPlanFsm,
    private readonly bandFsm: CompensationBandFsm,
    private readonly changeFsm: CompensationChangeFsm,
    private readonly bonusCycleFsm: BonusCycleFsm,
    private readonly equityGrantFsm: EquityGrantFsm,
    private readonly variableCompPlanFsm: VariableCompPlanFsm,
    private readonly payScaleFsm: PayScaleFsm,
    private readonly totalCompStatementFsm: TotalCompensationStatementFsm,
  ) {}

  onModuleInit(): void {
    this.planFsm.register();
    this.bandFsm.register();
    this.changeFsm.register();
    this.bonusCycleFsm.register();
    this.equityGrantFsm.register();
    this.variableCompPlanFsm.register();
    this.payScaleFsm.register();
    this.totalCompStatementFsm.register();
  }
}
