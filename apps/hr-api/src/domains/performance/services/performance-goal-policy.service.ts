import { Injectable } from '@nestjs/common';

export interface SmartGoalCriteria {
  specific?: string;
  measurable?: string;
  achievable?: string;
  relevant?: string;
  timeBound?: string;
}

export interface SmartGoalDraft {
  title?: string;
  description?: string;
  targetValue?: number;
  unit?: string;
  startDate?: Date;
  dueDate?: Date;
  smartCriteria?: SmartGoalCriteria;
  metricName?: string;
}

export interface SmartGoalValidation {
  valid: boolean;
  score: number;
  missing: string[];
}

@Injectable()
export class PerformanceGoalPolicyService {
  validateSmartGoal(goal: SmartGoalDraft): SmartGoalValidation {
    const criteria = goal.smartCriteria ?? {};
    const checks: Array<[string, boolean]> = [
      ['specific', this.hasSignal(criteria.specific)],
      ['measurable', this.hasSignal(criteria.measurable) && typeof goal.targetValue === 'number' && Number.isFinite(goal.targetValue)],
      ['achievable', this.hasSignal(criteria.achievable)],
      ['relevant', this.hasSignal(criteria.relevant)],
      ['timeBound', this.hasSignal(criteria.timeBound) && goal.dueDate instanceof Date && !Number.isNaN(goal.dueDate.getTime())],
      ['targetValue', typeof goal.targetValue === 'number' && Number.isFinite(goal.targetValue)],
      ['dueDate', goal.dueDate instanceof Date && !Number.isNaN(goal.dueDate.getTime())],
      ['metricName', this.hasSignal(goal.metricName)],
    ];
    const missing = checks.filter(([, ok]) => !ok).map(([name]) => name);
    const score = Math.round(((checks.length - missing.length) / checks.length) * 100);
    return {
      valid: missing.length === 0,
      score,
      missing,
    };
  }

  assertSmartGoal(goal: SmartGoalDraft): void {
    const result = this.validateSmartGoal(goal);
    if (!result.valid) {
      throw new Error(`Goal must follow SMART rules. Missing: ${result.missing.join(', ')}`);
    }
  }

  private hasSignal(value?: string): boolean {
    return typeof value === 'string' && value.trim().length >= 5;
  }
}
