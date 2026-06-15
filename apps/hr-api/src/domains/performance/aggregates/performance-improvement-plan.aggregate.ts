/**
 * @hrDataClassification CONFIDENTIAL - review, rating, goal, competency, calibration, 360 feedback, PIP, and development-plan fields.
 */
import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';

export type PerformanceImprovementPlanStatus = 'DRAFT' | 'ACTIVE' | 'IN_PROGRESS' | 'REVIEW_PENDING' | 'COMPLETED' | 'CLOSED' | 'EXTENDED' | 'TERMINATED';

export interface PerformanceImprovementPlanProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  managerId: Uuid;
  objectives?: string[];
  currentPerformance?: {
    summary?: string;
    latestRating?: number;
    goalProgress?: number;
    peerFeedbackRating?: number;
  };
  planDurationDays?: number;
  milestones?: Array<{ day: number; title: string; target: string; status?: string }>;
  trackingMetrics?: Array<{ metric: string; current?: number; target: number; unit?: string }>;
  checkInCadence?: string;
  successCriteria?: string[];
  startDate?: Date;
  reviewDate?: Date;
  endDate?: Date;
  outcome?: string;
  status?: PerformanceImprovementPlanStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class PIPCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PIPCreated', tenantId: props.tenantId, aggregateType: 'PerformanceImprovementPlan', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PIPActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PIPActivated', tenantId: props.tenantId, aggregateType: 'PerformanceImprovementPlan', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PIPReviewPending extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PIPReviewPending', tenantId: props.tenantId, aggregateType: 'PerformanceImprovementPlan', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PIPCompleted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PIPCompleted', tenantId: props.tenantId, aggregateType: 'PerformanceImprovementPlan', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PIPClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PIPClosed', tenantId: props.tenantId, aggregateType: 'PerformanceImprovementPlan', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PIPExtended extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PIPExtended', tenantId: props.tenantId, aggregateType: 'PerformanceImprovementPlan', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PIPCheckpointRecorded extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PIPCheckpointRecorded', tenantId: props.tenantId, aggregateType: 'PerformanceImprovementPlan', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class PIPTerminated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'PIPTerminated', tenantId: props.tenantId, aggregateType: 'PerformanceImprovementPlan', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/**
 * PerformanceImprovementPlan (PIP) aggregate tracks worker improvement plans.
 */
export class PerformanceImprovementPlan extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  managerId: Uuid;
  objectives: string[];
  currentPerformance?: {
    summary?: string;
    latestRating?: number;
    goalProgress?: number;
    peerFeedbackRating?: number;
  };
  planDurationDays: number;
  milestones: Array<{ day: number; title: string; target: string; status?: string }>;
  trackingMetrics: Array<{ metric: string; current?: number; target: number; unit?: string }>;
  checkInCadence: string;
  successCriteria: string[];
  startDate?: Date;
  reviewDate?: Date;
  endDate?: Date;
  outcome?: string;
  status: PerformanceImprovementPlanStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: PerformanceImprovementPlanProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.managerId = props.managerId;
    this.objectives = props.objectives ?? [];
    this.currentPerformance = props.currentPerformance;
    this.planDurationDays = props.planDurationDays ?? 90;
    this.milestones = props.milestones ?? [];
    this.trackingMetrics = props.trackingMetrics ?? [];
    this.checkInCadence = props.checkInCadence ?? 'Weekly manager check-in';
    this.successCriteria = props.successCriteria ?? [];
    this.startDate = props.startDate;
    this.reviewDate = props.reviewDate;
    this.endDate = props.endDate;
    this.outcome = props.outcome;
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: PerformanceImprovementPlanProps, correlationId: Uuid): PerformanceImprovementPlan {
    const ar = new PerformanceImprovementPlan({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new PIPCreated({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    return ar;
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot activate from ${this.status}`);
    this.status = 'ACTIVE';
    this.addDomainEvent(new PIPActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  enterReview(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'IN_PROGRESS' && this.status !== 'EXTENDED') throw new ValidationError(`Cannot enter review from ${this.status}`);
    this.status = 'REVIEW_PENDING';
    this.addDomainEvent(new PIPReviewPending({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  complete(outcome: string, correlationId: Uuid): void {
    if (this.status !== 'REVIEW_PENDING') throw new ValidationError(`Cannot complete from ${this.status}`);
    this.outcome = outcome;
    this.status = 'COMPLETED';
    this.addDomainEvent(new PIPCompleted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  close(correlationId: Uuid): void {
    if (this.status !== 'COMPLETED') throw new ValidationError(`Cannot close from ${this.status}`);
    this.status = 'CLOSED';
    this.addDomainEvent(new PIPClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  extend(newEndDate: Date, correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'IN_PROGRESS' && this.status !== 'REVIEW_PENDING') throw new ValidationError(`Cannot extend from ${this.status}`);
    this.endDate = newEndDate;
    this.status = 'EXTENDED';
    this.addDomainEvent(new PIPExtended({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  recordCheckpoint(
    checkpoint: {
      milestoneTitle?: string;
      milestoneDay?: number;
      milestoneStatus?: string;
      metricUpdates?: Array<{ metric: string; current: number }>;
      note?: string;
    },
    correlationId: Uuid,
  ): void {
    if (!['ACTIVE', 'IN_PROGRESS', 'EXTENDED'].includes(this.status)) {
      throw new ValidationError(`Cannot record checkpoint from ${this.status}`);
    }

    if (checkpoint.milestoneTitle || checkpoint.milestoneDay !== undefined) {
      let matched = false;
      this.milestones = this.milestones.map((milestone) => {
        const titleMatches = checkpoint.milestoneTitle && milestone.title === checkpoint.milestoneTitle;
        const dayMatches = checkpoint.milestoneDay !== undefined && milestone.day === checkpoint.milestoneDay;
        if (!titleMatches && !dayMatches) return milestone;
        matched = true;
        return {
          ...milestone,
          status: checkpoint.milestoneStatus ?? milestone.status ?? 'CHECKED_IN',
        };
      });
      if (!matched) {
        throw new ValidationError('Checkpoint milestone was not found on the action plan');
      }
    }

    for (const update of checkpoint.metricUpdates ?? []) {
      let matched = false;
      this.trackingMetrics = this.trackingMetrics.map((metric) => {
        if (metric.metric !== update.metric) return metric;
        matched = true;
        return { ...metric, current: update.current };
      });
      if (!matched) {
        this.trackingMetrics.push({ metric: update.metric, current: update.current, target: update.current, unit: 'value' });
      }
    }

    if (checkpoint.note?.trim()) {
      this.successCriteria = [...this.successCriteria, `Checkpoint: ${checkpoint.note.trim()}`];
    }

    this.status = 'IN_PROGRESS';
    this.addDomainEvent(new PIPCheckpointRecorded({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  terminate(correlationId: Uuid): void {
    if (this.status === 'CLOSED' || this.status === 'TERMINATED') throw new ValidationError(`Cannot terminate from ${this.status}`);
    this.status = 'TERMINATED';
    this.addDomainEvent(new PIPTerminated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
