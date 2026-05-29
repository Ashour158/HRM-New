import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerKpiMeasurementFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'KpiMeasurement',
    states: ['RECORDED', 'VALIDATED', 'ADJUSTED'],
    actions: ['RecordKpiMeasurement', 'ValidateKpiMeasurement', 'AdjustKpiMeasurement'],
    transitions: [
      { action: 'RecordKpiMeasurement', from: 'RECORDED', to: 'RECORDED', eventName: 'KpiMeasurementRecorded' },
      { action: 'ValidateKpiMeasurement', from: 'RECORDED', to: 'VALIDATED', eventName: 'KpiMeasurementValidated' },
      { action: 'AdjustKpiMeasurement', from: 'RECORDED', to: 'ADJUSTED', eventName: 'KpiMeasurementAdjusted' },
      { action: 'AdjustKpiMeasurement', from: 'VALIDATED', to: 'ADJUSTED', eventName: 'KpiMeasurementAdjusted' },
    ],
    initialState: 'RECORDED',
    terminalStates: ['VALIDATED', 'ADJUSTED'],
  };
  fsm.register(definition);
}
