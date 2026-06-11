import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';

export type ReportExecutionStatus = 'PENDING' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface ReportExecutionProps {
  id: Uuid;
  tenantId: Uuid;
  reportDefinitionId: Uuid;
  executedBy: Uuid;
  parameters?: Record<string, unknown>;
  resultUrl?: string;
  resultPayload?: Record<string, unknown>;
  rowCount?: number;
  startedAt?: Date;
  completedAt?: Date;
  status?: ReportExecutionStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ReportExecutionPending extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ReportExecutionPending', tenantId: props.tenantId, aggregateType: 'ReportExecution', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class ReportExecutionQueued extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ReportExecutionQueued', tenantId: props.tenantId, aggregateType: 'ReportExecution', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class ReportExecutionStarted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ReportExecutionStarted', tenantId: props.tenantId, aggregateType: 'ReportExecution', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class ReportExecutionCompleted extends DomainEvent {
  readonly rowCount: number;
  readonly resultUrl: string;
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; rowCount: number; resultUrl: string }) {
    super({ eventName: 'ReportExecutionCompleted', tenantId: props.tenantId, aggregateType: 'ReportExecution', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.rowCount = props.rowCount;
    this.resultUrl = props.resultUrl;
  }
}
export class ReportExecutionFailed extends DomainEvent {
  readonly reason: string;
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; reason: string }) {
    super({ eventName: 'ReportExecutionFailed', tenantId: props.tenantId, aggregateType: 'ReportExecution', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.reason = props.reason;
  }
}

export class ReportExecution extends AggregateRoot {
  readonly tenantId: Uuid;
  reportDefinitionId: Uuid;
  executedBy: Uuid;
  parameters: Record<string, unknown>;
  resultUrl?: string;
  resultPayload?: Record<string, unknown>;
  rowCount?: number;
  startedAt?: Date;
  completedAt?: Date;
  status: ReportExecutionStatus;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number { return this.version; }

  constructor(props: ReportExecutionProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.reportDefinitionId = props.reportDefinitionId;
    this.executedBy = props.executedBy;
    this.parameters = props.parameters ?? {};
    this.resultUrl = props.resultUrl;
    this.resultPayload = props.resultPayload;
    this.rowCount = props.rowCount;
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
    this.status = props.status ?? 'PENDING';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this.restoreVersion(props.aggregateVersion);
  }

  static create(props: ReportExecutionProps, correlationId: Uuid): ReportExecution {
    const exec = new ReportExecution({ ...props, status: 'PENDING', createdAt: new Date(), updatedAt: new Date() });
    exec.addDomainEvent(new ReportExecutionPending({ tenantId: exec.tenantId, aggregateId: exec.id, correlationId }));
    return exec;
  }

  queue(_correlationId: Uuid): void {
    if (this.status !== 'PENDING') throw new ValidationError(`Cannot queue from state ${this.status}`);
    this.status = 'QUEUED';
    this.addDomainEvent(new ReportExecutionQueued({ tenantId: this.tenantId, aggregateId: this.id, correlationId: _correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  start(correlationId: Uuid): void {
    if (this.status !== 'QUEUED') throw new ValidationError(`Cannot start from state ${this.status}`);
    this.status = 'RUNNING';
    this.startedAt = new Date();
    this.addDomainEvent(new ReportExecutionStarted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  complete(correlationId: Uuid, resultUrl: string, rowCount: number, resultPayload?: Record<string, unknown>): void {
    if (this.status !== 'RUNNING') throw new ValidationError(`Cannot complete from state ${this.status}`);
    this.status = 'COMPLETED';
    this.resultUrl = resultUrl;
    this.resultPayload = resultPayload;
    this.rowCount = rowCount;
    this.completedAt = new Date();
    this.addDomainEvent(new ReportExecutionCompleted({ tenantId: this.tenantId, aggregateId: this.id, correlationId, rowCount, resultUrl }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  fail(correlationId: Uuid, reason: string): void {
    if (!['PENDING', 'QUEUED', 'RUNNING'].includes(this.status)) throw new ValidationError(`Cannot fail from state ${this.status}`);
    this.status = 'FAILED';
    this.addDomainEvent(new ReportExecutionFailed({ tenantId: this.tenantId, aggregateId: this.id, correlationId, reason }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  cancel(_correlationId: Uuid): void {
    if (!['PENDING', 'QUEUED'].includes(this.status)) throw new ValidationError(`Cannot cancel from state ${this.status}`);
    this.status = 'CANCELLED';
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
