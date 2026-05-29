import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type AbsenceRequestStatus = 'DRAFT' | 'SUBMITTED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type AbsenceDurationUnit = 'DAYS' | 'HOURS';
export type AbsencePayrollImpact = 'PAID_LEAVE' | 'UNPAID_LEAVE' | 'PERMISSION' | 'NO_PAYROLL_IMPACT';

export interface AbsenceRequestProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  absenceType: string;
  policyCode?: string;
  startDate: Date;
  endDate: Date;
  durationUnit?: AbsenceDurationUnit;
  durationAmount?: number;
  startTime?: string;
  endTime?: string;
  paid?: boolean;
  deductFromBalance?: boolean;
  payrollImpact?: AbsencePayrollImpact;
  calendarDays?: number;
  workingDays?: number;
  excludedHolidayDates?: string[];
  reason?: string;
  status?: AbsenceRequestStatus;
  submittedAt?: Date;
  approvedBy?: Uuid;
  approvedAt?: Date;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class AbsenceRequestSubmitted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'AbsenceRequestSubmitted', tenantId: props.tenantId, aggregateType: 'AbsenceRequest', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class AbsenceRequestApproved extends DomainEvent {
  readonly approvedBy: string;
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; approvedBy: Uuid }) {
    super({ eventName: 'AbsenceRequestApproved', tenantId: props.tenantId, aggregateType: 'AbsenceRequest', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.approvedBy = props.approvedBy.value;
  }
}

export class AbsenceRequestRejected extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'AbsenceRequestRejected', tenantId: props.tenantId, aggregateType: 'AbsenceRequest', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class AbsenceRequestCancelled extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'AbsenceRequestCancelled', tenantId: props.tenantId, aggregateType: 'AbsenceRequest', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class AbsenceRequest extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  absenceType: string;
  policyCode?: string;
  startDate: Date;
  endDate: Date;
  durationUnit: AbsenceDurationUnit;
  durationAmount: number;
  startTime?: string;
  endTime?: string;
  paid: boolean;
  deductFromBalance: boolean;
  payrollImpact: AbsencePayrollImpact;
  calendarDays: number;
  workingDays: number;
  excludedHolidayDates: string[];
  reason?: string;
  status: AbsenceRequestStatus;
  submittedAt?: Date;
  approvedBy?: Uuid;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: AbsenceRequestProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.absenceType = props.absenceType;
    this.policyCode = props.policyCode;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.durationUnit = props.durationUnit ?? 'DAYS';
    this.durationAmount = props.durationAmount ?? 0;
    this.startTime = props.startTime;
    this.endTime = props.endTime;
    this.paid = props.paid ?? true;
    this.deductFromBalance = props.deductFromBalance ?? true;
    this.payrollImpact = props.payrollImpact ?? 'PAID_LEAVE';
    this.calendarDays = props.calendarDays ?? 0;
    this.workingDays = props.workingDays ?? 0;
    this.excludedHolidayDates = props.excludedHolidayDates ?? [];
    this.reason = props.reason;
    this.status = props.status ?? 'DRAFT';
    this.submittedAt = props.submittedAt;
    this.approvedBy = props.approvedBy;
    this.approvedAt = props.approvedAt;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: AbsenceRequestProps, _correlationId: Uuid): AbsenceRequest {
    Guard.againstEmptyString(props.absenceType, 'absenceType');
    const ar = new AbsenceRequest({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    return ar;
  }

  submit(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot submit from ${this.status}`);
    this.status = 'PENDING_APPROVAL';
    this.submittedAt = new Date();
    this.addDomainEvent(new AbsenceRequestSubmitted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  approve(approvedBy: Uuid, correlationId: Uuid): void {
    if (this.status !== 'PENDING_APPROVAL') throw new ValidationError(`Cannot approve from ${this.status}`);
    this.status = 'APPROVED';
    this.approvedBy = approvedBy;
    this.approvedAt = new Date();
    this.addDomainEvent(new AbsenceRequestApproved({ tenantId: this.tenantId, aggregateId: this.id, correlationId, approvedBy }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  reject(correlationId: Uuid): void {
    if (this.status !== 'PENDING_APPROVAL') throw new ValidationError(`Cannot reject from ${this.status}`);
    this.status = 'REJECTED';
    this.addDomainEvent(new AbsenceRequestRejected({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  cancel(correlationId: Uuid): void {
    if (this.status !== 'DRAFT' && this.status !== 'PENDING_APPROVAL') throw new ValidationError(`Cannot cancel from ${this.status}`);
    this.status = 'CANCELLED';
    this.addDomainEvent(new AbsenceRequestCancelled({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
