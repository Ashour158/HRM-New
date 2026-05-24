import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type ErInvestigationStatus = 'PLANNED' | 'IN_PROGRESS' | 'EVIDENCE_REVIEW' | 'COMPLETED' | 'CLOSED';

export interface ErInvestigationProps {
  id: Uuid;
  tenantId: Uuid;
  erCaseId: Uuid;
  leadInvestigatorId: Uuid;
  findings?: string;
  conclusion?: string;
  startedAt?: Date;
  completedAt?: Date;
  status?: ErInvestigationStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class InvestigationPlanned extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'InvestigationPlanned', tenantId: props.tenantId, aggregateType: 'ErInvestigation', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class InvestigationStarted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'InvestigationStarted', tenantId: props.tenantId, aggregateType: 'ErInvestigation', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class InvestigationEvidenceReviewed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'InvestigationEvidenceReviewed', tenantId: props.tenantId, aggregateType: 'ErInvestigation', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class InvestigationCompleted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'InvestigationCompleted', tenantId: props.tenantId, aggregateType: 'ErInvestigation', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/** ErInvestigation aggregate. States: PLANNED → IN_PROGRESS → EVIDENCE_REVIEW → COMPLETED → CLOSED. */
export class ErInvestigation extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  erCaseId: Uuid;
  leadInvestigatorId: Uuid;
  findings?: string;
  conclusion?: string;
  startedAt?: Date;
  completedAt?: Date;
  status: ErInvestigationStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: ErInvestigationProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.erCaseId = props.erCaseId;
    this.leadInvestigatorId = props.leadInvestigatorId;
    this.findings = props.findings;
    this.conclusion = props.conclusion;
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
    this.status = props.status ?? 'PLANNED';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: ErInvestigationProps, correlationId: Uuid): ErInvestigation {
    Guard.againstNullOrUndefined(props.erCaseId, 'erCaseId');
    Guard.againstNullOrUndefined(props.leadInvestigatorId, 'leadInvestigatorId');
    const ei = new ErInvestigation({ ...props, status: 'PLANNED', createdAt: new Date(), updatedAt: new Date() });
    ei.addDomainEvent(new InvestigationPlanned({ tenantId: ei.tenantId, aggregateId: ei.id, correlationId }));
    return ei;
  }

  start(correlationId: Uuid): void {
    if (this.status !== 'PLANNED') throw new ValidationError(`Cannot start from ${this.status}`);
    this.status = 'IN_PROGRESS';
    this.startedAt = new Date();
    this.addDomainEvent(new InvestigationStarted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  reviewEvidence(correlationId: Uuid): void {
    if (this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot review evidence from ${this.status}`);
    this.status = 'EVIDENCE_REVIEW';
    this.addDomainEvent(new InvestigationEvidenceReviewed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  complete(correlationId: Uuid): void {
    if (this.status !== 'EVIDENCE_REVIEW' && this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot complete from ${this.status}`);
    this.status = 'COMPLETED';
    this.completedAt = new Date();
    this.addDomainEvent(new InvestigationCompleted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
