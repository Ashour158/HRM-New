import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';

export type SkillProfileStatus = 'ACTIVE' | 'UNDER_REVIEW' | 'UPDATED' | 'ARCHIVED';

export interface SkillItem {
  skillId: string;
  proficiency: number;
  validatedBy?: Uuid;
  validatedAt?: Date;
}

export interface SkillProfileProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  skills?: SkillItem[];
  status?: SkillProfileStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class SkillProfileCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'SkillProfileCreated', tenantId: props.tenantId, aggregateType: 'SkillProfile', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class SkillProfileUpdated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'SkillProfileUpdated', tenantId: props.tenantId, aggregateType: 'SkillProfile', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class SkillProfileValidated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'SkillProfileValidated', tenantId: props.tenantId, aggregateType: 'SkillProfile', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class SkillProfileArchived extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'SkillProfileArchived', tenantId: props.tenantId, aggregateType: 'SkillProfile', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/**
 * SkillProfile aggregate tracks a worker's skills and proficiencies.
 */
export class SkillProfile extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  skills: SkillItem[];
  status: SkillProfileStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: SkillProfileProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.skills = props.skills ?? [];
    this.status = props.status ?? 'ACTIVE';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: SkillProfileProps, correlationId: Uuid): SkillProfile {
    const ar = new SkillProfile({ ...props, status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new SkillProfileCreated({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    return ar;
  }

  updateSkills(skills: SkillItem[], correlationId: Uuid): void {
    if (this.status === 'ARCHIVED') throw new ValidationError(`Cannot update skills from ${this.status}`);
    this.skills = skills;
    this.status = 'UPDATED';
    this.addDomainEvent(new SkillProfileUpdated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  validate(validatedBy: Uuid, correlationId: Uuid): void {
    if (this.status === 'ARCHIVED') throw new ValidationError(`Cannot validate from ${this.status}`);
    this.skills = this.skills.map((s) => ({ ...s, validatedBy, validatedAt: new Date() }));
    this.status = 'ACTIVE';
    this.addDomainEvent(new SkillProfileValidated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  archive(correlationId: Uuid): void {
    if (this.status === 'ARCHIVED') throw new ValidationError('Already archived');
    this.status = 'ARCHIVED';
    this.addDomainEvent(new SkillProfileArchived({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
