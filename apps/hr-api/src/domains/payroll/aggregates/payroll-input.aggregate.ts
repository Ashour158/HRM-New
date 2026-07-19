/**
 * @hrDataClassification HIGH_SENSITIVITY - payroll cycle, input, calculation, result-line, taxable, insurable, deduction, and net-pay fields.
 */
import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type PayrollInputStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CORRECTED';

export interface PayrollInputProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  payrollCycleId: Uuid;
  inputType: string;
  /** @hrDataClassification HIGH_SENSITIVITY */
  amount: number;
  currency: string;
  description?: string;
  status?: PayrollInputStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class PayrollInputSubmitted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PayrollInputSubmitted', tenantId: props.tenantId, aggregateType: 'PayrollInput', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PayrollInputApproved extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PayrollInputApproved', tenantId: props.tenantId, aggregateType: 'PayrollInput', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PayrollInputRejected extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PayrollInputRejected', tenantId: props.tenantId, aggregateType: 'PayrollInput', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PayrollInputCorrected extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PayrollInputCorrected', tenantId: props.tenantId, aggregateType: 'PayrollInput', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PayrollInput extends AggregateRoot {
  readonly tenantId: Uuid;
  workerId: Uuid;
  payrollCycleId: Uuid;
  inputType: string;
  /** @hrDataClassification HIGH_SENSITIVITY */
  amount: number;
  currency: string;
  description?: string;
  status: PayrollInputStatus;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number { return this.version; }

  constructor(props: PayrollInputProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.payrollCycleId = props.payrollCycleId;
    this.inputType = props.inputType;
    this.amount = props.amount;
    this.currency = props.currency;
    this.description = props.description;
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this.restoreVersion(props.aggregateVersion);
  }

  static create(props: PayrollInputProps, _correlationId: Uuid): PayrollInput {
    Guard.againstEmptyString(props.inputType, 'inputType');
    const pi = new PayrollInput({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    return pi;
  }

  submit(correlationId: Uuid): void {
    if (this.status !== 'DRAFT' && this.status !== 'CORRECTED') throw new ValidationError(`Cannot submit from ${this.status}`);
    this.status = 'SUBMITTED';
    this.addDomainEvent(new PayrollInputSubmitted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  approve(correlationId: Uuid): void {
    if (this.status !== 'SUBMITTED') throw new ValidationError(`Cannot approve from ${this.status}`);
    this.status = 'APPROVED';
    this.addDomainEvent(new PayrollInputApproved({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  reject(correlationId: Uuid): void {
    if (this.status !== 'SUBMITTED') throw new ValidationError(`Cannot reject from ${this.status}`);
    this.status = 'REJECTED';
    this.addDomainEvent(new PayrollInputRejected({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  correct(correlationId: Uuid): void {
    if (this.status !== 'REJECTED') throw new ValidationError(`Cannot correct from ${this.status}`);
    this.status = 'CORRECTED';
    this.addDomainEvent(new PayrollInputCorrected({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
