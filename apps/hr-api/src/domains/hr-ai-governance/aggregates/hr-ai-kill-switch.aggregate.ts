import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';

export type HrAiKillSwitchStatus = 'ARMED' | 'TRIGGERED' | 'INVESTIGATING' | 'RESOLVED' | 'REARMED';

export interface HrAiKillSwitchProps {
  id: Uuid;
  tenantId: Uuid;
  useCaseId: Uuid;
  triggeredBy: Uuid;
  triggerReason: string;
  triggeredAt?: Date;
  resolvedAt?: Date;
  resolution?: string;
  status?: HrAiKillSwitchStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class KillSwitchArmed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'KillSwitchArmed', tenantId: props.tenantId, aggregateType: 'HrAiKillSwitch', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class KillSwitchTriggered extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'KillSwitchTriggered', tenantId: props.tenantId, aggregateType: 'HrAiKillSwitch', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class KillSwitchInvestigating extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'KillSwitchInvestigating', tenantId: props.tenantId, aggregateType: 'HrAiKillSwitch', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class KillSwitchResolved extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'KillSwitchResolved', tenantId: props.tenantId, aggregateType: 'HrAiKillSwitch', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class KillSwitchRearmed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'KillSwitchRearmed', tenantId: props.tenantId, aggregateType: 'HrAiKillSwitch', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class HrAiKillSwitch extends AggregateRoot {
  readonly tenantId: Uuid;
  useCaseId: Uuid;
  triggeredBy: Uuid;
  triggerReason: string;
  triggeredAt?: Date;
  resolvedAt?: Date;
  resolution?: string;
  status: HrAiKillSwitchStatus;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number { return this.version; }

  constructor(props: HrAiKillSwitchProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.useCaseId = props.useCaseId;
    this.triggeredBy = props.triggeredBy;
    this.triggerReason = props.triggerReason;
    this.triggeredAt = props.triggeredAt;
    this.resolvedAt = props.resolvedAt;
    this.resolution = props.resolution;
    this.status = props.status ?? 'ARMED';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this.restoreVersion(props.aggregateVersion);
  }

  static create(props: HrAiKillSwitchProps, correlationId: Uuid): HrAiKillSwitch {
    const ks = new HrAiKillSwitch({ ...props, status: 'ARMED', createdAt: new Date(), updatedAt: new Date() });
    ks.addDomainEvent(new KillSwitchArmed({ tenantId: ks.tenantId, aggregateId: ks.id, correlationId }));
    return ks;
  }

  trigger(correlationId: Uuid): void {
    if (this.status !== 'ARMED' && this.status !== 'REARMED') throw new ValidationError(`Cannot trigger from state ${this.status}`);
    this.status = 'TRIGGERED';
    this.triggeredAt = new Date();
    this.addDomainEvent(new KillSwitchTriggered({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  investigate(correlationId: Uuid): void {
    if (this.status !== 'TRIGGERED') throw new ValidationError(`Cannot investigate from state ${this.status}`);
    this.status = 'INVESTIGATING';
    this.addDomainEvent(new KillSwitchInvestigating({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  resolve(correlationId: Uuid, resolution: string): void {
    if (this.status !== 'INVESTIGATING') throw new ValidationError(`Cannot resolve from state ${this.status}`);
    this.status = 'RESOLVED';
    this.resolution = resolution;
    this.resolvedAt = new Date();
    this.addDomainEvent(new KillSwitchResolved({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  rearm(correlationId: Uuid): void {
    if (this.status !== 'RESOLVED') throw new ValidationError(`Cannot rearm from state ${this.status}`);
    this.status = 'REARMED';
    this.addDomainEvent(new KillSwitchRearmed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
