import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';

export type DeiReportStatus = 'DRAFT' | 'GENERATED' | 'REVIEWED' | 'PUBLISHED' | 'ARCHIVED';

export interface DeiReportProps {
  id: Uuid;
  tenantId: Uuid;
  reportType: string;
  reportingPeriod: string;
  countryCode: string;
  legalEntityId: Uuid;
  metrics?: Record<string, unknown>;
  aggregationThreshold?: number;
  suppressionApplied?: boolean;
  status?: DeiReportStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class DeiReportCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'DeiReportCreated', tenantId: props.tenantId, aggregateType: 'DeiReport', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class DeiReportGenerated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'DeiReportGenerated', tenantId: props.tenantId, aggregateType: 'DeiReport', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class DeiReportReviewed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'DeiReportReviewed', tenantId: props.tenantId, aggregateType: 'DeiReport', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class DeiReportPublished extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'DeiReportPublished', tenantId: props.tenantId, aggregateType: 'DeiReport', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class DeiReport extends AggregateRoot {
  readonly tenantId: Uuid;
  reportType: string;
  reportingPeriod: string;
  countryCode: string;
  legalEntityId: Uuid;
  metrics: Record<string, unknown>;
  aggregationThreshold: number;
  suppressionApplied: boolean;
  status: DeiReportStatus;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number { return this.version; }

  constructor(props: DeiReportProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.reportType = props.reportType;
    this.reportingPeriod = props.reportingPeriod;
    this.countryCode = props.countryCode;
    this.legalEntityId = props.legalEntityId;
    this.metrics = props.metrics ?? {};
    this.aggregationThreshold = props.aggregationThreshold ?? 5;
    this.suppressionApplied = props.suppressionApplied ?? false;
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this.restoreVersion(props.aggregateVersion);
  }

  static create(props: DeiReportProps, correlationId: Uuid): DeiReport {
    const r = new DeiReport({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    r.addDomainEvent(new DeiReportCreated({ tenantId: r.tenantId, aggregateId: r.id, correlationId }));
    return r;
  }

  generate(correlationId: Uuid, metrics: Record<string, unknown>): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot generate from state ${this.status}`);
    this.metrics = this.applySuppression(metrics, this.aggregationThreshold) as Record<string, unknown>;
    this.suppressionApplied = true;
    this.status = 'GENERATED';
    this.addDomainEvent(new DeiReportGenerated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  private applySuppression(data: unknown, threshold: number): unknown {
    if (Array.isArray(data)) return data.map((item) => this.applySuppression(item, threshold));
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        if ((k === 'count' || k === 'headcount') && typeof v === 'number' && v < threshold) {
          out[k] = 'SUPRESSED';
        } else {
          out[k] = this.applySuppression(v, threshold);
        }
      }
      return out;
    }
    return data;
  }

  review(correlationId: Uuid): void {
    if (this.status !== 'GENERATED') throw new ValidationError(`Cannot review from state ${this.status}`);
    this.status = 'REVIEWED';
    this.addDomainEvent(new DeiReportReviewed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  publish(correlationId: Uuid): void {
    if (this.status !== 'REVIEWED') throw new ValidationError(`Cannot publish from state ${this.status}`);
    this.status = 'PUBLISHED';
    this.addDomainEvent(new DeiReportPublished({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
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
