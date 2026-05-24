/**
 * @file ABAC Evaluation Engine
 * @description Attribute-Based Access Control evaluation engine.
 */

import type { Uuid } from '@hcm/shared-kernel';
import type { AbacContext, AbacDimension } from './dimensions.js';

/** Policy effect type. */
export type AbacEffect = 'ALLOW' | 'DENY';

/** ABAC decision result. */
export type AbacDecision = 'ALLOW' | 'DENY' | 'CONDITIONAL';

/** A single ABAC policy condition. */
export interface AbacCondition {
  dimension: AbacDimension;
  operator: 'equals' | 'contains' | 'in' | 'notEquals' | 'notIn' | 'true' | 'false';
  value?: unknown;
}

/** ABAC policy composed of conditions and an effect. */
export interface AbacPolicy {
  conditions: AbacCondition[];
  effect: AbacEffect;
}

/**
 * Engine for evaluating ABAC policies.
 */
export class AbacEngine {
  /**
   * Evaluate a policy against a context.
   * Returns ALLOW if all conditions match and effect is ALLOW.
   * Returns DENY if all conditions match and effect is DENY.
   * Returns CONDITIONAL if conditions partially match or context is incomplete.
   */
  evaluate(context: AbacContext, policy: AbacPolicy): AbacDecision {
    let allMatch = true;
    let anyFailed = false;

    for (const condition of policy.conditions) {
      const match = this.evaluateCondition(context, condition);
      if (match === false) {
        allMatch = false;
        anyFailed = true;
        break;
      }
      if (match === null) {
        allMatch = false;
      }
    }

    if (allMatch) {
      return policy.effect === 'ALLOW' ? 'ALLOW' : 'DENY';
    }
    if (anyFailed) {
      return policy.effect === 'DENY' ? 'ALLOW' : 'DENY';
    }
    return 'CONDITIONAL';
  }

  /**
   * Check whether the actor can access a specific worker record.
   */
  canAccessWorker(context: AbacContext, workerId: Uuid): boolean {
    if (context.isSelf && context.subjectWorkerId === workerId) return true;
    if (context.isManager || context.isManagerChain) return true;
    return this.hasScopeOverlap(context);
  }

  /**
   * Check whether the actor can access a specific department.
   */
  canAccessDepartment(context: AbacContext, departmentId: string): boolean {
    return context.departmentIds.includes(departmentId);
  }

  /**
   * Check whether the actor can access a specific legal entity.
   */
  canAccessLegalEntity(context: AbacContext, entityId: string): boolean {
    return context.legalEntityIds.includes(entityId);
  }

  /**
   * Check whether the actor can access data for a specific country.
   */
  canAccessCountry(context: AbacContext, countryCode: string): boolean {
    return context.countryCodes.includes(countryCode);
  }

  private evaluateCondition(context: AbacContext, condition: AbacCondition): boolean | null {
    const actual = this.resolveDimensionValue(context, condition.dimension);
    if (actual === undefined || actual === null) return null;

    switch (condition.operator) {
      case 'equals':
        return actual === condition.value;
      case 'notEquals':
        return actual !== condition.value;
      case 'contains': {
        if (Array.isArray(actual)) return actual.includes(condition.value as string);
        if (typeof actual === 'string') return actual.includes(String(condition.value));
        return false;
      }
      case 'in': {
        const expected = Array.isArray(condition.value) ? condition.value : [condition.value];
        if (Array.isArray(actual)) return actual.some((v) => expected.includes(v));
        return expected.includes(actual);
      }
      case 'notIn': {
        const excluded = Array.isArray(condition.value) ? condition.value : [condition.value];
        if (Array.isArray(actual)) return !actual.some((v) => excluded.includes(v));
        return !excluded.includes(actual);
      }
      case 'true':
        return actual === true;
      case 'false':
        return actual === false;
      default:
        return null;
    }
  }

  private resolveDimensionValue(context: AbacContext, dimension: AbacDimension): unknown {
    switch (dimension) {
      case 'SELF':
        return context.isSelf;
      case 'MANAGER_RELATIONSHIP':
        return context.isManager || context.isManagerChain;
      case 'LEGAL_ENTITY':
        return context.legalEntityIds;
      case 'COUNTRY':
        return context.countryCodes;
      case 'DEPARTMENT':
        return context.departmentIds;
      case 'CASE_OWNERSHIP':
        return context.caseOwnership;
      case 'RECRUITING_ASSIGNMENT':
        return context.recruitingAssignment;
      default:
        return undefined;
    }
  }

  private hasScopeOverlap(context: AbacContext): boolean {
    return (
      context.legalEntityIds.length > 0 ||
      context.countryCodes.length > 0 ||
      context.departmentIds.length > 0
    );
  }
}
