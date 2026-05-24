import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type RecognitionProgramStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

export interface RecognitionProgramProps {
  id: Uuid;
  tenantId: Uuid;
  programName: string;
  programType: string;
  budget?: number;
  currency?: string;
  status?: RecognitionProgramStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class RecognitionProgramCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'RecognitionProgramCreated', tenantId: props.tenantId, aggregateType: 'RecognitionProgram', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class RecognitionProgramActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'RecognitionProgramActivated', tenantId: props.tenantId, aggregateType: 'RecognitionProgram', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class RecognitionProgramSuspended extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'RecognitionProgramSuspended', tenantId: props.tenantId, aggregateType: 'RecognitionProgram', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class RecognitionProgramClosed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'RecognitionProgramClosed', tenantId: props.tenantId, aggregateType: 'RecognitionProgram', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/**
 * RecognitionProgram aggregate manages employee recognition programs.
 */
export class RecognitionProgram extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  programName: string;
  programType: string;
  budget?: number;
  currency?: string;
  status: RecognitionProgramStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: RecognitionProgramProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.programName = props.programName;
    this.programType = props.programType;
    this.budget = props.budget;
    this.currency = props.currency;
    this.status = props.status ?? 'ACTIVE';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: RecognitionProgramProps, correlationId: Uuid): RecognitionProgram {
    Guard.againstEmptyString(props.programName, 'programName');
    Guard.againstEmptyString(props.programType, 'programType');
    const ar = new RecognitionProgram({ ...props, status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new RecognitionProgramCreated({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    return ar;
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'SUSPENDED') throw new ValidationError(`Cannot activate from ${this.status}`);
    this.status = 'ACTIVE';
    this.addDomainEvent(new RecognitionProgramActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  suspend(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot suspend from ${this.status}`);
    this.status = 'SUSPENDED';
    this.addDomainEvent(new RecognitionProgramSuspended({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  close(correlationId: Uuid): void {
    if (this.status === 'CLOSED') throw new ValidationError('Already closed');
    this.status = 'CLOSED';
    this.addDomainEvent(new RecognitionProgramClosed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
