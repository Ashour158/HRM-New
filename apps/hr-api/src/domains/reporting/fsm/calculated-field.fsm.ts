import { Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

@Injectable()
export class CalculatedFieldFsmRegistrar implements OnModuleInit {
  constructor(private readonly fsmFramework: FsmFramework) {}
  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'CalculatedField',
      states: ['DRAFT', 'ACTIVE', 'DEPRECATED'],
      actions: ['ActivateCalculatedField', 'DeprecateCalculatedField'],
      transitions: [
        { action: 'ActivateCalculatedField', from: 'DRAFT', to: 'ACTIVE', eventName: 'CalculatedFieldActivated' },
        { action: 'DeprecateCalculatedField', from: 'ACTIVE', to: 'DEPRECATED', eventName: 'CalculatedFieldDeprecated' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['DEPRECATED'],
    });
  }
}
