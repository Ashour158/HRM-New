import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

/**
 * Register the WorkerProfile finite-state machine with the framework.
 */
export function registerWorkerProfileFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'WorkerProfile',
    states: ['DRAFT', 'PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED', 'TERMINATED', 'REHIRED'],
    actions: [
      'ActivateWorker',
      'SuspendWorker',
      'ReinstateWorker',
      'TerminateWorker',
      'RehireWorker',
      'UpdateWorkerPersonalData',
      'UpsertWorkerProfileSection',
    ],
    transitions: [
      { action: 'ActivateWorker', from: 'DRAFT', to: 'PENDING_ACTIVATION', eventName: 'WorkerActivated' },
      { action: 'ActivateWorker', from: 'PENDING_ACTIVATION', to: 'ACTIVE', eventName: 'WorkerActivated' },
      { action: 'ActivateWorker', from: 'SUSPENDED', to: 'ACTIVE', eventName: 'WorkerReinstated' },
      { action: 'ActivateWorker', from: 'REHIRED', to: 'ACTIVE', eventName: 'WorkerActivated' },
      { action: 'SuspendWorker', from: 'ACTIVE', to: 'SUSPENDED', eventName: 'WorkerSuspended' },
      { action: 'ReinstateWorker', from: 'SUSPENDED', to: 'ACTIVE', eventName: 'WorkerReinstated' },
      { action: 'TerminateWorker', from: 'ACTIVE', to: 'TERMINATED', eventName: 'WorkerTerminated' },
      { action: 'TerminateWorker', from: 'SUSPENDED', to: 'TERMINATED', eventName: 'WorkerTerminated' },
      { action: 'RehireWorker', from: 'TERMINATED', to: 'REHIRED', eventName: 'WorkerRehired' },
      { action: 'UpdateWorkerPersonalData', from: 'DRAFT', to: 'DRAFT', eventName: 'WorkerProfileUpdated' },
      { action: 'UpdateWorkerPersonalData', from: 'PENDING_ACTIVATION', to: 'PENDING_ACTIVATION', eventName: 'WorkerProfileUpdated' },
      { action: 'UpdateWorkerPersonalData', from: 'ACTIVE', to: 'ACTIVE', eventName: 'WorkerProfileUpdated' },
      { action: 'UpdateWorkerPersonalData', from: 'SUSPENDED', to: 'SUSPENDED', eventName: 'WorkerProfileUpdated' },
      { action: 'UpdateWorkerPersonalData', from: 'TERMINATED', to: 'TERMINATED', eventName: 'WorkerProfileUpdated' },
      { action: 'UpdateWorkerPersonalData', from: 'REHIRED', to: 'REHIRED', eventName: 'WorkerProfileUpdated' },
      { action: 'UpsertWorkerProfileSection', from: 'DRAFT', to: 'DRAFT', eventName: 'PersonalDataRecordUpserted' },
      { action: 'UpsertWorkerProfileSection', from: 'PENDING_ACTIVATION', to: 'PENDING_ACTIVATION', eventName: 'PersonalDataRecordUpserted' },
      { action: 'UpsertWorkerProfileSection', from: 'ACTIVE', to: 'ACTIVE', eventName: 'PersonalDataRecordUpserted' },
      { action: 'UpsertWorkerProfileSection', from: 'SUSPENDED', to: 'SUSPENDED', eventName: 'PersonalDataRecordUpserted' },
      { action: 'UpsertWorkerProfileSection', from: 'TERMINATED', to: 'TERMINATED', eventName: 'PersonalDataRecordUpserted' },
      { action: 'UpsertWorkerProfileSection', from: 'REHIRED', to: 'REHIRED', eventName: 'PersonalDataRecordUpserted' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['TERMINATED'],
  };

  fsm.register(definition);
}
