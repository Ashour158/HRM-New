import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';

export type SuccessionPlanStatus = 'DRAFT' | 'ACTIVE' | 'REVIEWED' | 'EXECUTED' | 'CLOSED';

export interface SuccessorCandidate {
  workerId: string;
  readinessLevel: number;
}

export interface SuccessionPlanProps {
  id: Uuid;
  tenantId: Uuid;
  positionId: Uuid;
  incumbentWorkerId?: Uuid;
  successorCandidates?: SuccessorCandidate[];
  readinessLevels?: Record<string, number>;
  status?: SuccessionPlanStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class SuccessionPlanCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'SuccessionPlanCreated', tenantId: props.tenantId, aggregateType: 'SuccessionPlan', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class SuccessionPlanActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'SuccessionPlanActivated', tenantId: props.tenantId, aggregateType: 'SuccessionPlan', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class SuccessionPlanReviewed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'SuccessionPlanReviewed', tenantId: props.tenantId, aggregateType: 'SuccessionPlan', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class SuccessionPlanExecuted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'SuccessionPlanExecuted', tenantId: props.tenantId, aggregateType: 'SuccessionPlan', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class SuccessionPlanClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'SuccessionPlanClosed', tenantId: props.tenantId, aggregateType: 'SuccessionPlan', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/**
 * SuccessionPlan aggregate manages succession planning for positions.
 */
export class SuccessionPlan extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  positionId: Uuid;
  incumbentWorkerId?: Uuid;
  successorCandidates: SuccessorCandidate[];
  readinessLevels: Record<string, number>;
  status: SuccessionPlanStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: SuccessionPlanProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.positionId = props.positionId;
    this.incumbentWorkerId = props.incumbentWorkerId;
    this.successorCandidates = props.successorCandidates ?? [];
    this.readinessLevels = props.readinessLevels ?? {};
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: SuccessionPlanProps, correlationId: Uuid): SuccessionPlan {
    const ar = new SuccessionPlan({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new SuccessionPlanCreated({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    return ar;
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot activate from ${this.status}`);
    this.status = 'ACTIVE';
    this.addDomainEvent(new SuccessionPlanActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  review(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot review from ${this.status}`);
    this.status = 'REVIEWED';
    this.addDomainEvent(new SuccessionPlanReviewed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  execute(correlationId: Uuid): void {
    if (this.status !== 'REVIEWED') throw new ValidationError(`Cannot execute from ${this.status}`);
    this.status = 'EXECUTED';
    this.addDomainEvent(new SuccessionPlanExecuted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  close(correlationId: Uuid): void {
    if (this.status === 'CLOSED') throw new ValidationError('Already closed');
    this.status = 'CLOSED';
    this.addDomainEvent(new SuccessionPlanClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  updateReadiness(workerId: string, level: number, _correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'REVIEWED') throw new ValidationError(`Cannot update readiness from ${this.status}`);
    this.readinessLevels[workerId] = level;
    const candidate = this.successorCandidates.find((c) => c.workerId === workerId);
    if (candidate) {
      candidate.readinessLevel = level;
    } else {
      this.successorCandidates.push({ workerId, readinessLevel: level });
    }
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
