import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';

export type HrAiModelRunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface HrAiModelRunProps {
  id: Uuid;
  tenantId: Uuid;
  useCaseId: Uuid;
  modelVersion: string;
  inputDataSnapshot?: Record<string, unknown>;
  outputDataSnapshot?: Record<string, unknown>;
  runAt?: Date;
  completedAt?: Date;
  status?: HrAiModelRunStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class HrAiModelRunStarted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrAiModelRunStarted', tenantId: props.tenantId, aggregateType: 'HrAiModelRun', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class HrAiModelRunCompleted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrAiModelRunCompleted', tenantId: props.tenantId, aggregateType: 'HrAiModelRun', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class HrAiModelRunFailed extends DomainEvent {
  readonly reason: string;
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; reason: string }) {
    super({ eventName: 'HrAiModelRunFailed', tenantId: props.tenantId, aggregateType: 'HrAiModelRun', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.reason = props.reason;
  }
}

export class HrAiModelRun extends AggregateRoot {
  readonly tenantId: Uuid;
  useCaseId: Uuid;
  modelVersion: string;
  inputDataSnapshot: Record<string, unknown>;
  outputDataSnapshot: Record<string, unknown>;
  runAt?: Date;
  completedAt?: Date;
  status: HrAiModelRunStatus;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number { return this.version; }

  constructor(props: HrAiModelRunProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.useCaseId = props.useCaseId;
    this.modelVersion = props.modelVersion;
    this.inputDataSnapshot = props.inputDataSnapshot ?? {};
    this.outputDataSnapshot = props.outputDataSnapshot ?? {};
    this.runAt = props.runAt;
    this.completedAt = props.completedAt;
    this.status = props.status ?? 'PENDING';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this.restoreVersion(props.aggregateVersion);
  }

  static create(props: HrAiModelRunProps, _correlationId: Uuid): HrAiModelRun {
    const run = new HrAiModelRun({ ...props, status: 'PENDING', createdAt: new Date(), updatedAt: new Date() });
    return run;
  }

  start(correlationId: Uuid): void {
    if (this.status !== 'PENDING') throw new ValidationError(`Cannot start from state ${this.status}`);
    this.status = 'RUNNING';
    this.runAt = new Date();
    this.addDomainEvent(new HrAiModelRunStarted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  complete(correlationId: Uuid, outputDataSnapshot: Record<string, unknown>): void {
    if (this.status !== 'RUNNING') throw new ValidationError(`Cannot complete from state ${this.status}`);
    this.status = 'COMPLETED';
    this.outputDataSnapshot = outputDataSnapshot;
    this.completedAt = new Date();
    this.addDomainEvent(new HrAiModelRunCompleted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  fail(correlationId: Uuid, reason: string): void {
    if (!['PENDING', 'RUNNING'].includes(this.status)) throw new ValidationError(`Cannot fail from state ${this.status}`);
    this.status = 'FAILED';
    this.addDomainEvent(new HrAiModelRunFailed({ tenantId: this.tenantId, aggregateId: this.id, correlationId, reason }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
