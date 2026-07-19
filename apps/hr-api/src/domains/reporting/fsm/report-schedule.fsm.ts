import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

@Injectable()
export class ReportScheduleFsmRegistrar implements OnModuleInit {
  constructor(@Inject(FsmFramework) private readonly fsmFramework: FsmFramework) {}
  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'ReportSchedule',
      states: ['ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED'],
      actions: ['ActivateReportSchedule', 'PauseReportSchedule', 'ExpireReportSchedule', 'CancelReportSchedule', 'RecordReportScheduleRun'],
      transitions: [
        { action: 'ActivateReportSchedule', from: 'PAUSED', to: 'ACTIVE', eventName: 'ReportScheduleActivated' },
        { action: 'PauseReportSchedule', from: 'ACTIVE', to: 'PAUSED', eventName: 'ReportSchedulePaused' },
        { action: 'ExpireReportSchedule', from: 'ACTIVE', to: 'EXPIRED', eventName: 'ReportScheduleExpired' },
        { action: 'ExpireReportSchedule', from: 'PAUSED', to: 'EXPIRED', eventName: 'ReportScheduleExpired' },
        { action: 'CancelReportSchedule', from: 'ACTIVE', to: 'CANCELLED', eventName: 'ReportScheduleCancelled' },
        { action: 'CancelReportSchedule', from: 'PAUSED', to: 'CANCELLED', eventName: 'ReportScheduleCancelled' },
        { action: 'RecordReportScheduleRun', from: 'ACTIVE', to: 'ACTIVE', eventName: 'ReportScheduleRunRecorded' },
      ],
      initialState: 'ACTIVE',
      terminalStates: ['EXPIRED', 'CANCELLED'],
    });
  }
}
