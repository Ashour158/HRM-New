import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';
import { nextReportRunAfter } from '../report-schedule-frequency.js';

export type ReportScheduleStatus = 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'CANCELLED';

export interface ReportScheduleProps {
  id: Uuid;
  tenantId: Uuid;
  reportDefinitionId: Uuid;
  frequency: string;
  recipients?: string[];
  nextRunAt?: Date;
  lastRunAt?: Date;
  status?: ReportScheduleStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ReportScheduleCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ReportScheduleCreated', tenantId: props.tenantId, aggregateType: 'ReportSchedule', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class ReportScheduleActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ReportScheduleActivated', tenantId: props.tenantId, aggregateType: 'ReportSchedule', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class ReportSchedulePaused extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ReportSchedulePaused', tenantId: props.tenantId, aggregateType: 'ReportSchedule', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class ReportScheduleExpired extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ReportScheduleExpired', tenantId: props.tenantId, aggregateType: 'ReportSchedule', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class ReportScheduleRunRecorded extends DomainEvent {
  readonly nextRunAt: string;

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; nextRunAt: Date }) {
    super({ eventName: 'ReportScheduleRunRecorded', tenantId: props.tenantId, aggregateType: 'ReportSchedule', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.nextRunAt = props.nextRunAt.toISOString();
  }
}

export class ReportSchedule extends AggregateRoot {
  readonly tenantId: Uuid;
  reportDefinitionId: Uuid;
  frequency: string;
  recipients: string[];
  nextRunAt?: Date;
  lastRunAt?: Date;
  status: ReportScheduleStatus;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number { return this.version; }

  constructor(props: ReportScheduleProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.reportDefinitionId = props.reportDefinitionId;
    this.frequency = props.frequency;
    this.recipients = props.recipients ?? [];
    this.nextRunAt = props.nextRunAt;
    this.lastRunAt = props.lastRunAt;
    this.status = props.status ?? 'ACTIVE';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this.restoreVersion(props.aggregateVersion);
  }

  static create(props: ReportScheduleProps, correlationId: Uuid): ReportSchedule {
    const sched = new ReportSchedule({ ...props, status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() });
    sched.addDomainEvent(new ReportScheduleCreated({ tenantId: sched.tenantId, aggregateId: sched.id, correlationId }));
    return sched;
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'PAUSED') throw new ValidationError(`Cannot activate from state ${this.status}`);
    this.status = 'ACTIVE';
    this.addDomainEvent(new ReportScheduleActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  pause(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot pause from state ${this.status}`);
    this.status = 'PAUSED';
    this.addDomainEvent(new ReportSchedulePaused({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  expire(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'PAUSED') throw new ValidationError(`Cannot expire from state ${this.status}`);
    this.status = 'EXPIRED';
    this.addDomainEvent(new ReportScheduleExpired({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  cancel(_correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'PAUSED') throw new ValidationError(`Cannot cancel from state ${this.status}`);
    this.status = 'CANCELLED';
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Records a completed firing and advances `nextRunAt`. The next run is
   * computed from the schedule's own previous `nextRunAt`, not from `ranAt`,
   * so a late-firing job doesn't drift every subsequent run later.
   */
  recordRun(ranAt: Date, correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot record a run from state ${this.status}`);
    const baseline = this.nextRunAt ?? ranAt;
    const nextRunAt = nextReportRunAfter(baseline, this.frequency);
    this.lastRunAt = ranAt;
    this.nextRunAt = nextRunAt;
    this.addDomainEvent(new ReportScheduleRunRecorded({ tenantId: this.tenantId, aggregateId: this.id, correlationId, nextRunAt }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
