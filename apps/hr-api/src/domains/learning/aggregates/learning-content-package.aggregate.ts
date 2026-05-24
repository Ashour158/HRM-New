import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type LearningContentPackageStatus = 'UPLOADED' | 'PARSED' | 'VALIDATED' | 'PUBLISHED' | 'DEPRECATED';

export interface LearningContentPackageProps {
  id: Uuid;
  tenantId: Uuid;
  packageType: 'SCORM_1_2' | 'SCORM_2004' | 'XAPI';
  title: string;
  packageVersion?: string;
  fileUrl?: string;
  manifest?: Record<string, unknown>;
  status?: LearningContentPackageStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ContentPackageUploaded extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ContentPackageUploaded', tenantId: props.tenantId, aggregateType: 'LearningContentPackage', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class ContentPackageParsed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ContentPackageParsed', tenantId: props.tenantId, aggregateType: 'LearningContentPackage', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class ContentPackageValidated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ContentPackageValidated', tenantId: props.tenantId, aggregateType: 'LearningContentPackage', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class ContentPackagePublished extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ContentPackagePublished', tenantId: props.tenantId, aggregateType: 'LearningContentPackage', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class ContentPackageDeprecated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'ContentPackageDeprecated', tenantId: props.tenantId, aggregateType: 'LearningContentPackage', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/**
 * LearningContentPackage aggregate manages SCORM/xAPI content packages.
 */
export class LearningContentPackage extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  packageType: 'SCORM_1_2' | 'SCORM_2004' | 'XAPI';
  title: string;
  packageVersion?: string;
  fileUrl?: string;
  manifest?: Record<string, unknown>;
  status: LearningContentPackageStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: LearningContentPackageProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.packageType = props.packageType;
    this.title = props.title;
    this.packageVersion = props.packageVersion;
    this.fileUrl = props.fileUrl;
    this.manifest = props.manifest;
    this.status = props.status ?? 'UPLOADED';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: LearningContentPackageProps, correlationId: Uuid): LearningContentPackage {
    Guard.againstEmptyString(props.title, 'title');
    const ar = new LearningContentPackage({ ...props, status: 'UPLOADED', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new ContentPackageUploaded({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    return ar;
  }

  parse(correlationId: Uuid): void {
    if (this.status !== 'UPLOADED') throw new ValidationError(`Cannot parse from ${this.status}`);
    this.status = 'PARSED';
    this.addDomainEvent(new ContentPackageParsed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  validate(correlationId: Uuid): void {
    if (this.status !== 'PARSED') throw new ValidationError(`Cannot validate from ${this.status}`);
    this.status = 'VALIDATED';
    this.addDomainEvent(new ContentPackageValidated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  publish(correlationId: Uuid): void {
    if (this.status !== 'VALIDATED') throw new ValidationError(`Cannot publish from ${this.status}`);
    this.status = 'PUBLISHED';
    this.addDomainEvent(new ContentPackagePublished({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  deprecate(correlationId: Uuid): void {
    if (this.status !== 'PUBLISHED') throw new ValidationError(`Cannot deprecate from ${this.status}`);
    this.status = 'DEPRECATED';
    this.addDomainEvent(new ContentPackageDeprecated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
