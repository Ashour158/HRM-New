import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

@Injectable()
export class ReportExecutionFsmRegistrar implements OnModuleInit {
  constructor(@Inject(FsmFramework) private readonly fsmFramework: FsmFramework) {}
  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'ReportExecution',
      states: ['PENDING', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'],
      actions: ['QueueReportExecution', 'StartReportExecution', 'CompleteReportExecution', 'FailReportExecution', 'CancelReportExecution'],
      transitions: [
        { action: 'QueueReportExecution', from: 'PENDING', to: 'QUEUED', eventName: 'ReportExecutionQueued' },
        { action: 'StartReportExecution', from: 'QUEUED', to: 'RUNNING', eventName: 'ReportExecutionStarted' },
        { action: 'CompleteReportExecution', from: 'RUNNING', to: 'COMPLETED', eventName: 'ReportExecutionCompleted' },
        { action: 'FailReportExecution', from: 'PENDING', to: 'FAILED', eventName: 'ReportExecutionFailed' },
        { action: 'FailReportExecution', from: 'QUEUED', to: 'FAILED', eventName: 'ReportExecutionFailed' },
        { action: 'FailReportExecution', from: 'RUNNING', to: 'FAILED', eventName: 'ReportExecutionFailed' },
        { action: 'CancelReportExecution', from: 'PENDING', to: 'CANCELLED', eventName: 'ReportExecutionCancelled' },
        { action: 'CancelReportExecution', from: 'QUEUED', to: 'CANCELLED', eventName: 'ReportExecutionCancelled' },
      ],
      initialState: 'PENDING',
      terminalStates: ['COMPLETED', 'FAILED', 'CANCELLED'],
    });
  }
}
