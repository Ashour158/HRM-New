import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerKpiFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'KeyPerformanceIndicator',
    states: ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'],
    actions: ['CreateKpi', 'ActivateKpi', 'UpdateKpiActual', 'ArchiveKpi'],
    transitions: [
      { action: 'CreateKpi', from: 'DRAFT', to: 'DRAFT', eventName: 'KpiCreated' },
      { action: 'ActivateKpi', from: 'DRAFT', to: 'ACTIVE', eventName: 'KpiActivated' },
      { action: 'UpdateKpiActual', from: 'ACTIVE', to: 'ACTIVE', eventName: 'KpiActualUpdated' },
      { action: 'UpdateKpiActual', from: 'INACTIVE', to: 'INACTIVE', eventName: 'KpiActualUpdated' },
      { action: 'ArchiveKpi', from: 'ACTIVE', to: 'ARCHIVED', eventName: 'KpiArchived' },
      { action: 'ArchiveKpi', from: 'INACTIVE', to: 'ARCHIVED', eventName: 'KpiArchived' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['ARCHIVED'],
  };
  fsm.register(definition);
}
