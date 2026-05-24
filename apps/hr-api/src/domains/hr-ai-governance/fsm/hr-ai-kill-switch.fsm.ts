import { Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

@Injectable()
export class HrAiKillSwitchFsmRegistrar implements OnModuleInit {
  constructor(private readonly fsmFramework: FsmFramework) {}
  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'HrAiKillSwitch',
      states: ['ARMED', 'TRIGGERED', 'INVESTIGATING', 'RESOLVED', 'REARMED'],
      actions: ['TriggerHrAiKillSwitch', 'InvestigateHrAiKillSwitch', 'ResolveHrAiKillSwitch', 'RearmHrAiKillSwitch'],
      transitions: [
        { action: 'TriggerHrAiKillSwitch', from: 'ARMED', to: 'TRIGGERED', eventName: 'KillSwitchTriggered' },
        { action: 'TriggerHrAiKillSwitch', from: 'REARMED', to: 'TRIGGERED', eventName: 'KillSwitchTriggered' },
        { action: 'InvestigateHrAiKillSwitch', from: 'TRIGGERED', to: 'INVESTIGATING', eventName: 'KillSwitchInvestigating' },
        { action: 'ResolveHrAiKillSwitch', from: 'INVESTIGATING', to: 'RESOLVED', eventName: 'KillSwitchResolved' },
        { action: 'RearmHrAiKillSwitch', from: 'RESOLVED', to: 'REARMED', eventName: 'KillSwitchRearmed' },
      ],
      initialState: 'ARMED',
      terminalStates: ['REARMED'],
    });
  }
}
