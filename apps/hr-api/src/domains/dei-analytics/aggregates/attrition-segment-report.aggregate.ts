import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';
import { applyKAnonymitySuppression, DEFAULT_AGGREGATION_THRESHOLD } from './k-anonymity.js';

export type AttritionSegmentReportStatus = 'DRAFT' | 'GENERATED' | 'PUBLISHED' | 'ARCHIVED';

export interface AttritionSegmentReportProps {
  id: Uuid;
  tenantId: Uuid;
  reportPeriod: string;
  segmentType: string;
  segments?: Record<string, unknown>;
  status?: AttritionSegmentReportStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class AttritionSegmentReportCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'AttritionSegmentReportCreated', tenantId: props.tenantId, aggregateType: 'AttritionSegmentReport', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class AttritionSegmentReportGenerated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'AttritionSegmentReportGenerated', tenantId: props.tenantId, aggregateType: 'AttritionSegmentReport', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class AttritionSegmentReportPublished extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'AttritionSegmentReportPublished', tenantId: props.tenantId, aggregateType: 'AttritionSegmentReport', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class AttritionSegmentReport extends AggregateRoot {
  readonly tenantId: Uuid;
  reportPeriod: string;
  segmentType: string;
  segments: Record<string, unknown>;
  status: AttritionSegmentReportStatus;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number { return this.version; }

  constructor(props: AttritionSegmentReportProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.reportPeriod = props.reportPeriod;
    this.segmentType = props.segmentType;
    this.segments = props.segments ?? {};
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this.restoreVersion(props.aggregateVersion);
  }

  static create(props: AttritionSegmentReportProps, correlationId: Uuid): AttritionSegmentReport {
    const r = new AttritionSegmentReport({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    r.addDomainEvent(new AttritionSegmentReportCreated({ tenantId: r.tenantId, aggregateId: r.id, correlationId }));
    return r;
  }

  generate(correlationId: Uuid, segments: Record<string, unknown>): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot generate from state ${this.status}`);
    this.segments = applyKAnonymitySuppression(segments, DEFAULT_AGGREGATION_THRESHOLD) as Record<string, unknown>;
    this.status = 'GENERATED';
    this.addDomainEvent(new AttritionSegmentReportGenerated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  publish(correlationId: Uuid): void {
    if (this.status !== 'GENERATED') throw new ValidationError(`Cannot publish from state ${this.status}`);
    this.status = 'PUBLISHED';
    this.addDomainEvent(new AttritionSegmentReportPublished({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
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
