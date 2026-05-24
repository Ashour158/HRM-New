import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerLearningContentPackageFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'LearningContentPackage',
    states: ['UPLOADED', 'PARSED', 'VALIDATED', 'PUBLISHED', 'DEPRECATED'],
    actions: ['CreateLearningContentPackage', 'ParseLearningContentPackage', 'ValidateLearningContentPackage', 'PublishLearningContentPackage', 'DeprecateLearningContentPackage'],
    transitions: [
      { action: 'CreateLearningContentPackage', from: 'UPLOADED', to: 'UPLOADED', eventName: 'ContentPackageUploaded' },
      { action: 'ParseLearningContentPackage', from: 'UPLOADED', to: 'PARSED', eventName: 'ContentPackageParsed' },
      { action: 'ValidateLearningContentPackage', from: 'PARSED', to: 'VALIDATED', eventName: 'ContentPackageValidated' },
      { action: 'PublishLearningContentPackage', from: 'VALIDATED', to: 'PUBLISHED', eventName: 'ContentPackagePublished' },
      { action: 'DeprecateLearningContentPackage', from: 'PUBLISHED', to: 'DEPRECATED', eventName: 'ContentPackageDeprecated' },
    ],
    initialState: 'UPLOADED',
    terminalStates: ['DEPRECATED'],
  };
  fsm.register(definition);
}
