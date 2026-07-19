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
      'ApplyWorkerMassUpdate',
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
      // NOTE: the FSM's declared eventName below is metadata only (documentation /
      // FSM-transition lookups); it does not drive what actually gets published.
      // The real event emitted by WorkerProfile.updatePersonalData() is
      // `PersonalDataUpdated` (see worker-profile.aggregate.ts) -- no `WorkerProfileUpdated`
      // event class has ever existed. Corrected here to match reality.
      { action: 'UpdateWorkerPersonalData', from: 'DRAFT', to: 'DRAFT', eventName: 'PersonalDataUpdated' },
      { action: 'UpdateWorkerPersonalData', from: 'PENDING_ACTIVATION', to: 'PENDING_ACTIVATION', eventName: 'PersonalDataUpdated' },
      { action: 'UpdateWorkerPersonalData', from: 'ACTIVE', to: 'ACTIVE', eventName: 'PersonalDataUpdated' },
      { action: 'UpdateWorkerPersonalData', from: 'SUSPENDED', to: 'SUSPENDED', eventName: 'PersonalDataUpdated' },
      { action: 'UpdateWorkerPersonalData', from: 'TERMINATED', to: 'TERMINATED', eventName: 'PersonalDataUpdated' },
      { action: 'UpdateWorkerPersonalData', from: 'REHIRED', to: 'REHIRED', eventName: 'PersonalDataUpdated' },
      { action: 'UpsertWorkerProfileSection', from: 'DRAFT', to: 'DRAFT', eventName: 'PersonalDataRecordUpserted' },
      { action: 'UpsertWorkerProfileSection', from: 'PENDING_ACTIVATION', to: 'PENDING_ACTIVATION', eventName: 'PersonalDataRecordUpserted' },
      { action: 'UpsertWorkerProfileSection', from: 'ACTIVE', to: 'ACTIVE', eventName: 'PersonalDataRecordUpserted' },
      { action: 'UpsertWorkerProfileSection', from: 'SUSPENDED', to: 'SUSPENDED', eventName: 'PersonalDataRecordUpserted' },
      { action: 'UpsertWorkerProfileSection', from: 'TERMINATED', to: 'TERMINATED', eventName: 'PersonalDataRecordUpserted' },
      { action: 'UpsertWorkerProfileSection', from: 'REHIRED', to: 'REHIRED', eventName: 'PersonalDataRecordUpserted' },
      { action: 'ApplyWorkerMassUpdate', from: 'DRAFT', to: 'DRAFT', eventName: 'WorkerMassUpdateApplied' },
      { action: 'ApplyWorkerMassUpdate', from: 'PENDING_ACTIVATION', to: 'PENDING_ACTIVATION', eventName: 'WorkerMassUpdateApplied' },
      { action: 'ApplyWorkerMassUpdate', from: 'ACTIVE', to: 'ACTIVE', eventName: 'WorkerMassUpdateApplied' },
      { action: 'ApplyWorkerMassUpdate', from: 'SUSPENDED', to: 'SUSPENDED', eventName: 'WorkerMassUpdateApplied' },
      { action: 'ApplyWorkerMassUpdate', from: 'TERMINATED', to: 'TERMINATED', eventName: 'WorkerMassUpdateApplied' },
      { action: 'ApplyWorkerMassUpdate', from: 'REHIRED', to: 'REHIRED', eventName: 'WorkerMassUpdateApplied' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['TERMINATED'],
  };

  fsm.register(definition);
}
