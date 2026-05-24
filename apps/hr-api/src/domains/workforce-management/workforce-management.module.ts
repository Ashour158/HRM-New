import { Module, OnModuleInit } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { FsmFramework } from '../../platform/workflow/fsm-framework.js';
import { WorkforceManagementController } from './api/workforce-management.controller.js';
import { ShiftScheduleRepository } from './repositories/shift-schedule.repository.js';
import { OpenShiftRepository } from './repositories/open-shift.repository.js';
import { ShiftBidRepository } from './repositories/shift-bid.repository.js';
import { ShiftSwapRequestRepository } from './repositories/shift-swap-request.repository.js';
import { WfmOvertimeApprovalRepository } from './repositories/overtime-approval.repository.js';
import { CoverageGapRepository } from './repositories/coverage-gap.repository.js';
import { CreateShiftScheduleHandler } from './commands/create-shift-schedule.handler.js';
import { PublishShiftScheduleHandler } from './commands/publish-shift-schedule.handler.js';
import { ActivateShiftScheduleHandler } from './commands/activate-shift-schedule.handler.js';
import { ArchiveShiftScheduleHandler } from './commands/archive-shift-schedule.handler.js';
import { CreateOpenShiftHandler } from './commands/create-open-shift.handler.js';
import { MarkBidPendingOpenShiftHandler } from './commands/mark-bid-pending-open-shift.handler.js';
import { FillOpenShiftHandler } from './commands/fill-open-shift.handler.js';
import { CloseOpenShiftHandler } from './commands/close-open-shift.handler.js';
import { CancelOpenShiftHandler } from './commands/cancel-open-shift.handler.js';
import { CreateShiftBidHandler } from './commands/create-shift-bid.handler.js';
import { ApproveShiftBidHandler } from './commands/approve-shift-bid.handler.js';
import { RejectShiftBidHandler } from './commands/reject-shift-bid.handler.js';
import { CancelShiftBidHandler } from './commands/cancel-shift-bid.handler.js';
import { CreateShiftSwapRequestHandler } from './commands/create-shift-swap-request.handler.js';
import { ApproveShiftSwapRequestHandler } from './commands/approve-shift-swap-request.handler.js';
import { RejectShiftSwapRequestHandler } from './commands/reject-shift-swap-request.handler.js';
import { CancelShiftSwapRequestHandler } from './commands/cancel-shift-swap-request.handler.js';
import { RequestWfmOvertimeHandler } from './commands/request-wfm-overtime.handler.js';
import { ApproveWfmOvertimeHandler } from './commands/approve-wfm-overtime.handler.js';
import { RejectWfmOvertimeHandler } from './commands/reject-wfm-overtime.handler.js';
import { CancelWfmOvertimeHandler } from './commands/cancel-wfm-overtime.handler.js';
import { CreateCoverageGapHandler } from './commands/create-coverage-gap.handler.js';
import { NotifyCoverageGapHandler } from './commands/notify-coverage-gap.handler.js';
import { FillCoverageGapHandler } from './commands/fill-coverage-gap.handler.js';
import { CloseCoverageGapHandler } from './commands/close-coverage-gap.handler.js';
import { WorkforceManagementEventsPublisher } from './events/workforce-management-events.publisher.js';
import { registerShiftScheduleFsm } from './fsm/shift-schedule.fsm.js';
import { registerOpenShiftFsm } from './fsm/open-shift.fsm.js';
import { registerShiftBidFsm } from './fsm/shift-bid.fsm.js';
import { registerShiftSwapRequestFsm } from './fsm/shift-swap-request.fsm.js';
import { registerWfmOvertimeApprovalFsm } from './fsm/overtime-approval.fsm.js';
import { registerCoverageGapFsm } from './fsm/coverage-gap.fsm.js';

@Module({
  imports: [PlatformModule],
  controllers: [WorkforceManagementController],
  providers: [
    ShiftScheduleRepository,
    OpenShiftRepository,
    ShiftBidRepository,
    ShiftSwapRequestRepository,
    WfmOvertimeApprovalRepository,
    CoverageGapRepository,
    CreateShiftScheduleHandler,
    PublishShiftScheduleHandler,
    ActivateShiftScheduleHandler,
    ArchiveShiftScheduleHandler,
    CreateOpenShiftHandler,
    MarkBidPendingOpenShiftHandler,
    FillOpenShiftHandler,
    CloseOpenShiftHandler,
    CancelOpenShiftHandler,
    CreateShiftBidHandler,
    ApproveShiftBidHandler,
    RejectShiftBidHandler,
    CancelShiftBidHandler,
    CreateShiftSwapRequestHandler,
    ApproveShiftSwapRequestHandler,
    RejectShiftSwapRequestHandler,
    CancelShiftSwapRequestHandler,
    RequestWfmOvertimeHandler,
    ApproveWfmOvertimeHandler,
    RejectWfmOvertimeHandler,
    CancelWfmOvertimeHandler,
    CreateCoverageGapHandler,
    NotifyCoverageGapHandler,
    FillCoverageGapHandler,
    CloseCoverageGapHandler,
    WorkforceManagementEventsPublisher,
  ],
  exports: [ShiftScheduleRepository, OpenShiftRepository, ShiftBidRepository, ShiftSwapRequestRepository, WfmOvertimeApprovalRepository, CoverageGapRepository],
})
export class WorkforceManagementModule implements OnModuleInit {
  constructor(private readonly fsm: FsmFramework) {}

  onModuleInit(): void {
    registerShiftScheduleFsm(this.fsm);
    registerOpenShiftFsm(this.fsm);
    registerShiftBidFsm(this.fsm);
    registerShiftSwapRequestFsm(this.fsm);
    registerWfmOvertimeApprovalFsm(this.fsm);
    registerCoverageGapFsm(this.fsm);
  }
}
