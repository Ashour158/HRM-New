import { Module, OnModuleInit } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { HcmSetupModule } from '../hcm-setup/hcm-setup.module.js';
import { HrCoreModule } from '../hr-core/hr-core.module.js';
import { AbsenceLeaveModule } from '../absence-leave/absence-leave.module.js';
import { FsmFramework } from '../../platform/workflow/fsm-framework.js';
import { TimeAttendanceController } from './api/time-attendance.controller.js';
import { WorkScheduleRepository } from './repositories/work-schedule.repository.js';
import { TimesheetRepository } from './repositories/timesheet.repository.js';
import { TimeClockEventRepository } from './repositories/time-clock-event.repository.js';
import { AttendanceExceptionRepository } from './repositories/attendance-exception.repository.js';
import { AttendanceDailyLedgerRepository } from './repositories/attendance-daily-ledger.repository.js';
import { AttendanceCorrectionRequestRepository } from './repositories/attendance-correction-request.repository.js';
import { OvertimeApprovalRepository } from './repositories/overtime-approval.repository.js';
import { CreateWorkScheduleHandler } from './commands/create-work-schedule.handler.js';
import { ActivateWorkScheduleHandler } from './commands/activate-work-schedule.handler.js';
import { ExpireWorkScheduleHandler } from './commands/expire-work-schedule.handler.js';
import { CreateTimesheetHandler } from './commands/create-timesheet.handler.js';
import { SubmitTimesheetHandler } from './commands/submit-timesheet.handler.js';
import { ApproveTimesheetHandler } from './commands/approve-timesheet.handler.js';
import { RejectTimesheetHandler } from './commands/reject-timesheet.handler.js';
import { CorrectTimesheetHandler } from './commands/correct-timesheet.handler.js';
import { RecordTimeClockEventHandler } from './commands/record-time-clock-event.handler.js';
import { CreateAttendanceCorrectionRequestHandler } from './commands/create-attendance-correction-request.handler.js';
import { ReviewAttendanceCorrectionRequestHandler } from './commands/review-attendance-correction-request.handler.js';
import { ApplyAttendanceCorrectionRequestHandler } from './commands/apply-attendance-correction-request.handler.js';
import { FinalizeAttendanceDailyLedgerHandler } from './commands/finalize-attendance-daily-ledger.handler.js';
import { ValidateTimeClockEventHandler } from './commands/validate-time-clock-event.handler.js';
import { ResolveTimeClockEventHandler } from './commands/resolve-time-clock-event.handler.js';
import { CreateAttendanceExceptionHandler } from './commands/create-attendance-exception.handler.js';
import { ReviewAttendanceExceptionHandler } from './commands/review-attendance-exception.handler.js';
import { ResolveAttendanceExceptionHandler } from './commands/resolve-attendance-exception.handler.js';
import { EscalateAttendanceExceptionHandler } from './commands/escalate-attendance-exception.handler.js';
import { RequestOvertimeHandler } from './commands/request-overtime.handler.js';
import { ApproveOvertimeHandler } from './commands/approve-overtime.handler.js';
import { RejectOvertimeHandler } from './commands/reject-overtime.handler.js';
import { CancelOvertimeHandler } from './commands/cancel-overtime.handler.js';
import { TimeAttendanceEventsPublisher } from './events/time-attendance-events.publisher.js';
import { AttendanceCalculationService } from './services/attendance-calculation.service.js';
import { AttendanceStateService } from './services/attendance-state.service.js';
import { AttendanceLedgerService } from './services/attendance-ledger.service.js';
import { AttendanceLedgerBuilderService } from './services/attendance-ledger-builder.service.js';
import { AttendancePolicyResolutionService } from './services/attendance-policy-resolution.service.js';
import { AttendanceTrustService } from './services/attendance-trust.service.js';
import { AttendanceFinalizationService } from './services/attendance-finalization.service.js';
import { AttendanceCloseReadinessService } from './services/attendance-close-readiness.service.js';
import { AttendanceCorrectionService } from './services/attendance-correction.service.js';
import { AttendanceGeolocationExportService } from './services/attendance-geolocation-export.service.js';
import { AttendanceTimesheetProjectionService } from './services/attendance-timesheet-projection.service.js';
import { AttendanceReminderService } from './services/attendance-reminder.service.js';
import { AttendanceReportingService } from './services/attendance-reporting.service.js';
import { registerWorkScheduleFsm } from './fsm/work-schedule.fsm.js';
import { registerTimesheetFsm } from './fsm/timesheet.fsm.js';
import { registerTimeClockEventFsm } from './fsm/time-clock-event.fsm.js';
import { registerAttendanceExceptionFsm } from './fsm/attendance-exception.fsm.js';
import { registerAttendanceCorrectionRequestFsm } from './fsm/attendance-correction-request.fsm.js';
import { registerOvertimeApprovalFsm } from './fsm/overtime-approval.fsm.js';

@Module({
  imports: [PlatformModule, HcmSetupModule, HrCoreModule, AbsenceLeaveModule],
  controllers: [TimeAttendanceController],
  providers: [
    WorkScheduleRepository,
    TimesheetRepository,
    TimeClockEventRepository,
    AttendanceExceptionRepository,
    AttendanceDailyLedgerRepository,
    AttendanceCorrectionRequestRepository,
    OvertimeApprovalRepository,
    CreateWorkScheduleHandler,
    ActivateWorkScheduleHandler,
    ExpireWorkScheduleHandler,
    CreateTimesheetHandler,
    SubmitTimesheetHandler,
    ApproveTimesheetHandler,
    RejectTimesheetHandler,
    CorrectTimesheetHandler,
    RecordTimeClockEventHandler,
    ValidateTimeClockEventHandler,
    ResolveTimeClockEventHandler,
    CreateAttendanceCorrectionRequestHandler,
    ReviewAttendanceCorrectionRequestHandler,
    ApplyAttendanceCorrectionRequestHandler,
    FinalizeAttendanceDailyLedgerHandler,
    CreateAttendanceExceptionHandler,
    ReviewAttendanceExceptionHandler,
    ResolveAttendanceExceptionHandler,
    EscalateAttendanceExceptionHandler,
    RequestOvertimeHandler,
    ApproveOvertimeHandler,
    RejectOvertimeHandler,
    CancelOvertimeHandler,
    TimeAttendanceEventsPublisher,
    AttendanceCalculationService,
    AttendanceStateService,
    AttendanceLedgerService,
    AttendanceLedgerBuilderService,
    AttendancePolicyResolutionService,
    AttendanceTrustService,
    AttendanceFinalizationService,
    AttendanceCloseReadinessService,
    AttendanceCorrectionService,
    AttendanceGeolocationExportService,
    AttendanceTimesheetProjectionService,
    AttendanceReminderService,
    AttendanceReportingService,
  ],
  exports: [WorkScheduleRepository, TimesheetRepository, TimeClockEventRepository, AttendanceExceptionRepository, AttendanceDailyLedgerRepository, AttendanceCorrectionRequestRepository, OvertimeApprovalRepository, AttendanceCalculationService, AttendanceStateService, AttendanceLedgerService, AttendanceLedgerBuilderService, AttendancePolicyResolutionService, AttendanceTrustService, AttendanceFinalizationService, AttendanceCloseReadinessService, AttendanceCorrectionService, AttendanceGeolocationExportService, AttendanceTimesheetProjectionService, AttendanceReminderService, AttendanceReportingService],
})
export class TimeAttendanceModule implements OnModuleInit {
  constructor(private readonly fsm: FsmFramework) {}

  onModuleInit(): void {
    registerWorkScheduleFsm(this.fsm);
    registerTimesheetFsm(this.fsm);
    registerTimeClockEventFsm(this.fsm);
    registerAttendanceExceptionFsm(this.fsm);
    registerAttendanceCorrectionRequestFsm(this.fsm);
    registerOvertimeApprovalFsm(this.fsm);
  }
}
