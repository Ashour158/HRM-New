import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';

export type HrAiBiasTestStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface HrAiBiasTestProps {
  id: Uuid;
  tenantId: Uuid;
  useCaseId: Uuid;
  testType: string;
  testData?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  threshold?: number;
  passed?: boolean;
  executedAt?: Date;
  status?: HrAiBiasTestStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class HrAiBiasTestPlanned extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrAiBiasTestPlanned', tenantId: props.tenantId, aggregateType: 'HrAiBiasTest', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class HrAiBiasTestStarted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrAiBiasTestStarted', tenantId: props.tenantId, aggregateType: 'HrAiBiasTest', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class HrAiBiasTestCompleted extends DomainEvent {
  readonly passed: boolean;
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; passed: boolean }) {
    super({ eventName: 'HrAiBiasTestCompleted', tenantId: props.tenantId, aggregateType: 'HrAiBiasTest', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.passed = props.passed;
  }
}
export class HrAiBiasTestFailed extends DomainEvent {
  readonly reason: string;
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; reason: string }) {
    super({ eventName: 'HrAiBiasTestFailed', tenantId: props.tenantId, aggregateType: 'HrAiBiasTest', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.reason = props.reason;
  }
}

export class HrAiBiasTest extends AggregateRoot {
  readonly tenantId: Uuid;
  useCaseId: Uuid;
  testType: string;
  testData: Record<string, unknown>;
  metrics: Record<string, unknown>;
  threshold: number;
  passed: boolean;
  executedAt?: Date;
  status: HrAiBiasTestStatus;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number { return this.version; }

  constructor(props: HrAiBiasTestProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.useCaseId = props.useCaseId;
    this.testType = props.testType;
    this.testData = props.testData ?? {};
    this.metrics = props.metrics ?? {};
    this.threshold = props.threshold ?? 0.05;
    this.passed = props.passed ?? false;
    this.executedAt = props.executedAt;
    this.status = props.status ?? 'PLANNED';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this.restoreVersion(props.aggregateVersion);
  }

  static create(props: HrAiBiasTestProps, correlationId: Uuid): HrAiBiasTest {
    const bt = new HrAiBiasTest({ ...props, status: 'PLANNED', createdAt: new Date(), updatedAt: new Date() });
    bt.addDomainEvent(new HrAiBiasTestPlanned({ tenantId: bt.tenantId, aggregateId: bt.id, correlationId }));
    return bt;
  }

  start(correlationId: Uuid): void {
    if (this.status !== 'PLANNED') throw new ValidationError(`Cannot start from state ${this.status}`);
    this.status = 'IN_PROGRESS';
    this.addDomainEvent(new HrAiBiasTestStarted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  complete(correlationId: Uuid, passed: boolean, metrics: Record<string, unknown>): void {
    if (this.status !== 'IN_PROGRESS') throw new ValidationError(`Cannot complete from state ${this.status}`);
    this.status = 'COMPLETED';
    this.passed = passed;
    this.metrics = metrics;
    this.executedAt = new Date();
    this.addDomainEvent(new HrAiBiasTestCompleted({ tenantId: this.tenantId, aggregateId: this.id, correlationId, passed }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  fail(correlationId: Uuid, reason: string): void {
    if (!['PLANNED', 'IN_PROGRESS'].includes(this.status)) throw new ValidationError(`Cannot fail from state ${this.status}`);
    this.status = 'FAILED';
    this.addDomainEvent(new HrAiBiasTestFailed({ tenantId: this.tenantId, aggregateId: this.id, correlationId, reason }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
