import { FsmFramework, type FsmDefinition } from '../../../platform/workflow/fsm-framework.js';

export function registerLearningCourseFsm(fsm: FsmFramework): void {
  const definition: FsmDefinition<string, string> = {
    aggregateType: 'LearningCourse',
    states: ['DRAFT', 'PUBLISHED', 'ARCHIVED', 'RETIRED'],
    actions: ['CreateLearningCourse', 'PublishLearningCourse', 'ArchiveLearningCourse', 'RetireLearningCourse'],
    transitions: [
      { action: 'CreateLearningCourse', from: 'DRAFT', to: 'DRAFT', eventName: 'LearningCourseCreated' },
      { action: 'PublishLearningCourse', from: 'DRAFT', to: 'PUBLISHED', eventName: 'LearningCoursePublished' },
      { action: 'ArchiveLearningCourse', from: 'PUBLISHED', to: 'ARCHIVED', eventName: 'LearningCourseArchived' },
      { action: 'RetireLearningCourse', from: 'PUBLISHED', to: 'RETIRED', eventName: 'LearningCourseRetired' },
      { action: 'RetireLearningCourse', from: 'ARCHIVED', to: 'RETIRED', eventName: 'LearningCourseRetired' },
    ],
    initialState: 'DRAFT',
    terminalStates: ['ARCHIVED', 'RETIRED'],
  };
  fsm.register(definition);
}
