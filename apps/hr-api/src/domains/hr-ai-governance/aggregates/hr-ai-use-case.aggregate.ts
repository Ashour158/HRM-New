import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';

export type HrAiUseCaseStatus = 'REGISTERED' | 'REVIEWED' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'RETIRED' | 'REJECTED';
export type RiskClassification = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNACCEPTABLE';

export interface HrAiUseCaseProps {
  id: Uuid;
  tenantId: Uuid;
  useCaseName: string;
  useCaseType: string;
  riskClassification: RiskClassification;
  description?: string;
  dataUsage?: Record<string, unknown>;
  humanOversightRequired?: boolean;
  status?: HrAiUseCaseStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class HrAiUseCaseRegistered extends DomainEvent {
  readonly useCaseName: string;
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; useCaseName: string }) {
    super({ eventName: 'HrAiUseCaseRegistered', tenantId: props.tenantId, aggregateType: 'HrAiUseCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.useCaseName = props.useCaseName;
  }
}
export class HrAiUseCaseReviewed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrAiUseCaseReviewed', tenantId: props.tenantId, aggregateType: 'HrAiUseCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class HrAiUseCaseApproved extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrAiUseCaseApproved', tenantId: props.tenantId, aggregateType: 'HrAiUseCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class HrAiUseCaseActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrAiUseCaseActivated', tenantId: props.tenantId, aggregateType: 'HrAiUseCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class HrAiUseCaseSuspended extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrAiUseCaseSuspended', tenantId: props.tenantId, aggregateType: 'HrAiUseCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class HrAiUseCaseRetired extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrAiUseCaseRetired', tenantId: props.tenantId, aggregateType: 'HrAiUseCase', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class HrAiUseCase extends AggregateRoot {
  readonly tenantId: Uuid;
  useCaseName: string;
  useCaseType: string;
  riskClassification: RiskClassification;
  description: string;
  dataUsage: Record<string, unknown>;
  humanOversightRequired: boolean;
  status: HrAiUseCaseStatus;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number { return this.version; }

  constructor(props: HrAiUseCaseProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.useCaseName = props.useCaseName;
    this.useCaseType = props.useCaseType;
    this.riskClassification = props.riskClassification;
    this.description = props.description ?? '';
    this.dataUsage = props.dataUsage ?? {};
    this.humanOversightRequired = props.humanOversightRequired ?? false;
    if (['HIGH', 'UNACCEPTABLE'].includes(this.riskClassification)) {
      this.humanOversightRequired = true;
    }
    this.status = props.status ?? 'REGISTERED';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this.restoreVersion(props.aggregateVersion);
  }

  static create(props: HrAiUseCaseProps, correlationId: Uuid): HrAiUseCase {
    const uc = new HrAiUseCase({ ...props, status: 'REGISTERED', createdAt: new Date(), updatedAt: new Date() });
    uc.addDomainEvent(new HrAiUseCaseRegistered({ tenantId: uc.tenantId, aggregateId: uc.id, correlationId, useCaseName: uc.useCaseName }));
    return uc;
  }

  review(correlationId: Uuid): void {
    if (this.status !== 'REGISTERED') throw new ValidationError(`Cannot review from state ${this.status}`);
    this.status = 'REVIEWED';
    this.addDomainEvent(new HrAiUseCaseReviewed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  approve(correlationId: Uuid): void {
    if (this.status !== 'REVIEWED') throw new ValidationError(`Cannot approve from state ${this.status}`);
    this.status = 'APPROVED';
    this.addDomainEvent(new HrAiUseCaseApproved({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'APPROVED') throw new ValidationError(`Cannot activate from state ${this.status}`);
    this.status = 'ACTIVE';
    this.addDomainEvent(new HrAiUseCaseActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  suspend(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot suspend from state ${this.status}`);
    this.status = 'SUSPENDED';
    this.addDomainEvent(new HrAiUseCaseSuspended({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  retire(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'SUSPENDED') throw new ValidationError(`Cannot retire from state ${this.status}`);
    this.status = 'RETIRED';
    this.addDomainEvent(new HrAiUseCaseRetired({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  reject(_correlationId: Uuid): void {
    if (this.status !== 'REVIEWED') throw new ValidationError(`Cannot reject from state ${this.status}`);
    this.status = 'REJECTED';
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
