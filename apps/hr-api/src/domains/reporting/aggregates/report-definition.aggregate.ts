import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';

export type ReportDefinitionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'DEPRECATED';

export interface ReportDefinitionProps {
  id: Uuid;
  tenantId: Uuid;
  reportName: string;
  reportType: string;
  dataSource: string;
  queryDefinition?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  schedule?: Record<string, unknown>;
  status?: ReportDefinitionStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ReportDefinitionCreated extends DomainEvent {
  readonly reportName: string;
  readonly reportType: string;
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; reportName: string; reportType: string }) {
    super({ eventName: 'ReportDefinitionCreated', tenantId: props.tenantId, aggregateType: 'ReportDefinition', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.reportName = props.reportName;
    this.reportType = props.reportType;
  }
}

export class ReportDefinitionPublished extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ReportDefinitionPublished', tenantId: props.tenantId, aggregateType: 'ReportDefinition', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class ReportDefinitionArchived extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ReportDefinitionArchived', tenantId: props.tenantId, aggregateType: 'ReportDefinition', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class ReportDefinition extends AggregateRoot {
  readonly tenantId: Uuid;
  reportName: string;
  reportType: string;
  dataSource: string;
  queryDefinition: Record<string, unknown>;
  parameters: Record<string, unknown>;
  schedule: Record<string, unknown>;
  status: ReportDefinitionStatus;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number { return this.version; }

  constructor(props: ReportDefinitionProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.reportName = props.reportName;
    this.reportType = props.reportType;
    this.dataSource = props.dataSource;
    this.queryDefinition = props.queryDefinition ?? {};
    this.parameters = props.parameters ?? {};
    this.schedule = props.schedule ?? {};
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this.restoreVersion(props.aggregateVersion);
  }

  static create(props: ReportDefinitionProps, correlationId: Uuid): ReportDefinition {
    const doc = new ReportDefinition({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    doc.addDomainEvent(new ReportDefinitionCreated({ tenantId: doc.tenantId, aggregateId: doc.id, correlationId, reportName: doc.reportName, reportType: doc.reportType }));
    return doc;
  }

  publish(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot publish from state ${this.status}`);
    this.status = 'PUBLISHED';
    this.addDomainEvent(new ReportDefinitionPublished({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  archive(correlationId: Uuid): void {
    if (this.status !== 'PUBLISHED') throw new ValidationError(`Cannot archive from state ${this.status}`);
    this.status = 'ARCHIVED';
    this.addDomainEvent(new ReportDefinitionArchived({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  deprecate(_correlationId: Uuid): void {
    if (this.status !== 'PUBLISHED' && this.status !== 'DRAFT') throw new ValidationError(`Cannot deprecate from state ${this.status}`);
    this.status = 'DEPRECATED';
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
