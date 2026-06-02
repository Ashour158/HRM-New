import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type CoverageGapStatus = 'DETECTED' | 'NOTIFIED' | 'FILLED' | 'CLOSED';

export interface CoverageGapProps {
  id: Uuid;
  tenantId: Uuid;
  departmentId: Uuid;
  shiftDate: Date;
  startTime: Date;
  endTime: Date;
  workplaceCode?: string;
  requiredSkills?: string[];
  filledByWorkerId?: Uuid;
  status?: CoverageGapStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class CoverageGapDetected extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CoverageGapDetected', tenantId: props.tenantId, aggregateType: 'CoverageGap', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CoverageGapNotified extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CoverageGapNotified', tenantId: props.tenantId, aggregateType: 'CoverageGap', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CoverageGapFilled extends DomainEvent {
  readonly filledByWorkerId: string;
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; filledByWorkerId: Uuid }) {
    super({ eventName: 'CoverageGapFilled', tenantId: props.tenantId, aggregateType: 'CoverageGap', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.filledByWorkerId = props.filledByWorkerId.value;
  }
}

export class CoverageGapClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CoverageGapClosed', tenantId: props.tenantId, aggregateType: 'CoverageGap', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/** CoverageGap aggregate. States: DETECTED → NOTIFIED → FILLED → CLOSED. */
export class CoverageGap extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  departmentId: Uuid;
  shiftDate: Date;
  startTime: Date;
  endTime: Date;
  workplaceCode?: string;
  requiredSkills?: string[];
  filledByWorkerId?: Uuid;
  status: CoverageGapStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: CoverageGapProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.departmentId = props.departmentId;
    this.shiftDate = props.shiftDate;
    this.startTime = props.startTime;
    this.endTime = props.endTime;
    this.workplaceCode = props.workplaceCode;
    this.requiredSkills = props.requiredSkills;
    this.filledByWorkerId = props.filledByWorkerId;
    this.status = props.status ?? 'DETECTED';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: CoverageGapProps, correlationId: Uuid): CoverageGap {
    Guard.againstNullOrUndefined(props.shiftDate, 'shiftDate');
    const cg = new CoverageGap({ ...props, status: 'DETECTED', createdAt: new Date(), updatedAt: new Date() });
    cg.addDomainEvent(new CoverageGapDetected({ tenantId: cg.tenantId, aggregateId: cg.id, correlationId }));
    return cg;
  }

  notify(correlationId: Uuid): void {
    if (this.status !== 'DETECTED') throw new ValidationError(`Cannot notify from ${this.status}`);
    this.status = 'NOTIFIED';
    this.addDomainEvent(new CoverageGapNotified({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  fill(filledByWorkerId: Uuid, correlationId: Uuid): void {
    if (this.status !== 'DETECTED' && this.status !== 'NOTIFIED') throw new ValidationError(`Cannot fill from ${this.status}`);
    this.status = 'FILLED';
    this.filledByWorkerId = filledByWorkerId;
    this.addDomainEvent(new CoverageGapFilled({ tenantId: this.tenantId, aggregateId: this.id, correlationId, filledByWorkerId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  close(correlationId: Uuid): void {
    if (this.status === 'CLOSED') throw new ValidationError(`Cannot close from ${this.status}`);
    this.status = 'CLOSED';
    this.addDomainEvent(new CoverageGapClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
