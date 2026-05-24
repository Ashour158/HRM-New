/**
 * @file Break-Glass Access Rules
 * @description Emergency access request/approval validation and constraints.
 */

import type { Uuid } from '@hcm/shared-kernel';

/** Break-glass request payload. */
export interface BreakGlassRequest {
  requesterId: Uuid;
  approverId: Uuid;
  scope: {
    records: string[];
    fields: string[];
  };
  durationMinutes: number;
  reason: string;
  mfaToken: string;
}

/** Static break-glass configuration constants. */
export const BreakGlassRules = {
  /** Maximum duration for standard break-glass access (4 hours). */
  MAX_DURATION_MINUTES: 240,
  /** Maximum duration for legal-hold scoped access (8 hours). */
  MAX_DURATION_LEGAL_HOLD: 480,
  /** Roles permitted to initiate break-glass requests. */
  REQUESTERS: ['HR_ADMIN', 'ER_SPECIALIST', 'COMPLIANCE_OFFICER', 'LEGAL'] as const,
  /** Self-approval is prohibited. */
  CANNOT_SELF_APPROVE: true,
  /** MFA is mandatory. */
  REQUIRES_MFA: true,
  /** Special-category data requires a second approver. */
  REQUIRES_SECONDARY_APPROVAL_FOR_SPECIAL: true,
  /** Post-access review must occur within N hours. */
  POST_REVIEW_HOURS: 24,
} as const;

/**
 * Validates break-glass requests against policy rules.
 */
export class BreakGlassValidator {
  /**
   * Determine whether an actor with the given roles can request break-glass access.
   */
  canRequest(actorRoles: string[]): boolean {
    return actorRoles.some((role) =>
      (BreakGlassRules.REQUESTERS as readonly string[]).includes(role),
    );
  }

  /**
   * Determine whether an approver can approve a given request.
   * Enforces no-self-approval and role-based eligibility.
   */
  canApprove(
    approverRoles: string[],
    requesterId: Uuid,
    approverId: Uuid,
  ): boolean {
    if (BreakGlassRules.CANNOT_SELF_APPROVE && requesterId === approverId) {
      return false;
    }
    // Approver must hold one of the authorized roles
    const approverAuthorized = approverRoles.some((role) =>
      (BreakGlassRules.REQUESTERS as readonly string[]).includes(role),
    );
    return approverAuthorized;
  }

  /**
   * Validate requested duration against classification-specific limits.
   */
  validateDuration(durationMinutes: number, classification: string): boolean {
    if (durationMinutes <= 0) return false;
    const max = classification === 'LEGAL_HOLD'
      ? BreakGlassRules.MAX_DURATION_LEGAL_HOLD
      : BreakGlassRules.MAX_DURATION_MINUTES;
    return durationMinutes <= max;
  }
}
