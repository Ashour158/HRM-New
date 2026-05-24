import { Injectable, OnModuleInit } from '@nestjs/common';
import { FsmFramework } from '../../../platform/workflow/fsm-framework.js';

/**
 * Finite-state machine registrar for the Position aggregate.
 *
 * States: DRAFT, ACTIVE, FROZEN, FILLED, VACANT, CLOSED
 */
@Injectable()
export class PositionFsmRegistrar implements OnModuleInit {
  constructor(private readonly fsmFramework: FsmFramework) {}

  onModuleInit(): void {
    this.fsmFramework.register({
      aggregateType: 'position',
      states: ['DRAFT', 'ACTIVE', 'FROZEN', 'FILLED', 'VACANT', 'CLOSED'],
      actions: ['Activate', 'Freeze', 'Unfreeze', 'Fill', 'Vacate', 'Close', 'Update'],
      transitions: [
        { action: 'Activate', from: 'DRAFT', to: 'ACTIVE', eventName: 'PositionActivated' },
        { action: 'Freeze', from: 'ACTIVE', to: 'FROZEN', eventName: 'PositionFrozen' },
        { action: 'Unfreeze', from: 'FROZEN', to: 'ACTIVE', eventName: 'PositionUnfrozen' },
        { action: 'Fill', from: 'ACTIVE', to: 'FILLED', eventName: 'PositionFilled' },
        { action: 'Fill', from: 'VACANT', to: 'FILLED', eventName: 'PositionFilled' },
        { action: 'Vacate', from: 'FILLED', to: 'VACANT', eventName: 'PositionVacated' },
        { action: 'Close', from: 'VACANT', to: 'CLOSED', eventName: 'PositionClosed' },
        { action: 'Close', from: 'ACTIVE', to: 'CLOSED', eventName: 'PositionClosed' },
        { action: 'Close', from: 'FROZEN', to: 'CLOSED', eventName: 'PositionClosed' },
        { action: 'Update', from: 'DRAFT', to: 'DRAFT', eventName: 'PositionUpdated' },
        { action: 'Update', from: 'ACTIVE', to: 'ACTIVE', eventName: 'PositionUpdated' },
        { action: 'Update', from: 'FROZEN', to: 'FROZEN', eventName: 'PositionUpdated' },
        { action: 'Update', from: 'FILLED', to: 'FILLED', eventName: 'PositionUpdated' },
        { action: 'Update', from: 'VACANT', to: 'VACANT', eventName: 'PositionUpdated' },
        { action: 'Update', from: 'CLOSED', to: 'CLOSED', eventName: 'PositionUpdated' },
      ],
      initialState: 'DRAFT',
      terminalStates: ['CLOSED'],
    });
  }
}
