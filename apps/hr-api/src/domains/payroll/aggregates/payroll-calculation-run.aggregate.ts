import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type PayrollCalculationRunStatus = 'PENDING' | 'IN_PROGRESS' | 'VALIDATED' | 'FINALIZED' | 'FAILED';

export interface PayrollCalculationRunProps {
  id: Uuid;
  tenantId: Uuid;
  payrollCycleId: Uuid;
  startedAt?: Date;
  completedAt?: Date;
  totalWorkers?: number;
  totalGrossPay?: number;
  totalNetPay?: number;
  currency: string;
  status?: PayrollCalculationRunStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class PayrollCalculationStarted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PayrollCalculationStarted', tenantId: props.tenantId, aggregateType: 'PayrollCalculationRun', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PayrollCalculationValidated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PayrollCalculationValidated', tenantId: props.tenantId, aggregateType: 'PayrollCalculationRun', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PayrollCalculationFinalized extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PayrollCalculationFinalized', tenantId: props.tenantId, aggregateType: 'PayrollCalculationRun', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PayrollCalculationFailed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PayrollCalculationFailed', tenantId: props.tenantId, aggregateType: 'PayrollCalculationRun', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PayrollCalculationRun extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  payrollCycleId: Uuid;
  startedAt?: Date;
  completedAt?: Date;
  totalWorkers: number;
  totalGrossPay: number;
  totalNetPay: number;
  currency: string;
  status: PayrollCalculationRunStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: PayrollCalculationRunProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.payrollCycleId = props.payrollCycleId;
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
    this.totalWorkers = props.totalWorkers ?? 0;
    this.totalGrossPay = props.totalGrossPay ?? 0;
    this.totalNetPay = props.totalNetPay ?? 0;
    this.currency = props.currency;
    this.status = props.status ?? 'PENDING';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static start(props: PayrollCalculationRunProps, correlationId: Uuid): PayrollCalculationRun {
    Guard.againstEmptyString(props.currency, 'currency');
    const run = new PayrollCalculationRun({ ...props, status: 'PENDING', createdAt: new Date(), updatedAt: new Date() });
    run.addDomainEvent(new PayrollCalculationStarted({ tenantId: run.tenantId, aggregateId: run.id, correlationId }));
    return run;
  }

  validate(correlationId: Uuid): void {
    if (this.status !== 'PENDING' && this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot validate from ${this.status}`);
    this.status = 'VALIDATED';
    this.addDomainEvent(new PayrollCalculationValidated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  finalize(correlationId: Uuid): void {
    if (this.status !== 'VALIDATED') throw new ValidationError(`Cannot finalize from ${this.status}`);
    this.status = 'FINALIZED';
    this.completedAt = new Date();
    this.addDomainEvent(new PayrollCalculationFinalized({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  fail(correlationId: Uuid): void {
    if (this.status !== 'PENDING' && this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot fail from ${this.status}`);
    this.status = 'FAILED';
    this.addDomainEvent(new PayrollCalculationFailed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
