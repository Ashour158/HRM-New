import { Module, OnModuleInit } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { FsmFramework } from '../../platform/workflow/fsm-framework.js';
import { AbsenceLeaveController } from './api/absence-leave.controller.js';
import { AbsenceRequestRepository } from './repositories/absence-request.repository.js';
import { LeaveCaseRepository } from './repositories/leave-case.repository.js';
import { AbsenceAccrualBalanceRepository } from './repositories/absence-accrual-balance.repository.js';
import { LeaveEntitlementCalculationRepository } from './repositories/leave-entitlement-calculation.repository.js';
import { CreateAbsenceRequestHandler } from './commands/create-absence-request.handler.js';
import { SubmitAbsenceRequestHandler } from './commands/submit-absence-request.handler.js';
import { ApproveAbsenceRequestHandler } from './commands/approve-absence-request.handler.js';
import { RejectAbsenceRequestHandler } from './commands/reject-absence-request.handler.js';
import { CancelAbsenceRequestHandler } from './commands/cancel-absence-request.handler.js';
import { OpenLeaveCaseHandler } from './commands/open-leave-case.handler.js';
import { ApproveLeaveCaseHandler } from './commands/approve-leave-case.handler.js';
import { ActivateLeaveCaseHandler } from './commands/activate-leave-case.handler.js';
import { PlanReturnToWorkHandler } from './commands/plan-return-to-work.handler.js';
import { CloseLeaveCaseHandler } from './commands/close-leave-case.handler.js';
import { RejectLeaveCaseHandler } from './commands/reject-leave-case.handler.js';
import { CreateAbsenceAccrualBalanceHandler } from './commands/create-absence-accrual-balance.handler.js';
import { UpdateAbsenceAccrualBalanceHandler } from './commands/update-absence-accrual-balance.handler.js';
import { CarryOverAbsenceAccrualBalanceHandler } from './commands/carry-over-absence-accrual-balance.handler.js';
import { CloseAbsenceAccrualBalanceHandler } from './commands/close-absence-accrual-balance.handler.js';
import { StartLeaveEntitlementCalculationHandler } from './commands/start-leave-entitlement-calculation.handler.js';
import { CompleteLeaveEntitlementCalculationHandler } from './commands/complete-leave-entitlement-calculation.handler.js';
import { FailLeaveEntitlementCalculationHandler } from './commands/fail-leave-entitlement-calculation.handler.js';
import { AbsenceLeaveEventsPublisher } from './events/absence-leave-events.publisher.js';
import { registerAbsenceRequestFsm } from './fsm/absence-request.fsm.js';
import { registerLeaveCaseFsm } from './fsm/leave-case.fsm.js';
import { registerAbsenceAccrualBalanceFsm } from './fsm/absence-accrual-balance.fsm.js';
import { registerLeaveEntitlementCalculationFsm } from './fsm/leave-entitlement-calculation.fsm.js';

@Module({
  imports: [PlatformModule],
  controllers: [AbsenceLeaveController],
  providers: [
    AbsenceRequestRepository,
    LeaveCaseRepository,
    AbsenceAccrualBalanceRepository,
    LeaveEntitlementCalculationRepository,
    CreateAbsenceRequestHandler,
    SubmitAbsenceRequestHandler,
    ApproveAbsenceRequestHandler,
    RejectAbsenceRequestHandler,
    CancelAbsenceRequestHandler,
    OpenLeaveCaseHandler,
    ApproveLeaveCaseHandler,
    ActivateLeaveCaseHandler,
    PlanReturnToWorkHandler,
    CloseLeaveCaseHandler,
    RejectLeaveCaseHandler,
    CreateAbsenceAccrualBalanceHandler,
    UpdateAbsenceAccrualBalanceHandler,
    CarryOverAbsenceAccrualBalanceHandler,
    CloseAbsenceAccrualBalanceHandler,
    StartLeaveEntitlementCalculationHandler,
    CompleteLeaveEntitlementCalculationHandler,
    FailLeaveEntitlementCalculationHandler,
    AbsenceLeaveEventsPublisher,
  ],
  exports: [AbsenceRequestRepository, LeaveCaseRepository, AbsenceAccrualBalanceRepository, LeaveEntitlementCalculationRepository],
})
export class AbsenceLeaveModule implements OnModuleInit {
  constructor(private readonly fsm: FsmFramework) {}

  onModuleInit(): void {
    registerAbsenceRequestFsm(this.fsm);
    registerLeaveCaseFsm(this.fsm);
    registerAbsenceAccrualBalanceFsm(this.fsm);
    registerLeaveEntitlementCalculationFsm(this.fsm);
  }
}
