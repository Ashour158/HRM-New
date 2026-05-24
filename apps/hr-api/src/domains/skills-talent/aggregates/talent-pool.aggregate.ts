import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type TalentPoolStatus = 'ACTIVE' | 'UNDER_REVIEW' | 'CLOSED';

export interface TalentPoolProps {
  id: Uuid;
  tenantId: Uuid;
  poolName: string;
  criteria?: Record<string, unknown>;
  memberIds?: string[];
  status?: TalentPoolStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class TalentPoolCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'TalentPoolCreated', tenantId: props.tenantId, aggregateType: 'TalentPool', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class TalentPoolUpdated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'TalentPoolUpdated', tenantId: props.tenantId, aggregateType: 'TalentPool', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class TalentPoolMemberAdded extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'TalentPoolMemberAdded', tenantId: props.tenantId, aggregateType: 'TalentPool', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class TalentPoolMemberRemoved extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'TalentPoolMemberRemoved', tenantId: props.tenantId, aggregateType: 'TalentPool', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class TalentPoolClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'TalentPoolClosed', tenantId: props.tenantId, aggregateType: 'TalentPool', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/**
 * TalentPool aggregate manages pools of high-potential workers.
 */
export class TalentPool extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  poolName: string;
  criteria: Record<string, unknown>;
  memberIds: string[];
  status: TalentPoolStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: TalentPoolProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.poolName = props.poolName;
    this.criteria = props.criteria ?? {};
    this.memberIds = props.memberIds ?? [];
    this.status = props.status ?? 'ACTIVE';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: TalentPoolProps, correlationId: Uuid): TalentPool {
    Guard.againstEmptyString(props.poolName, 'poolName');
    const ar = new TalentPool({ ...props, status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new TalentPoolCreated({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    return ar;
  }

  update(criteria: Record<string, unknown>, correlationId: Uuid): void {
    if (this.status === 'CLOSED') throw new ValidationError(`Cannot update from ${this.status}`);
    this.criteria = criteria;
    this.status = 'UNDER_REVIEW';
    this.addDomainEvent(new TalentPoolUpdated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  addMember(memberId: string, correlationId: Uuid): void {
    if (this.status === 'CLOSED') throw new ValidationError(`Cannot add member from ${this.status}`);
    if (!this.memberIds.includes(memberId)) {
      this.memberIds.push(memberId);
    }
    this.addDomainEvent(new TalentPoolMemberAdded({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  removeMember(memberId: string, correlationId: Uuid): void {
    if (this.status === 'CLOSED') throw new ValidationError(`Cannot remove member from ${this.status}`);
    this.memberIds = this.memberIds.filter((id) => id !== memberId);
    this.addDomainEvent(new TalentPoolMemberRemoved({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  close(correlationId: Uuid): void {
    if (this.status === 'CLOSED') throw new ValidationError('Already closed');
    this.status = 'CLOSED';
    this.addDomainEvent(new TalentPoolClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
