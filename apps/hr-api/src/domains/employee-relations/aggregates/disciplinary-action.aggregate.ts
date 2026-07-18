/**
 * @hrDataClassification SPECIAL_CATEGORY - ER allegations, investigation evidence, disciplinary outcomes, accommodation, and worker-linked case fields.
 */
import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';
import {
  CASE_SEVERITIES,
  type CaseSeverity,
  evaluateDisciplinaryEscalation,
  type DisciplinaryEscalationResult,
} from '@hcm/policy-engines';

export type DisciplinaryActionStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'EXECUTED' | 'APPEALED' | 'UPHELD' | 'REVOKED' | 'CANCELLED';

export interface DisciplinaryActionProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  erCaseId: Uuid;
  actionType: string;
  severity: CaseSeverity;
  description: string;
  effectiveDate: Date;
  approvedBy?: Uuid;
  executedAt?: Date;
  appealDeadline?: Date;
  /** When the legal-review escalation gate was satisfied (see recordLegalReview()). */
  legalReviewCompletedAt?: Date;
  legalReviewCompletedBy?: Uuid;
  status?: DisciplinaryActionStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class DisciplinaryActionDrafted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'DisciplinaryActionDrafted', tenantId: props.tenantId, aggregateType: 'DisciplinaryAction', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class DisciplinaryActionApproved extends DomainEvent {
  readonly approvedBy: string;
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; approvedBy: Uuid }) {
    super({ eventName: 'DisciplinaryActionApproved', tenantId: props.tenantId, aggregateType: 'DisciplinaryAction', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.approvedBy = props.approvedBy.value;
  }
}

export class DisciplinaryActionExecuted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'DisciplinaryActionExecuted', tenantId: props.tenantId, aggregateType: 'DisciplinaryAction', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class DisciplinaryActionAppealed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'DisciplinaryActionAppealed', tenantId: props.tenantId, aggregateType: 'DisciplinaryAction', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class DisciplinaryActionUpheld extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'DisciplinaryActionUpheld', tenantId: props.tenantId, aggregateType: 'DisciplinaryAction', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class DisciplinaryActionRevoked extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'DisciplinaryActionRevoked', tenantId: props.tenantId, aggregateType: 'DisciplinaryAction', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/**
 * The "LegalReviewCompleted"-style acknowledgement that satisfies the
 * severity-driven escalation gate (see {@link DisciplinaryAction.execute}).
 */
export class DisciplinaryActionLegalReviewCompleted extends DomainEvent {
  readonly reviewedBy: string;
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; reviewedBy: Uuid }) {
    super({ eventName: 'DisciplinaryActionLegalReviewCompleted', tenantId: props.tenantId, aggregateType: 'DisciplinaryAction', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.reviewedBy = props.reviewedBy.value;
  }
}

/** DisciplinaryAction aggregate. States: DRAFT → PENDING_APPROVAL → APPROVED → EXECUTED → APPEALED → UPHELD | REVOKED | CANCELLED. */
export class DisciplinaryAction extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  erCaseId: Uuid;
  actionType: string;
  severity: CaseSeverity;
  description: string;
  effectiveDate: Date;
  approvedBy?: Uuid;
  executedAt?: Date;
  appealDeadline?: Date;
  legalReviewCompletedAt?: Date;
  legalReviewCompletedBy?: Uuid;
  status: DisciplinaryActionStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: DisciplinaryActionProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.erCaseId = props.erCaseId;
    this.actionType = props.actionType;
    this.severity = props.severity;
    this.description = props.description;
    this.effectiveDate = props.effectiveDate;
    this.approvedBy = props.approvedBy;
    this.executedAt = props.executedAt;
    this.appealDeadline = props.appealDeadline;
    this.legalReviewCompletedAt = props.legalReviewCompletedAt;
    this.legalReviewCompletedBy = props.legalReviewCompletedBy;
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static draft(props: DisciplinaryActionProps, correlationId: Uuid): DisciplinaryAction {
    Guard.againstEmptyString(props.actionType, 'actionType');
    Guard.againstInvalidEnum(props.severity, CASE_SEVERITIES, 'severity');
    const da = new DisciplinaryAction({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    da.addDomainEvent(new DisciplinaryActionDrafted({ tenantId: da.tenantId, aggregateId: da.id, correlationId }));
    return da;
  }

  approve(approvedBy: Uuid, correlationId: Uuid): void {
    if (this.status !== 'DRAFT' && this.status !== 'PENDING_APPROVAL') throw new ValidationError(`Cannot approve from ${this.status}`);
    this.status = 'APPROVED';
    this.approvedBy = approvedBy;
    this.addDomainEvent(new DisciplinaryActionApproved({ tenantId: this.tenantId, aggregateId: this.id, correlationId, approvedBy }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Evaluates the severity-driven escalation gate against the concrete
   * `employee-relations-disciplinary` engine (see @hcm/policy-engines).
   */
  private evaluateEscalation(): DisciplinaryEscalationResult {
    return evaluateDisciplinaryEscalation({
      severity: this.severity,
      legalReviewCompleted: this.legalReviewCompletedAt != null,
    });
  }

  /** True when this action's severity requires a recorded legal review before execute(). */
  get requiresLegalReview(): boolean {
    return this.evaluateEscalation().requiresLegalReview;
  }

  /** True when the escalation gate is satisfied and execute() may proceed. */
  get canFinalize(): boolean {
    return this.evaluateEscalation().canFinalize;
  }

  /**
   * Records the "LegalReviewCompleted"-style acknowledgement that satisfies
   * the escalation gate for this action. Idempotent — calling it again simply
   * refreshes the reviewer/timestamp. Not permitted once the action has
   * reached a final disposition (nothing left to gate at that point).
   */
  recordLegalReview(reviewedBy: Uuid, correlationId: Uuid): void {
    if (this.status === 'UPHELD' || this.status === 'REVOKED' || this.status === 'CANCELLED') {
      throw new ValidationError(`Cannot record legal review after final disposition (${this.status})`);
    }
    this.legalReviewCompletedAt = new Date();
    this.legalReviewCompletedBy = reviewedBy;
    this.addDomainEvent(new DisciplinaryActionLegalReviewCompleted({ tenantId: this.tenantId, aggregateId: this.id, correlationId, reviewedBy }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Finalizes the disciplinary action (it takes effect on the worker).
   * Fails closed: if severity requires legal review and recordLegalReview()
   * has not yet been called, this throws instead of transitioning.
   */
  execute(correlationId: Uuid): void {
    if (this.status !== 'APPROVED') throw new ValidationError(`Cannot execute from ${this.status}`);
    const escalation = this.evaluateEscalation();
    if (!escalation.canFinalize) {
      throw new ValidationError(`Cannot execute: ${escalation.reasons.join(' ')}`);
    }
    this.status = 'EXECUTED';
    this.executedAt = new Date();
    this.addDomainEvent(new DisciplinaryActionExecuted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  appeal(correlationId: Uuid): void {
    if (this.status !== 'EXECUTED') throw new ValidationError(`Cannot appeal from ${this.status}`);
    this.status = 'APPEALED';
    this.addDomainEvent(new DisciplinaryActionAppealed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  uphold(correlationId: Uuid): void {
    if (this.status !== 'APPEALED') throw new ValidationError(`Cannot uphold from ${this.status}`);
    this.status = 'UPHELD';
    this.addDomainEvent(new DisciplinaryActionUpheld({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  revoke(correlationId: Uuid): void {
    if (this.status !== 'APPEALED' && this.status !== 'EXECUTED' && this.status !== 'APPROVED') throw new ValidationError(`Cannot revoke from ${this.status}`);
    this.status = 'REVOKED';
    this.addDomainEvent(new DisciplinaryActionRevoked({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
