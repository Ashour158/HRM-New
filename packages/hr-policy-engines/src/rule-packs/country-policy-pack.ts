import type { Uuid } from '@hcm/shared-kernel';

/**
 * Lifecycle states for a country policy pack (V1.4 workflow).
 *
 * Mirrors the multi-stakeholder approval pipeline defined in the
 * enterprise blueprint: upload → parse → validate → simulate →
 * legal / tax / HR / benefits / absence / compliance review →
 * approval → publish → [supersede | rollback | retire].
 */
export type CountryPolicyPackStatus =
  | 'DRAFT'
  | 'UPLOADED'
  | 'PARSING'
  | 'VALIDATED'
  | 'IMPACT_SIMULATION_REQUIRED'
  | 'IMPACT_SIMULATED'
  | 'LEGAL_REVIEW_PENDING'
  | 'PAYROLL_TAX_REVIEW_PENDING'
  | 'GLOBAL_HR_REVIEW_PENDING'
  | 'BENEFITS_REVIEW_PENDING'
  | 'ABSENCE_REVIEW_PENDING'
  | 'COMPLIANCE_REVIEW_PENDING'
  | 'APPROVAL_PENDING'
  | 'APPROVED'
  | 'SCHEDULED_FOR_PUBLICATION'
  | 'PUBLISHED'
  | 'SUPERSEDED'
  | 'ROLLED_BACK'
  | 'RETIRED'
  | 'REJECTED'
  | 'QUARANTINED'
  | 'VALIDATION_FAILED';

/**
 * A section inside a country policy pack.
 *
 * Each section covers a distinct HR domain (labour law, tax,
 * leave, benefits, etc.) and carries its own schema version.
 */
export interface CountryPolicySection {
  readonly sectionType:
    | 'LABOR'
    | 'PAYROLL'
    | 'TAX'
    | 'LEAVE'
    | 'BENEFITS'
    | 'CONTRACTS'
    | 'I9_EVERIFY'
    | 'STATUTORY_REPORTING'
    | 'WORKS_COUNCIL'
    | 'DATA_RETENTION'
    | 'LOCAL_FORMS';

  /** Normalised, structured content (shape depends on sectionType). */
  readonly content: Record<string, unknown>;

  /** Semantic version of the section schema. */
  readonly schemaVersion: string;

  /** When the section passed automated validation. */
  readonly validatedAt?: Date;

  /** List of validation errors, if any. */
  readonly validationErrors?: string[];
}

/**
 * A single approval step in the country policy pack workflow.
 *
 * Enforces segregation of duties (SoD) by tracking the approver role
 * and optional individual approver.
 */
export interface ApprovalStep {
  readonly stepType:
    | 'LEGAL'
    | 'PAYROLL_TAX'
    | 'GLOBAL_HR'
    | 'BENEFITS'
    | 'ABSENCE'
    | 'COMPLIANCE';

  /** Role required to fulfil this step. */
  readonly approverRole: string;

  /** Actual user who approved, once completed. */
  readonly approverId?: Uuid;

  /** When the step was completed. */
  readonly approvedAt?: Date;

  /** Free-text evidence (ticket id, comment, attachment reference). */
  readonly evidence?: string;

  /** Whether a segregation-of-duties check was performed. */
  readonly sodChecked: boolean;
}

/**
 * Evidence attached to a policy pack proving provenance
 * (legislative source, vendor update, court ruling, etc.).
 */
export interface SourceEvidence {
  readonly evidenceType: string;
  readonly reference: string;
  readonly url?: string;
  readonly retrievedAt: Date;
}

/**
 * Country policy pack (V1.4).
 *
 * Represents the complete, versioned legislative / regulatory configuration
 * for a single country. Packs are uploaded by country experts, parsed,
 * validated, simulated, reviewed by multiple stakeholders, published,
 * and eventually superseded or retired.
 */
export interface CountryPolicyPack {
  /** Unique pack identifier. */
  readonly packId: Uuid;

  /** ISO-3166 alpha-2 country code. */
  readonly countryCode: string;

  /** Semantic version of the pack (e.g. '2026.3.0'). */
  readonly countryPackVersion: string;

  /** Date from which this pack is effective. */
  readonly effectiveFrom: Date;

  /** Optional expiry date. */
  readonly effectiveUntil?: Date;

  /** Current workflow status. */
  readonly status: CountryPolicyPackStatus;

  /** Domain sections that make up the pack. */
  readonly sections: CountryPolicySection[];

  /** Approval steps that must be completed before publication. */
  readonly requiredApprovals: ApprovalStep[];

  /** Provenance evidence. */
  readonly sourceEvidence: SourceEvidence[];

  /** Whether a retroactive recalculation is required after publication. */
  readonly recalculationRequired: boolean;

  /** User who uploaded the pack. */
  readonly uploadedBy: Uuid;

  /** Upload timestamp. */
  readonly uploadedAt: Date;

  /** When the pack was published. */
  readonly publishedAt?: Date;

  /** User who published the pack. */
  readonly publishedBy?: Uuid;

  /** Reference to the pack that superseded this one. */
  readonly supersededBy?: Uuid;

  /** Reason for rollback, if applicable. */
  readonly rollbackReason?: string;
}
