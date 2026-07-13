import { Injectable } from '@nestjs/common';
import type { OffboardingPlan } from '../aggregates/offboarding-plan.aggregate.js';
import type { OffboardingTask } from '../aggregates/offboarding-task.aggregate.js';

export interface OffboardingProgressSummary {
  totalTasks: number;
  requiredTasks: number;
  completedTasks: number;
  overdueTasks: number;
  progressScore: number;
  ownerGroupProgress: Array<{
    ownerGroup: string;
    total: number;
    completed: number;
    overdue: number;
  }>;
  gates: {
    assetsReturned: boolean;
    accessRevoked: boolean;
    knowledgeTransferred: boolean;
    finalSettlementConfirmed: boolean;
    exitInterviewComplete: boolean;
  };
}

@Injectable()
export class OffboardingProgressService {
  summarize(_plan: OffboardingPlan, tasks: OffboardingTask[]): OffboardingProgressSummary {
    const required = tasks.filter((task) => task.required);
    const completedRequired = required.filter((task) => task.status === 'COMPLETED');
    const overdue = tasks.filter((task) => task.status === 'OVERDUE');
    const ownerGroups = Array.from(new Set(tasks.map((task) => task.ownerGroup))).sort();

    return {
      totalTasks: tasks.length,
      requiredTasks: required.length,
      completedTasks: tasks.filter((task) => task.status === 'COMPLETED').length,
      overdueTasks: overdue.length,
      progressScore: required.length === 0 ? 0 : Math.round((completedRequired.length / required.length) * 100),
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
        assetsReturned: this.categoryComplete(tasks, ['ASSET_RETURN']),
        accessRevoked: this.categoryComplete(tasks, ['ACCESS_REVOCATION_CONFIRMATION']),
        knowledgeTransferred: this.categoryComplete(tasks, ['KNOWLEDGE_TRANSFER']),
        finalSettlementConfirmed: this.categoryComplete(tasks, ['FINAL_SETTLEMENT_CONFIRMATION']),
        exitInterviewComplete: this.categoryComplete(tasks, ['EXIT_INTERVIEW']),
      },
    };
  }

  private categoryComplete(tasks: OffboardingTask[], categories: string[]): boolean {
    const relevant = tasks.filter((task) => task.required && categories.includes(task.category));
    return relevant.length > 0 && relevant.every((task) => task.status === 'COMPLETED');
  }
}
