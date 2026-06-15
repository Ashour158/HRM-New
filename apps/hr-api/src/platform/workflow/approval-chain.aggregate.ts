import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';

export type ApprovalChainStatus = 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
export type ApprovalStepState = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELEGATED' | 'ESCALATED' | 'EXPIRED';
export type ApprovalStepMode = 'SEQUENTIAL' | 'PARALLEL';
export type ApprovalApproverType = 'ROLE' | 'WORKER';

export interface ApprovalEscalationTier {
  code: string;
  label: string;
  approverRole?: string;
  approverWorkerId?: Uuid;
  afterHours: number;
}

export interface ApprovalStepDefinition {
  code: string;
  label: string;
  order: number;
  mode: ApprovalStepMode;
  approverType: ApprovalApproverType;
  approverRole?: string;
  approverWorkerId?: Uuid;
  slaDueAt?: Date;
  escalationTiers?: ApprovalEscalationTier[];
}

export interface ApprovalStepProps extends ApprovalStepDefinition {
  id: Uuid;
  state: ApprovalStepState;
  delegatedToWorkerId?: Uuid;
  escalationTierCode?: string;
  escalationTierLabel?: string;
  escalationApproverRole?: string;
  actedBy?: Uuid;
  actedAt?: Date;
  reason?: string;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ApprovalChainProps {
  id: Uuid;
  tenantId: Uuid;
  commandName: string;
  aggregateType: string;
  aggregateId?: Uuid;
  requestedBy: Uuid;
  commandEnvelope: unknown;
  status: ApprovalChainStatus;
  steps: ApprovalStepProps[];
  currentStepOrder?: number;
  correlationId: Uuid;
  idempotencyKey?: string;
  completedAt?: Date;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ApprovalChainRequested extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; commandName: string; aggregateType: string }) {
    super({
      eventName: 'ApprovalChainRequested',
      tenantId: props.tenantId,
      aggregateType: 'ApprovalChain',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    Object.assign(this, {
      commandName: props.commandName,
      governedAggregateType: props.aggregateType,
    });
  }
}

export class ApprovalStepApproved extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; stepId: Uuid }) {
    super({
      eventName: 'ApprovalStepApproved',
      tenantId: props.tenantId,
      aggregateType: 'ApprovalChain',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    Object.assign(this, { stepId: props.stepId.value });
  }
}

export class ApprovalChainCompleted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'ApprovalChainCompleted',
      tenantId: props.tenantId,
      aggregateType: 'ApprovalChain',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class ApprovalChain extends AggregateRoot {
  readonly tenantId: Uuid;
  commandName: string;
  aggregateType: string;
  aggregateId?: Uuid;
  requestedBy: Uuid;
  commandEnvelope: unknown;
  status: ApprovalChainStatus;
  steps: ApprovalStepProps[];
  currentStepOrder?: number;
  correlationId: Uuid;
  idempotencyKey?: string;
  completedAt?: Date;
  readonly createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number {
    return this.version;
  }

  constructor(props: ApprovalChainProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.commandName = props.commandName;
    this.aggregateType = props.aggregateType;
    this.aggregateId = props.aggregateId;
    this.requestedBy = props.requestedBy;
    this.commandEnvelope = props.commandEnvelope;
    this.status = props.status;
    this.steps = props.steps;
    this.currentStepOrder = props.currentStepOrder;
    this.correlationId = props.correlationId;
    this.idempotencyKey = props.idempotencyKey;
    this.completedAt = props.completedAt;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this.restoreVersion(props.aggregateVersion);
    }
  }

  static create(props: {
    id: Uuid;
    tenantId: Uuid;
    commandName: string;
    aggregateType: string;
    aggregateId?: Uuid;
    requestedBy: Uuid;
    commandEnvelope: unknown;
    steps: ApprovalStepDefinition[];
    correlationId: Uuid;
    idempotencyKey?: string;
  }): ApprovalChain {
    if (props.steps.length === 0) {
      throw new ValidationError('Approval chain requires at least one step');
    }
    const now = new Date();
    const steps = props.steps
      .slice()
      .sort((left, right) => left.order - right.order)
      .map<ApprovalStepProps>((step) => ({
        ...step,
        id: Uuid.generate(),
        state: 'PENDING',
        createdAt: now,
        updatedAt: now,
      }));
    const chain = new ApprovalChain({
      ...props,
      status: 'IN_PROGRESS',
      currentStepOrder: steps[0]?.order,
      steps,
      createdAt: now,
      updatedAt: now,
    });
    chain.addDomainEvent(new ApprovalChainRequested({
      tenantId: chain.tenantId,
      aggregateId: chain.id,
      correlationId: props.correlationId,
      commandName: props.commandName,
      aggregateType: props.aggregateType,
    }));
    return chain;
  }

  approveStep(stepId: Uuid, actorId: Uuid, reason?: string): void {
    this.assertActive();
    const step = this.findStep(stepId);
    if (!['PENDING', 'DELEGATED', 'ESCALATED'].includes(step.state)) {
      throw new ValidationError(`Cannot approve step from ${step.state}`);
    }
    if (!this.isStepActionable(step)) {
      throw new ValidationError('Earlier sequential approval steps are still pending');
    }
    step.state = 'APPROVED';
    step.actedBy = actorId;
    step.actedAt = new Date();
    step.reason = reason;
    step.updatedAt = new Date();
    this.updatedAt = new Date();
    this.incrementVersion();
    this.addDomainEvent(new ApprovalStepApproved({
      tenantId: this.tenantId,
      aggregateId: this.id,
      correlationId: this.correlationId,
      stepId,
    }));
    this.advanceStatus();
  }

  rejectStep(stepId: Uuid, actorId: Uuid, reason?: string): void {
    this.assertActive();
    const step = this.findStep(stepId);
    if (!['PENDING', 'DELEGATED', 'ESCALATED'].includes(step.state)) {
      throw new ValidationError(`Cannot reject step from ${step.state}`);
    }
    step.state = 'REJECTED';
    step.actedBy = actorId;
    step.actedAt = new Date();
    step.reason = reason;
    step.updatedAt = new Date();
    this.status = 'REJECTED';
    this.completedAt = new Date();
    this.updatedAt = new Date();
    this.incrementVersion();
  }

  delegateStep(stepId: Uuid, actorId: Uuid, delegateToWorkerId: Uuid, reason: string): void {
    this.assertActive();
    const step = this.findStep(stepId);
    if (!['PENDING', 'DELEGATED'].includes(step.state)) {
      throw new ValidationError(`Cannot delegate step from ${step.state}`);
    }
    step.state = 'DELEGATED';
    step.actedBy = actorId;
    step.delegatedToWorkerId = delegateToWorkerId;
    step.reason = reason;
    step.updatedAt = new Date();
    this.updatedAt = new Date();
    this.incrementVersion();
  }

  escalateOverdue(now: Date, actorId: Uuid): number {
    this.assertActive();
    let escalated = 0;
    for (const step of this.steps) {
      if (!['PENDING', 'DELEGATED'].includes(step.state)) continue;
      if (!step.slaDueAt || step.slaDueAt.getTime() > now.getTime()) continue;
      if (!this.isStepActionable(step)) continue;
      const tier = step.escalationTiers?.[0];
      if (!tier) continue;
      step.state = 'ESCALATED';
      step.escalationTierCode = tier.code;
      step.escalationTierLabel = tier.label;
      step.escalationApproverRole = tier.approverRole;
      step.actedBy = actorId;
      step.updatedAt = now;
      escalated += 1;
    }
    if (escalated > 0) {
      this.updatedAt = now;
      this.incrementVersion();
    }
    return escalated;
  }

  private advanceStatus(): void {
    if (this.steps.every((step) => step.state === 'APPROVED')) {
      this.status = 'APPROVED';
      this.completedAt = new Date();
      this.currentStepOrder = undefined;
      this.addDomainEvent(new ApprovalChainCompleted({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId: this.correlationId,
      }));
      return;
    }
    const next = this.steps.find((step) => step.state !== 'APPROVED');
    this.currentStepOrder = next?.order;
  }

  private assertActive(): void {
    if (this.status !== 'IN_PROGRESS') {
      throw new ValidationError(`Approval chain is ${this.status}`);
    }
  }

  private findStep(stepId: Uuid): ApprovalStepProps {
    const step = this.steps.find((candidate) => candidate.id.value === stepId.value);
    if (!step) {
      throw new ValidationError(`Approval step ${stepId.value} not found`);
    }
    return step;
  }

  private isStepActionable(step: ApprovalStepProps): boolean {
    if (step.mode === 'PARALLEL') return true;
    return this.steps
      .filter((candidate) => candidate.order < step.order && candidate.mode === 'SEQUENTIAL')
      .every((candidate) => candidate.state === 'APPROVED');
  }
}
