/**
 * @file Field-Level Access Policy
 * @description Field-level decisions, masking rules, and evaluation engine.
 */

import type { AbacContext } from '../abac/dimensions.js';

/** Canonical field access decisions. */
export enum FieldAccessDecision {
  VISIBLE = 'FIELD_VISIBLE',
  MASKED = 'FIELD_MASKED',
  HIDDEN = 'FIELD_HIDDEN',
  REQUIRES_STEP_UP = 'ACCESS_REQUIRES_STEP_UP',
  REQUIRES_BREAK_GLASS = 'ACCESS_REQUIRES_BREAK_GLASS',
  DENIED_SPECIAL_CATEGORY = 'ACCESS_DENIED_SPECIAL_CATEGORY',
  DENIED_NO_BUSINESS_NEED = 'ACCESS_DENIED_NO_BUSINESS_NEED',
}

/** Data classification levels for fields. */
export type DataClassification = 'LOW' | 'CONFIDENTIAL' | 'HIGH_SENSITIVITY' | 'SPECIAL_CATEGORY' | 'LEGAL_HOLD';

/** Masking rules applied when a field is MASKED. */
export type MaskingRule = 'SHOW_LAST_4' | 'SHOW_RANGE' | 'SHOW_INITIALS' | 'SHOW_HASH' | 'FULL_MASK';

/**
 * Policy for a single field path.
 */
export interface FieldPolicy {
  /** Dot-notation path to the field (e.g., "worker.compensation.salary"). */
  fieldPath: string;
  /** Data classification of this field. */
  dataClassification: DataClassification;
  /** Decision per role code. */
  roleDecisions: Record<string, FieldAccessDecision>;
  /** Decision when actor is the subject (self-service). */
  selfServiceDecision: FieldAccessDecision;
  /** Decision when actor is the direct manager of the subject. */
  managerDecision: FieldAccessDecision;
  /** Optional masking rule to apply when decision is MASKED. */
  maskingRule?: MaskingRule;
}

/** Result of evaluating a single field. */
export interface FieldAccessResult {
  fieldPath: string;
  decision: FieldAccessDecision;
  maskingRule?: MaskingRule;
  maskedValue?: unknown;
}

/** Pre-built canonical field policies. */
const DEFAULT_FIELD_POLICIES: FieldPolicy[] = [
  {
    fieldPath: 'worker.name',
    dataClassification: 'LOW',
    roleDecisions: {
      HR_ADMIN: FieldAccessDecision.VISIBLE,
      HRBP: FieldAccessDecision.VISIBLE,
      MANAGER: FieldAccessDecision.VISIBLE,
      EMPLOYEE: FieldAccessDecision.VISIBLE,
      PAYROLL_ADMIN: FieldAccessDecision.VISIBLE,
      BENEFITS_ADMIN: FieldAccessDecision.VISIBLE,
      RECRUITER: FieldAccessDecision.VISIBLE,
      COMPLIANCE_OFFICER: FieldAccessDecision.VISIBLE,
      LEGAL: FieldAccessDecision.VISIBLE,
    },
    selfServiceDecision: FieldAccessDecision.VISIBLE,
    managerDecision: FieldAccessDecision.VISIBLE,
  },
  {
    fieldPath: 'worker.ssn',
    dataClassification: 'SPECIAL_CATEGORY',
    roleDecisions: {
      HR_ADMIN: FieldAccessDecision.MASKED,
      PAYROLL_ADMIN: FieldAccessDecision.MASKED,
      COMPLIANCE_OFFICER: FieldAccessDecision.MASKED,
      LEGAL: FieldAccessDecision.MASKED,
    },
    selfServiceDecision: FieldAccessDecision.MASKED,
    managerDecision: FieldAccessDecision.HIDDEN,
    maskingRule: 'SHOW_LAST_4',
  },
  {
    fieldPath: 'worker.compensation.salary',
    dataClassification: 'HIGH_SENSITIVITY',
    roleDecisions: {
      HR_ADMIN: FieldAccessDecision.VISIBLE,
      COMPENSATION_ADMIN: FieldAccessDecision.VISIBLE,
      PAYROLL_ADMIN: FieldAccessDecision.VISIBLE,
      HRBP: FieldAccessDecision.MASKED,
      MANAGER: FieldAccessDecision.MASKED,
      EXECUTIVE_VIEWER: FieldAccessDecision.MASKED,
    },
    selfServiceDecision: FieldAccessDecision.VISIBLE,
    managerDecision: FieldAccessDecision.MASKED,
    maskingRule: 'SHOW_RANGE',
  },
  {
    fieldPath: 'worker.compensation.bankAccount',
    dataClassification: 'HIGH_SENSITIVITY',
    roleDecisions: {
      PAYROLL_ADMIN: FieldAccessDecision.MASKED,
    },
    selfServiceDecision: FieldAccessDecision.MASKED,
    managerDecision: FieldAccessDecision.HIDDEN,
    maskingRule: 'SHOW_LAST_4',
  },
  {
    fieldPath: 'worker.medicalInfo',
    dataClassification: 'SPECIAL_CATEGORY',
    roleDecisions: {
      BENEFITS_ADMIN: FieldAccessDecision.REQUIRES_STEP_UP,
      HR_ADMIN: FieldAccessDecision.REQUIRES_BREAK_GLASS,
    },
    selfServiceDecision: FieldAccessDecision.VISIBLE,
    managerDecision: FieldAccessDecision.DENIED_SPECIAL_CATEGORY,
  },
  {
    fieldPath: 'worker.legalHoldNotes',
    dataClassification: 'LEGAL_HOLD',
    roleDecisions: {
      LEGAL: FieldAccessDecision.VISIBLE,
      COMPLIANCE_OFFICER: FieldAccessDecision.VISIBLE,
    },
    selfServiceDecision: FieldAccessDecision.DENIED_NO_BUSINESS_NEED,
    managerDecision: FieldAccessDecision.DENIED_NO_BUSINESS_NEED,
  },
  {
    fieldPath: 'worker.performance.rating',
    dataClassification: 'CONFIDENTIAL',
    roleDecisions: {
      HR_ADMIN: FieldAccessDecision.VISIBLE,
      HRBP: FieldAccessDecision.VISIBLE,
      MANAGER: FieldAccessDecision.VISIBLE,
      EXECUTIVE_VIEWER: FieldAccessDecision.MASKED,
    },
    selfServiceDecision: FieldAccessDecision.VISIBLE,
    managerDecision: FieldAccessDecision.VISIBLE,
  },
  {
    fieldPath: 'worker.diversityData',
    dataClassification: 'SPECIAL_CATEGORY',
    roleDecisions: {
      COMPLIANCE_OFFICER: FieldAccessDecision.REQUIRES_STEP_UP,
      LEGAL: FieldAccessDecision.REQUIRES_STEP_UP,
    },
    selfServiceDecision: FieldAccessDecision.VISIBLE,
    managerDecision: FieldAccessDecision.DENIED_SPECIAL_CATEGORY,
  },
  {
    // Voluntary candidate EEO self-identification. Recruiting's own read
    // model (RecruitingController.getCandidate) never surfaces this field at
    // all; this policy entry governs it wherever it is evaluated through the
    // generic field-access pathway. Hiring managers (managerDecision) and any
    // role not listed here (e.g. RECRUITER) are denied.
    fieldPath: 'candidate.eeoSelfIdentification',
    dataClassification: 'SPECIAL_CATEGORY',
    roleDecisions: {
      COMPLIANCE_OFFICER: FieldAccessDecision.REQUIRES_STEP_UP,
      DEI_ANALYTICS_ADMIN: FieldAccessDecision.REQUIRES_STEP_UP,
    },
    selfServiceDecision: FieldAccessDecision.DENIED_NO_BUSINESS_NEED,
    managerDecision: FieldAccessDecision.DENIED_SPECIAL_CATEGORY,
  },
];

/**
 * Engine for evaluating field-level access policies.
 */
export class FieldPolicyEngine {
  private readonly policies: Map<string, FieldPolicy>;

  constructor(policies: FieldPolicy[] = DEFAULT_FIELD_POLICIES) {
    this.policies = new Map(policies.map((p) => [p.fieldPath, p]));
  }

  /**
   * Evaluate access for a single field.
   * @param fieldPath - Dot-notation field path
   * @param actorRoles - Roles held by the actor
   * @param abacContext - ABAC context (relationship, scope, etc.)
   * @param dataClassification - Classification of the data being accessed
   */
  evaluateFieldAccess(
    fieldPath: string,
    actorRoles: string[],
    abacContext: AbacContext,
    dataClassification: DataClassification,
    actorPermissions: string[] = [],
  ): FieldAccessResult {
    const policy = this.policies.get(fieldPath);
    let decision: FieldAccessDecision;
    let maskingRule: MaskingRule | undefined;

    if (policy) {
      decision = this.resolveDecisionFromPolicy(policy, actorRoles, abacContext);
      maskingRule = policy.maskingRule;
    } else {
      // Default heuristic when no explicit policy exists
      decision = this.resolveHeuristicDecision(fieldPath, actorRoles, actorPermissions, abacContext, dataClassification);
      maskingRule = defaultMaskingRuleFor(dataClassification, fieldPath);
    }

    decision = this.enforceClassifiedPermission(fieldPath, dataClassification, decision, actorPermissions, abacContext);
    if (decision === FieldAccessDecision.MASKED && !maskingRule) {
      maskingRule = defaultMaskingRuleFor(dataClassification, fieldPath);
    }

    return { fieldPath, decision, maskingRule };
  }

  /**
   * Apply a masking rule to a value.
   */
  applyMasking(value: unknown, rule: MaskingRule): unknown {
    const str = String(value ?? '');
    switch (rule) {
      case 'SHOW_LAST_4':
        return str.length > 4 ? `****${str.slice(-4)}` : '****';
      case 'SHOW_RANGE': {
        const num = Number(value);
        if (Number.isNaN(num)) return '***';
        const lower = Math.floor(num / 10000) * 10000;
        return `$${lower.toLocaleString()} - $${(lower + 10000).toLocaleString()}`;
      }
      case 'SHOW_INITIALS':
        return str
          .split(/\s+/)
          .map((w) => w[0])
          .join('')
          .toUpperCase();
      case 'SHOW_HASH':
        return `sha256:${str.length > 8 ? str.slice(0, 4) : ''}...${str.length > 8 ? str.slice(-4) : ''}`;
      case 'FULL_MASK':
        return '****';
      default:
        return '****';
    }
  }

  /**
   * Filter an object's fields based on policies.
   * Returns a shallow partial copy with accessible fields.
   */
  filterObjectFields<T extends Record<string, unknown>>(
    obj: T,
    policies: FieldPolicy[],
    actorRoles: string[],
    abacContext: AbacContext,
  ): Partial<T> {
    const engine = new FieldPolicyEngine(policies);
    const result: Partial<T> = {};

    for (const key of Object.keys(obj)) {
      const fieldPath = key; // simplified flat mapping; nested paths require caller adaptation
      const policy = engine.policies.get(fieldPath);
      const classification: DataClassification = policy?.dataClassification ?? 'LOW';
      const evaluation = engine.evaluateFieldAccess(fieldPath, actorRoles, abacContext, classification);

      if (evaluation.decision === FieldAccessDecision.VISIBLE) {
        result[key as keyof T] = obj[key] as T[keyof T];
      } else if (evaluation.decision === FieldAccessDecision.MASKED && evaluation.maskingRule) {
        (result as Record<string, unknown>)[key] = engine.applyMasking(obj[key], evaluation.maskingRule);
      }
      // HIDDEN and DENIED variants omit the key entirely
    }

    return result;
  }

  private resolveDecisionFromPolicy(
    policy: FieldPolicy,
    actorRoles: string[],
    abacContext: AbacContext,
  ): FieldAccessDecision {
    if (abacContext.isSelf) {
      return policy.selfServiceDecision;
    }
    if (abacContext.isManager) {
      return policy.managerDecision;
    }
    for (const role of actorRoles) {
      if (policy.roleDecisions[role]) {
        return policy.roleDecisions[role];
      }
    }
    return FieldAccessDecision.DENIED_NO_BUSINESS_NEED;
  }

  private resolveHeuristicDecision(
    fieldPath: string,
    actorRoles: string[],
    actorPermissions: string[],
    abacContext: AbacContext,
    classification: DataClassification,
  ): FieldAccessDecision {
    if (abacContext.isSelf) {
      if (classification === 'SPECIAL_CATEGORY') return FieldAccessDecision.REQUIRES_STEP_UP;
      if (classification === 'LEGAL_HOLD') return FieldAccessDecision.DENIED_NO_BUSINESS_NEED;
      return FieldAccessDecision.VISIBLE;
    }
    if (abacContext.isManager && classification === 'LOW') return FieldAccessDecision.VISIBLE;
    if (actorRoles.includes('HR_ADMIN') || actorRoles.includes('SYSTEM_ACTOR')) {
      if (classification === 'SPECIAL_CATEGORY') {
        return hasAny(actorPermissions, permissionsForFieldPath(fieldPath)) && abacContext.mfaAuthenticated
          ? FieldAccessDecision.VISIBLE
          : FieldAccessDecision.MASKED;
      }
      if (classification === 'LEGAL_HOLD') {
        return hasAny(actorPermissions, permissionsForFieldPath(fieldPath))
          ? FieldAccessDecision.VISIBLE
          : FieldAccessDecision.MASKED;
      }
      if (classification === 'HIGH_SENSITIVITY') {
        return hasAny(actorPermissions, permissionsForFieldPath(fieldPath))
          ? FieldAccessDecision.VISIBLE
          : FieldAccessDecision.MASKED;
      }
      return FieldAccessDecision.VISIBLE;
    }
    if (classification === 'HIGH_SENSITIVITY' && hasAny(actorPermissions, permissionsForFieldPath(fieldPath))) {
      return FieldAccessDecision.VISIBLE;
    }
    if (classification === 'SPECIAL_CATEGORY' && hasAny(actorPermissions, permissionsForFieldPath(fieldPath)) && abacContext.mfaAuthenticated) {
      return FieldAccessDecision.VISIBLE;
    }
    if (classification === 'HIGH_SENSITIVITY') return FieldAccessDecision.MASKED;
    if (classification === 'SPECIAL_CATEGORY') return FieldAccessDecision.MASKED;
    if (classification === 'LEGAL_HOLD') return FieldAccessDecision.MASKED;
    return FieldAccessDecision.VISIBLE;
  }

  private enforceClassifiedPermission(
    fieldPath: string,
    classification: DataClassification,
    decision: FieldAccessDecision,
    actorPermissions: string[],
    abacContext: AbacContext,
  ): FieldAccessDecision {
    if (decision !== FieldAccessDecision.VISIBLE || abacContext.isSelf) {
      return decision;
    }
    if (classification === 'HIGH_SENSITIVITY' && !hasAny(actorPermissions, permissionsForFieldPath(fieldPath))) {
      return FieldAccessDecision.MASKED;
    }
    if (classification === 'SPECIAL_CATEGORY') {
      if (!hasAny(actorPermissions, permissionsForFieldPath(fieldPath))) {
        return FieldAccessDecision.MASKED;
      }
      return abacContext.mfaAuthenticated || abacContext.breakGlassActive
        ? FieldAccessDecision.VISIBLE
        : FieldAccessDecision.REQUIRES_STEP_UP;
    }
    if (classification === 'LEGAL_HOLD' && !hasAny(actorPermissions, permissionsForFieldPath(fieldPath))) {
      return FieldAccessDecision.MASKED;
    }
    return decision;
  }
}

function defaultMaskingRuleFor(classification: DataClassification, fieldPath: string): MaskingRule | undefined {
  if (classification === 'SPECIAL_CATEGORY' || classification === 'LEGAL_HOLD') return 'FULL_MASK';
  if (classification !== 'HIGH_SENSITIVITY') return undefined;
  if (/(bank|account|iban|routing|tax|nationalId|ssn)/i.test(fieldPath)) return 'SHOW_LAST_4';
  return 'SHOW_RANGE';
}

function permissionsForFieldPath(fieldPath: string): string[] {
  if (/(payroll|netPay|grossPay|tax|insurance|bank|iban|routing|account)/i.test(fieldPath)) return ['PAYROLL_READ'];
  if (/(compensation|salary|bonus|equity|payBand|payRate)/i.test(fieldPath)) return ['COMPENSATION_READ', 'PAYROLL_READ'];
  if (/(wellbeing|eap|mental|medical|clinical|disability|accommodation)/i.test(fieldPath)) return ['WELLBEING_EAP_READ'];
  if (/(legalHold|litigation)/i.test(fieldPath)) return ['LEGAL_HOLD_MANAGE'];
  if (/(diversity|dei|ethnicity|race|religion|gender|sexualOrientation)/i.test(fieldPath)) return ['DEI_ANALYTICS_READ'];
  if (/(union|grievance|collectiveBargaining)/i.test(fieldPath)) return ['UNION_LABOR_READ'];
  if (/(disciplinary|investigation|employeeRelations|erCase)/i.test(fieldPath)) return ['EMPLOYEE_RELATIONS_READ'];
  if (/(performance|rating|calibration|succession)/i.test(fieldPath)) return ['PERFORMANCE_READ'];
  return ['WORKER_READ'];
}

function hasAny(values: string[], required: string[]): boolean {
  const set = new Set(values);
  return required.some((permission) => set.has(permission));
}
