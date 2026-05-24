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
import { CreateCompensationBandHandler } from './commands/create-compensation-band.handler.js';
import { CreateCompensationChangeHandler } from './commands/create-compensation-change.handler.js';
import { ApproveCompensationChangeHandler } from './commands/approve-compensation-change.handler.js';
import { CreateBonusCycleHandler } from './commands/create-bonus-cycle.handler.js';
import { CreateEquityGrantHandler } from './commands/create-equity-grant.handler.js';
import { CreateVariableCompPlanHandler } from './commands/create-variable-comp-plan.handler.js';
import { CreatePayScaleHandler } from './commands/create-pay-scale.handler.js';
import { CreateTotalCompensationStatementHandler } from './commands/create-total-compensation-statement.handler.js';

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
    CreateCompensationBandHandler,
    CreateCompensationChangeHandler,
    ApproveCompensationChangeHandler,
    CreateBonusCycleHandler,
    CreateEquityGrantHandler,
    CreateVariableCompPlanHandler,
    CreatePayScaleHandler,
    CreateTotalCompensationStatementHandler,
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
