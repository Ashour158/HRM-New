import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type PayrollResultLineStatus = 'CALCULATED' | 'EXPLAINED' | 'REVIEWED' | 'LOCKED';

export interface PayrollResultLineProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  payrollCycleId: Uuid;
  calculationRunId: Uuid;
  lineType: string;
  description: string;
  amount: number;
  currency: string;
  ruleSetId?: string;
  ruleId?: string;
  calculationStep?: string;
  inputSnapshotHash?: string;
  explanation?: string;
  status?: PayrollResultLineStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class PayrollResultLineCalculated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PayrollResultLineCalculated', tenantId: props.tenantId, aggregateType: 'PayrollResultLine', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PayrollResultLineExplained extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PayrollResultLineExplained', tenantId: props.tenantId, aggregateType: 'PayrollResultLine', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PayrollResultLineReviewed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PayrollResultLineReviewed', tenantId: props.tenantId, aggregateType: 'PayrollResultLine', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PayrollResultLineLocked extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PayrollResultLineLocked', tenantId: props.tenantId, aggregateType: 'PayrollResultLine', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PayrollResultLine extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  payrollCycleId: Uuid;
  calculationRunId: Uuid;
  lineType: string;
  description: string;
  amount: number;
  currency: string;
  ruleSetId?: string;
  ruleId?: string;
  calculationStep?: string;
  inputSnapshotHash?: string;
  explanation?: string;
  status: PayrollResultLineStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: PayrollResultLineProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.payrollCycleId = props.payrollCycleId;
    this.calculationRunId = props.calculationRunId;
    this.lineType = props.lineType;
    this.description = props.description;
    this.amount = props.amount;
    this.currency = props.currency;
    this.ruleSetId = props.ruleSetId;
    this.ruleId = props.ruleId;
    this.calculationStep = props.calculationStep;
    this.inputSnapshotHash = props.inputSnapshotHash;
    this.explanation = props.explanation;
    this.status = props.status ?? 'CALCULATED';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static calculate(props: PayrollResultLineProps, correlationId: Uuid): PayrollResultLine {
    Guard.againstEmptyString(props.lineType, 'lineType');
    const line = new PayrollResultLine({ ...props, status: 'CALCULATED', createdAt: new Date(), updatedAt: new Date() });
    line.addDomainEvent(new PayrollResultLineCalculated({ tenantId: line.tenantId, aggregateId: line.id, correlationId }));
    return line;
  }

  explain(explanation: string, correlationId: Uuid): void {
    if (this.status !== 'CALCULATED') throw new ValidationError(`Cannot explain from ${this.status}`);
    this.explanation = explanation;
    this.status = 'EXPLAINED';
    this.addDomainEvent(new PayrollResultLineExplained({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  review(correlationId: Uuid): void {
    if (this.status !== 'EXPLAINED') throw new ValidationError(`Cannot review from ${this.status}`);
    this.status = 'REVIEWED';
    this.addDomainEvent(new PayrollResultLineReviewed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  lock(correlationId: Uuid): void {
    if (this.status !== 'REVIEWED') throw new ValidationError(`Cannot lock from ${this.status}`);
    this.status = 'LOCKED';
    this.addDomainEvent(new PayrollResultLineLocked({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
