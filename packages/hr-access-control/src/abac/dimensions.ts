/**
 * @file ABAC Dimensions
 * @description Attribute-Based Access Control context and dimension definitions.
 */

import type { Uuid } from '@hcm/shared-kernel';

/**
 * Context passed to ABAC evaluation. Contains subject, actor, and environmental attributes.
 */
export interface AbacContext {
  /** The worker record being accessed (subject). */
  subjectWorkerId?: Uuid;
  /** The actor's worker record, if applicable. */
  actorWorkerId?: Uuid;
  /** Actor is the subject worker. */
  isSelf: boolean;
  /** Actor is the direct manager of the subject. */
  isManager: boolean;
  /** Actor is in the management chain above the subject. */
  isManagerChain: boolean;
  /** Actor is a peer of the subject (same manager). */
  isPeer: boolean;
  /** Legal entities the actor is scoped to. */
  legalEntityIds: string[];
  /** Country codes the actor can access. */
  countryCodes: string[];
  /** Org units (departments) the actor can access. */
  departmentIds: string[];
  /** Case ownership attributes for ER case access. */
  caseOwnership?: {
    caseId: Uuid;
    isOwner: boolean;
    isSubject: boolean;
  };
  /** Recruiting assignment attributes. */
  recruitingAssignment?: {
    requisitionId: Uuid;
    isHiringManager: boolean;
    isRecruiter: boolean;
  };
  /** Time of access (environmental attribute). */
  timeOfAccess: Date;
  /** Whether break-glass mode is active for this session. */
  breakGlassActive: boolean;
  /** Whether the actor has authenticated with MFA for this session. */
  mfaAuthenticated: boolean;
}

/** Canonical ABAC dimensions used for policy authoring. */
export enum AbacDimension {
  /** Subject is the actor themselves. */
  SELF = 'SELF',
  /** Manager-subject relationship (direct or chain). */
  MANAGER_RELATIONSHIP = 'MANAGER_RELATIONSHIP',
  /** Legal entity scope check. */
  LEGAL_ENTITY = 'LEGAL_ENTITY',
  /** Country/jurisdiction scope check. */
  COUNTRY = 'COUNTRY',
  /** Department/org unit scope check. */
  DEPARTMENT = 'DEPARTMENT',
  /** ER case ownership check. */
  CASE_OWNERSHIP = 'CASE_OWNERSHIP',
  /** Recruiting assignment check. */
  RECRUITING_ASSIGNMENT = 'RECRUITING_ASSIGNMENT',
}
