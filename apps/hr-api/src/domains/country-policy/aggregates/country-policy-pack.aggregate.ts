import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

/**
 * The 28 states of the Country Policy Pack v1.4 governance lifecycle.
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
 * Properties required to construct a {@link CountryPolicyPack}.
 */
export interface CountryPolicyPackProps {
  id: Uuid;
  tenantId: Uuid;
  countryCode: string;
  countryPackVersion: string;
  effectiveFrom: Date;
  effectiveUntil?: Date;
  status?: CountryPolicyPackStatus;
  sections?: Record<string, unknown>;
  requiredApprovals?: string[];
  sourceEvidence?: Record<string, unknown>;
  recalculationRequired?: boolean;
  uploadedBy?: Uuid;
  uploadedAt?: Date;
  publishedAt?: Date;
  publishedBy?: Uuid;
  supersededBy?: Uuid;
  rollbackReason?: string;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class CountryPolicyPackUploaded extends DomainEvent {
  readonly countryCode: string;
  readonly uploadedBy: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    countryCode: string;
    uploadedBy: Uuid;
  }) {
    super({
      eventName: 'CountryPolicyPackUploaded',
      tenantId: props.tenantId,
      aggregateType: 'CountryPolicyPack',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.countryCode = props.countryCode;
    this.uploadedBy = props.uploadedBy.value;
  }
}

export class CountryPolicyPackValidated extends DomainEvent {
  readonly countryCode: string;
  readonly validationRunId: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    countryCode: string;
    validationRunId: Uuid;
  }) {
    super({
      eventName: 'CountryPolicyPackValidated',
      tenantId: props.tenantId,
      aggregateType: 'CountryPolicyPack',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.countryCode = props.countryCode;
    this.validationRunId = props.validationRunId.value;
  }
}

export class CountryPolicyPackSimulated extends DomainEvent {
  readonly countryCode: string;
  readonly simulationRunId: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    countryCode: string;
    simulationRunId: Uuid;
  }) {
    super({
      eventName: 'CountryPolicyPackSimulated',
      tenantId: props.tenantId,
      aggregateType: 'CountryPolicyPack',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.countryCode = props.countryCode;
    this.simulationRunId = props.simulationRunId.value;
  }
}

export class CountryPolicyPackApproved extends DomainEvent {
  readonly countryCode: string;
  readonly approvedBy: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    countryCode: string;
    approvedBy: Uuid;
  }) {
    super({
      eventName: 'CountryPolicyPackApproved',
      tenantId: props.tenantId,
      aggregateType: 'CountryPolicyPack',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.countryCode = props.countryCode;
    this.approvedBy = props.approvedBy.value;
  }
}

export class CountryPolicyPackPublished extends DomainEvent {
  readonly countryCode: string;
  readonly publishedBy: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    countryCode: string;
    publishedBy: Uuid;
  }) {
    super({
      eventName: 'CountryPolicyPackPublished',
      tenantId: props.tenantId,
      aggregateType: 'CountryPolicyPack',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.countryCode = props.countryCode;
    this.publishedBy = props.publishedBy.value;
  }
}

export class CountryPolicyPackSuperseded extends DomainEvent {
  readonly countryCode: string;
  readonly supersededBy: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    countryCode: string;
    supersededBy: Uuid;
  }) {
    super({
      eventName: 'CountryPolicyPackSuperseded',
      tenantId: props.tenantId,
      aggregateType: 'CountryPolicyPack',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.countryCode = props.countryCode;
    this.supersededBy = props.supersededBy.value;
  }
}

export class CountryPolicyPackRolledBack extends DomainEvent {
  readonly countryCode: string;
  readonly rollbackReason: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    countryCode: string;
    rollbackReason: string;
  }) {
    super({
      eventName: 'CountryPolicyPackRolledBack',
      tenantId: props.tenantId,
      aggregateType: 'CountryPolicyPack',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.countryCode = props.countryCode;
    this.rollbackReason = props.rollbackReason;
  }
}

export class CountryPolicyPackRejected extends DomainEvent {
  readonly countryCode: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; countryCode: string }) {
    super({
      eventName: 'CountryPolicyPackRejected',
      tenantId: props.tenantId,
      aggregateType: 'CountryPolicyPack',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.countryCode = props.countryCode;
  }
}

export class CountryPolicyPackQuarantined extends DomainEvent {
  readonly countryCode: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; countryCode: string }) {
    super({
      eventName: 'CountryPolicyPackQuarantined',
      tenantId: props.tenantId,
      aggregateType: 'CountryPolicyPack',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.countryCode = props.countryCode;
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * The crown jewel aggregate: Country Policy Pack v1.4 governance.
 *
 * FSM lifecycle (28 states):
 * DRAFT → UPLOADED → PARSING → VALIDATED → IMPACT_SIMULATION_REQUIRED → IMPACT_SIMULATED
 * → [LEGAL_REVIEW_PENDING, PAYROLL_TAX_REVIEW_PENDING, GLOBAL_HR_REVIEW_PENDING,
 *    BENEFITS_REVIEW_PENDING, ABSENCE_REVIEW_PENDING, COMPLIANCE_REVIEW_PENDING]
 * → APPROVAL_PENDING → APPROVED → SCHEDULED_FOR_PUBLICATION → PUBLISHED
 * → [SUPERSEDED, ROLLED_BACK] → RETIRED
 * [REJECTED, QUARANTINED, VALIDATION_FAILED] (terminal/error paths)
 *
 * SoD: uploader ≠ legal/payroll/global-HR approver
 */
export class CountryPolicyPack extends AggregateRoot {
  readonly tenantId: Uuid;
  countryCode: string;
  countryPackVersion: string;
  effectiveFrom: Date;
  effectiveUntil?: Date;
  status: CountryPolicyPackStatus;
  sections: Record<string, unknown>;
  requiredApprovals: string[];
  sourceEvidence: Record<string, unknown>;
  recalculationRequired: boolean;
  uploadedBy?: Uuid;
  uploadedAt?: Date;
  publishedAt?: Date;
  publishedBy?: Uuid;
  supersededBy?: Uuid;
  rollbackReason?: string;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: CountryPolicyPackProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.countryCode = props.countryCode;
    this.countryPackVersion = props.countryPackVersion;
    this.effectiveFrom = props.effectiveFrom;
    this.effectiveUntil = props.effectiveUntil;
    this.status = props.status ?? 'DRAFT';
    this.sections = props.sections ?? {};
    this.requiredApprovals = props.requiredApprovals ?? [];
    this.sourceEvidence = props.sourceEvidence ?? {};
    this.recalculationRequired = props.recalculationRequired ?? false;
    this.uploadedBy = props.uploadedBy;
    this.uploadedAt = props.uploadedAt;
    this.publishedAt = props.publishedAt;
    this.publishedBy = props.publishedBy;
    this.supersededBy = props.supersededBy;
    this.rollbackReason = props.rollbackReason;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this.restoreVersion(props.aggregateVersion);
    }
  }

  /**
   * Factory method to create a new CountryPolicyPack in DRAFT state.
   */
  static create(props: CountryPolicyPackProps, _correlationId: Uuid): CountryPolicyPack {
    Guard.againstEmptyString(props.countryCode, 'countryCode');
    Guard.againstEmptyString(props.countryPackVersion, 'countryPackVersion');

    const pack = new CountryPolicyPack({
      ...props,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return pack;
  }

  /**
   * Upload the policy pack (DRAFT → UPLOADED).
   */
  upload(uploadedBy: Uuid, correlationId: Uuid): void {
    if (this.status !== 'DRAFT') {
      throw new ValidationError(`Cannot upload from state ${this.status}`);
    }
    this.status = 'UPLOADED';
    this.uploadedBy = uploadedBy;
    this.uploadedAt = new Date();
    this.addDomainEvent(
      new CountryPolicyPackUploaded({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        countryCode: this.countryCode,
        uploadedBy,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Parse the uploaded pack (UPLOADED → PARSING).
   */
  parse(_correlationId: Uuid): void {
    if (this.status !== 'UPLOADED') {
      throw new ValidationError(`Cannot parse from state ${this.status}`);
    }
    this.status = 'PARSING';
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Validate the parsed pack (PARSING → VALIDATED | VALIDATION_FAILED).
   */
  validate(_correlationId: Uuid, validationRunId: Uuid, success: boolean): void {
    if (this.status !== 'PARSING') {
      throw new ValidationError(`Cannot validate from state ${this.status}`);
    }
    if (!success) {
      this.status = 'VALIDATION_FAILED';
      this.incrementVersion();
      this.updatedAt = new Date();
      return;
    }
    this.status = 'VALIDATED';
    this.addDomainEvent(
      new CountryPolicyPackValidated({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId: _correlationId,
        countryCode: this.countryCode,
        validationRunId,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Require impact simulation (VALIDATED → IMPACT_SIMULATION_REQUIRED).
   */
  requireSimulation(_correlationId: Uuid): void {
    if (this.status !== 'VALIDATED') {
      throw new ValidationError(`Cannot require simulation from state ${this.status}`);
    }
    this.status = 'IMPACT_SIMULATION_REQUIRED';
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Simulate impact (IMPACT_SIMULATION_REQUIRED → IMPACT_SIMULATED).
   */
  simulateImpact(correlationId: Uuid, simulationRunId: Uuid, recalculationRequired: boolean): void {
    if (this.status !== 'IMPACT_SIMULATION_REQUIRED') {
      throw new ValidationError(`Cannot simulate from state ${this.status}`);
    }
    this.status = 'IMPACT_SIMULATED';
    this.recalculationRequired = recalculationRequired;
    this.addDomainEvent(
      new CountryPolicyPackSimulated({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        countryCode: this.countryCode,
        simulationRunId,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Submit for legal review (IMPACT_SIMULATED → LEGAL_REVIEW_PENDING).
   */
  submitForLegalReview(_correlationId: Uuid): void {
    if (this.status !== 'IMPACT_SIMULATED' && this.status !== 'PAYROLL_TAX_REVIEW_PENDING'
        && this.status !== 'GLOBAL_HR_REVIEW_PENDING' && this.status !== 'BENEFITS_REVIEW_PENDING'
        && this.status !== 'ABSENCE_REVIEW_PENDING' && this.status !== 'COMPLIANCE_REVIEW_PENDING') {
      throw new ValidationError(`Cannot submit for legal review from state ${this.status}`);
    }
    this.status = 'LEGAL_REVIEW_PENDING';
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Submit for payroll tax review (IMPACT_SIMULATED | LEGAL_REVIEW_PENDING → PAYROLL_TAX_REVIEW_PENDING).
   */
  submitForPayrollTaxReview(_correlationId: Uuid): void {
    if (this.status !== 'IMPACT_SIMULATED' && this.status !== 'LEGAL_REVIEW_PENDING'
        && this.status !== 'GLOBAL_HR_REVIEW_PENDING' && this.status !== 'BENEFITS_REVIEW_PENDING'
        && this.status !== 'ABSENCE_REVIEW_PENDING' && this.status !== 'COMPLIANCE_REVIEW_PENDING') {
      throw new ValidationError(`Cannot submit for payroll tax review from state ${this.status}`);
    }
    this.status = 'PAYROLL_TAX_REVIEW_PENDING';
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Submit for global HR review (IMPACT_SIMULATED | LEGAL_REVIEW_PENDING | PAYROLL_TAX_REVIEW_PENDING → GLOBAL_HR_REVIEW_PENDING).
   */
  submitForGlobalHRReview(_correlationId: Uuid): void {
    if (this.status !== 'IMPACT_SIMULATED' && this.status !== 'LEGAL_REVIEW_PENDING'
        && this.status !== 'PAYROLL_TAX_REVIEW_PENDING' && this.status !== 'BENEFITS_REVIEW_PENDING'
        && this.status !== 'ABSENCE_REVIEW_PENDING' && this.status !== 'COMPLIANCE_REVIEW_PENDING') {
      throw new ValidationError(`Cannot submit for global HR review from state ${this.status}`);
    }
    this.status = 'GLOBAL_HR_REVIEW_PENDING';
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Submit for benefits review.
   */
  submitForBenefitsReview(_correlationId: Uuid): void {
    if (this.status !== 'IMPACT_SIMULATED' && this.status !== 'LEGAL_REVIEW_PENDING'
        && this.status !== 'PAYROLL_TAX_REVIEW_PENDING' && this.status !== 'GLOBAL_HR_REVIEW_PENDING'
        && this.status !== 'ABSENCE_REVIEW_PENDING' && this.status !== 'COMPLIANCE_REVIEW_PENDING') {
      throw new ValidationError(`Cannot submit for benefits review from state ${this.status}`);
    }
    this.status = 'BENEFITS_REVIEW_PENDING';
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Submit for absence review.
   */
  submitForAbsenceReview(_correlationId: Uuid): void {
    if (this.status !== 'IMPACT_SIMULATED' && this.status !== 'LEGAL_REVIEW_PENDING'
        && this.status !== 'PAYROLL_TAX_REVIEW_PENDING' && this.status !== 'GLOBAL_HR_REVIEW_PENDING'
        && this.status !== 'BENEFITS_REVIEW_PENDING' && this.status !== 'COMPLIANCE_REVIEW_PENDING') {
      throw new ValidationError(`Cannot submit for absence review from state ${this.status}`);
    }
    this.status = 'ABSENCE_REVIEW_PENDING';
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Submit for compliance review.
   */
  submitForComplianceReview(_correlationId: Uuid): void {
    if (this.status !== 'IMPACT_SIMULATED' && this.status !== 'LEGAL_REVIEW_PENDING'
        && this.status !== 'PAYROLL_TAX_REVIEW_PENDING' && this.status !== 'GLOBAL_HR_REVIEW_PENDING'
        && this.status !== 'BENEFITS_REVIEW_PENDING' && this.status !== 'ABSENCE_REVIEW_PENDING') {
      throw new ValidationError(`Cannot submit for compliance review from state ${this.status}`);
    }
    this.status = 'COMPLIANCE_REVIEW_PENDING';
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Submit for approval after all reviews complete.
   */
  submitForApproval(_correlationId: Uuid): void {
    const validStates: CountryPolicyPackStatus[] = [
      'IMPACT_SIMULATED',
      'LEGAL_REVIEW_PENDING',
      'PAYROLL_TAX_REVIEW_PENDING',
      'GLOBAL_HR_REVIEW_PENDING',
      'BENEFITS_REVIEW_PENDING',
      'ABSENCE_REVIEW_PENDING',
      'COMPLIANCE_REVIEW_PENDING',
    ];
    if (!validStates.includes(this.status)) {
      throw new ValidationError(`Cannot submit for approval from state ${this.status}`);
    }
    this.status = 'APPROVAL_PENDING';
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Approve the pack (APPROVAL_PENDING → APPROVED).
   *
   * SoD enforced: approver must not be the uploader.
   */
  approve(approvedBy: Uuid, correlationId: Uuid): void {
    if (this.status !== 'APPROVAL_PENDING') {
      throw new ValidationError(`Cannot approve from state ${this.status}`);
    }
    if (this.uploadedBy && this.uploadedBy.value === approvedBy.value) {
      throw new ValidationError('Segregation of duties violation: uploader cannot approve');
    }
    this.status = 'APPROVED';
    this.addDomainEvent(
      new CountryPolicyPackApproved({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        countryCode: this.countryCode,
        approvedBy,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Schedule the pack for publication (APPROVED → SCHEDULED_FOR_PUBLICATION).
   */
  schedulePublication(_correlationId: Uuid): void {
    if (this.status !== 'APPROVED') {
      throw new ValidationError(`Cannot schedule from state ${this.status}`);
    }
    this.status = 'SCHEDULED_FOR_PUBLICATION';
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Publish the pack (SCHEDULED_FOR_PUBLICATION → PUBLISHED).
   */
  publish(publishedBy: Uuid, correlationId: Uuid): void {
    if (this.status !== 'SCHEDULED_FOR_PUBLICATION') {
      throw new ValidationError(`Cannot publish from state ${this.status}`);
    }
    this.status = 'PUBLISHED';
    this.publishedAt = new Date();
    this.publishedBy = publishedBy;
    this.addDomainEvent(
      new CountryPolicyPackPublished({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        countryCode: this.countryCode,
        publishedBy,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Supersede the pack (PUBLISHED → SUPERSEDED).
   */
  supersede(correlationId: Uuid, supersededBy: Uuid): void {
    if (this.status !== 'PUBLISHED') {
      throw new ValidationError(`Cannot supersede from state ${this.status}`);
    }
    this.status = 'SUPERSEDED';
    this.supersededBy = supersededBy;
    this.addDomainEvent(
      new CountryPolicyPackSuperseded({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        countryCode: this.countryCode,
        supersededBy,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Rollback the pack (PUBLISHED → ROLLED_BACK).
   */
  rollback(correlationId: Uuid, rollbackReason: string): void {
    if (this.status !== 'PUBLISHED' && this.status !== 'SUPERSEDED') {
      throw new ValidationError(`Cannot rollback from state ${this.status}`);
    }
    this.status = 'ROLLED_BACK';
    this.rollbackReason = rollbackReason;
    this.addDomainEvent(
      new CountryPolicyPackRolledBack({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        countryCode: this.countryCode,
        rollbackReason,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Retire the pack (SUPERSEDED | ROLLED_BACK → RETIRED).
   */
  retire(_correlationId: Uuid): void {
    if (this.status !== 'SUPERSEDED' && this.status !== 'ROLLED_BACK') {
      throw new ValidationError(`Cannot retire from state ${this.status}`);
    }
    this.status = 'RETIRED';
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Reject the pack.
   */
  reject(_correlationId: Uuid): void {
    if (this.status !== 'APPROVAL_PENDING') {
      throw new ValidationError(`Cannot reject from state ${this.status}`);
    }
    this.status = 'REJECTED';
    this.addDomainEvent(
      new CountryPolicyPackRejected({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId: _correlationId,
        countryCode: this.countryCode,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Quarantine the pack.
   */
  quarantine(correlationId: Uuid): void {
    if (this.status === 'RETIRED' || this.status === 'REJECTED' || this.status === 'VALIDATION_FAILED') {
      throw new ValidationError(`Cannot quarantine from terminal state ${this.status}`);
    }
    this.status = 'QUARANTINED';
    this.addDomainEvent(
      new CountryPolicyPackQuarantined({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        countryCode: this.countryCode,
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
