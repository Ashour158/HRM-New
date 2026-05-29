import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';

export type KpiMeasurementStatus = 'RECORDED' | 'VALIDATED' | 'ADJUSTED';

export interface KpiMeasurementProps {
  id: Uuid;
  tenantId: Uuid;
  kpiId: Uuid;
  periodStart: Date;
  periodEnd: Date;
  actualValue: number;
  targetValue?: number;
  variance?: number;
  variancePercentage?: number;
  status?: KpiMeasurementStatus;
  recordedBy?: Uuid;
  validatedBy?: Uuid;
  notes?: string;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class KpiMeasurementRecorded extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'KpiMeasurementRecorded', tenantId: props.tenantId, aggregateType: 'KpiMeasurement', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class KpiMeasurementValidated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'KpiMeasurementValidated', tenantId: props.tenantId, aggregateType: 'KpiMeasurement', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class KpiMeasurementAdjusted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'KpiMeasurementAdjusted', tenantId: props.tenantId, aggregateType: 'KpiMeasurement', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class KpiMeasurement extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  kpiId: Uuid;
  periodStart: Date;
  periodEnd: Date;
  actualValue: number;
  targetValue?: number;
  variance?: number;
  variancePercentage?: number;
  status: KpiMeasurementStatus;
  recordedBy?: Uuid;
  validatedBy?: Uuid;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: KpiMeasurementProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.kpiId = props.kpiId;
    this.periodStart = props.periodStart;
    this.periodEnd = props.periodEnd;
    this.actualValue = props.actualValue;
    this.targetValue = props.targetValue;
    this.variance = props.variance;
    this.variancePercentage = props.variancePercentage;
    this.status = props.status ?? 'RECORDED';
    this.recordedBy = props.recordedBy;
    this.validatedBy = props.validatedBy;
    this.notes = props.notes;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: KpiMeasurementProps, correlationId: Uuid): KpiMeasurement {
    const ar = new KpiMeasurement({ ...props, status: 'RECORDED', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new KpiMeasurementRecorded({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    return ar;
  }

  validate(validatedBy: Uuid, correlationId: Uuid): void {
    if (this.status !== 'RECORDED') throw new ValidationError(`Cannot validate from ${this.status}`);
    this.validatedBy = validatedBy;
    this.status = 'VALIDATED';
    this.addDomainEvent(new KpiMeasurementValidated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  adjust(actualValue: number, notes: string, correlationId: Uuid): void {
    if (this.status !== 'RECORDED' && this.status !== 'VALIDATED') throw new ValidationError(`Cannot adjust from ${this.status}`);
    this.actualValue = actualValue;
    this.notes = notes;
    this.status = 'ADJUSTED';
    this.addDomainEvent(new KpiMeasurementAdjusted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
