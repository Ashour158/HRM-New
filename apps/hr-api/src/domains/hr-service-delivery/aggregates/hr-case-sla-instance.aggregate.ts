import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type HrCaseSlaInstanceStatus = 'ACTIVE' | 'BREACHED' | 'MET' | 'EXEMPTED';

export interface HrCaseSlaInstanceProps {
  id: Uuid;
  tenantId: Uuid;
  caseId: Uuid;
  slaDefinitionId: Uuid;
  deadlineAt: Date;
  breachedAt?: Date;
  metAt?: Date;
  exemptReason?: string;
  status?: HrCaseSlaInstanceStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class SlaInstanceActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'SlaInstanceActivated', tenantId: props.tenantId, aggregateType: 'HrCaseSlaInstance', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class SlaInstanceBreached extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'SlaInstanceBreached', tenantId: props.tenantId, aggregateType: 'HrCaseSlaInstance', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class SlaInstanceMet extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'SlaInstanceMet', tenantId: props.tenantId, aggregateType: 'HrCaseSlaInstance', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class SlaInstanceExempted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'SlaInstanceExempted', tenantId: props.tenantId, aggregateType: 'HrCaseSlaInstance', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class HrCaseSlaInstance extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  caseId: Uuid;
  slaDefinitionId: Uuid;
  deadlineAt: Date;
  breachedAt?: Date;
  metAt?: Date;
  exemptReason?: string;
  status: HrCaseSlaInstanceStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: HrCaseSlaInstanceProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.caseId = props.caseId;
    this.slaDefinitionId = props.slaDefinitionId;
    this.deadlineAt = props.deadlineAt;
    this.breachedAt = props.breachedAt;
    this.metAt = props.metAt;
    this.exemptReason = props.exemptReason;
    this.status = props.status ?? 'ACTIVE';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: HrCaseSlaInstanceProps, correlationId: Uuid): HrCaseSlaInstance {
    Guard.againstNullOrUndefined(props.deadlineAt, 'deadlineAt');
    const si = new HrCaseSlaInstance({ ...props, status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() });
    si.addDomainEvent(new SlaInstanceActivated({ tenantId: si.tenantId, aggregateId: si.id, correlationId }));
    return si;
  }

  breach(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot breach from ${this.status}`);
    this.status = 'BREACHED';
    this.breachedAt = new Date();
    this.addDomainEvent(new SlaInstanceBreached({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  meet(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot meet from ${this.status}`);
    this.status = 'MET';
    this.metAt = new Date();
    this.addDomainEvent(new SlaInstanceMet({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  exempt(exemptReason: string, correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'BREACHED') throw new ValidationError(`Cannot exempt from ${this.status}`);
    this.status = 'EXEMPTED';
    this.exemptReason = exemptReason;
    this.addDomainEvent(new SlaInstanceExempted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
