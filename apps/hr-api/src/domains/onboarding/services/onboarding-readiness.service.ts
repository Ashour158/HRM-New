import { Injectable } from '@nestjs/common';
import type { OnboardingPlan } from '../aggregates/onboarding-plan.aggregate.js';
import type { OnboardingTask } from '../aggregates/onboarding-task.aggregate.js';

export interface OnboardingReadinessSummary {
  totalTasks: number;
  requiredTasks: number;
  completedTasks: number;
  overdueTasks: number;
  readinessScore: number;
  ownerGroupProgress: Array<{
    ownerGroup: string;
    total: number;
    completed: number;
    overdue: number;
  }>;
  gates: {
    preboardingComplete: boolean;
    documentsReady: boolean;
    signingReady: boolean;
    itProvisioningReady: boolean;
    complianceReady: boolean;
    probationReady: boolean;
  };
}

@Injectable()
export class OnboardingReadinessService {
  summarize(_plan: OnboardingPlan, tasks: OnboardingTask[]): OnboardingReadinessSummary {
    const required = tasks.filter((task) => task.required);
    const completedRequired = required.filter((task) => task.status === 'COMPLETED');
    const overdue = tasks.filter((task) => task.status === 'OVERDUE');
    const ownerGroups = Array.from(new Set(tasks.map((task) => task.ownerGroup))).sort();

    return {
      totalTasks: tasks.length,
      requiredTasks: required.length,
      completedTasks: tasks.filter((task) => task.status === 'COMPLETED').length,
      overdueTasks: overdue.length,
      readinessScore: required.length === 0 ? 0 : Math.round((completedRequired.length / required.length) * 100),
      ownerGroupProgress: ownerGroups.map((ownerGroup) => {
        const groupTasks = tasks.filter((task) => task.ownerGroup === ownerGroup);
        return {
          ownerGroup,
          total: groupTasks.length,
          completed: groupTasks.filter((task) => task.status === 'COMPLETED').length,
          overdue: groupTasks.filter((task) => task.status === 'OVERDUE').length,
        };
      }),
      gates: {
        preboardingComplete: this.categoryComplete(tasks, ['PREBOARDING', 'DOCUMENT', 'SIGNATURE']),
        documentsReady: this.categoryComplete(tasks, ['DOCUMENT']),
        signingReady: this.categoryComplete(tasks, ['SIGNATURE']),
        itProvisioningReady: this.categoryComplete(tasks, ['IT_PROVISIONING', 'FACILITY_ACCESS']),
        complianceReady: this.categoryComplete(tasks, ['COMPLIANCE', 'TRAINING']),
        probationReady: this.categoryComplete(tasks, ['PROBATION']),
      },
    };
  }

  private categoryComplete(tasks: OnboardingTask[], categories: string[]): boolean {
    const relevant = tasks.filter((task) => task.required && categories.includes(task.category));
    return relevant.length > 0 && relevant.every((task) => task.status === 'COMPLETED');
  }
}
