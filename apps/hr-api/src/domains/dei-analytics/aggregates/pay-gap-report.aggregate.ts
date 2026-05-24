import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';

export type PayGapReportStatus = 'DRAFT' | 'CALCULATED' | 'REVIEWED' | 'PUBLISHED' | 'ARCHIVED';

export interface PayGapReportProps {
  id: Uuid;
  tenantId: Uuid;
  reportType: 'GENDER_PAY_GAP' | 'ETHNICITY_PAY_GAP';
  reportingYear: number;
  countryCode: string;
  meanHourlyGap?: number;
  medianHourlyGap?: number;
  quartileDistribution?: Record<string, unknown>;
  actionPlan?: Record<string, unknown>;
  status?: PayGapReportStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class PayGapReportCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PayGapReportCreated', tenantId: props.tenantId, aggregateType: 'PayGapReport', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class PayGapReportCalculated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PayGapReportCalculated', tenantId: props.tenantId, aggregateType: 'PayGapReport', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class PayGapReportReviewed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PayGapReportReviewed', tenantId: props.tenantId, aggregateType: 'PayGapReport', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class PayGapReportPublished extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PayGapReportPublished', tenantId: props.tenantId, aggregateType: 'PayGapReport', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PayGapReport extends AggregateRoot {
  readonly tenantId: Uuid;
  reportType: 'GENDER_PAY_GAP' | 'ETHNICITY_PAY_GAP';
  reportingYear: number;
  countryCode: string;
  meanHourlyGap?: number;
  medianHourlyGap?: number;
  quartileDistribution: Record<string, unknown>;
  actionPlan: Record<string, unknown>;
  status: PayGapReportStatus;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number { return this.version; }

  constructor(props: PayGapReportProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.reportType = props.reportType;
    this.reportingYear = props.reportingYear;
    this.countryCode = props.countryCode;
    this.meanHourlyGap = props.meanHourlyGap;
    this.medianHourlyGap = props.medianHourlyGap;
    this.quartileDistribution = props.quartileDistribution ?? {};
    this.actionPlan = props.actionPlan ?? {};
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this.restoreVersion(props.aggregateVersion);
  }

  static create(props: PayGapReportProps, correlationId: Uuid): PayGapReport {
    const r = new PayGapReport({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    r.addDomainEvent(new PayGapReportCreated({ tenantId: r.tenantId, aggregateId: r.id, correlationId }));
    return r;
  }

  calculate(correlationId: Uuid, meanHourlyGap: number, medianHourlyGap: number, quartileDistribution: Record<string, unknown>): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot calculate from state ${this.status}`);
    this.meanHourlyGap = meanHourlyGap;
    this.medianHourlyGap = medianHourlyGap;
    this.quartileDistribution = quartileDistribution;
    this.status = 'CALCULATED';
    this.addDomainEvent(new PayGapReportCalculated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  review(correlationId: Uuid): void {
    if (this.status !== 'CALCULATED') throw new ValidationError(`Cannot review from state ${this.status}`);
    this.status = 'REVIEWED';
    this.addDomainEvent(new PayGapReportReviewed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  publish(correlationId: Uuid): void {
    if (this.status !== 'REVIEWED') throw new ValidationError(`Cannot publish from state ${this.status}`);
    this.status = 'PUBLISHED';
    this.addDomainEvent(new PayGapReportPublished({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  archive(_correlationId: Uuid): void {
    if (this.status !== 'PUBLISHED') throw new ValidationError(`Cannot archive from state ${this.status}`);
    this.status = 'ARCHIVED';
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
