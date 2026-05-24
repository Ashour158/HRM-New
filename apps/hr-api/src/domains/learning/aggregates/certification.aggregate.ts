import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type CertificationStatus = 'ACTIVE' | 'EXPIRED' | 'RENEWED' | 'REVOKED';

export interface CertificationProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  certificationName: string;
  issuingBody?: string;
  issueDate?: Date;
  expiryDate?: Date;
  renewalDate?: Date;
  credentialId?: string;
  status?: CertificationStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class CertificationGranted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CertificationGranted', tenantId: props.tenantId, aggregateType: 'Certification', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CertificationRenewed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CertificationRenewed', tenantId: props.tenantId, aggregateType: 'Certification', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CertificationExpired extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CertificationExpired', tenantId: props.tenantId, aggregateType: 'Certification', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CertificationRevoked extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CertificationRevoked', tenantId: props.tenantId, aggregateType: 'Certification', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

/**
 * Certification aggregate tracks worker certifications.
 */
export class Certification extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  workerId: Uuid;
  certificationName: string;
  issuingBody?: string;
  issueDate?: Date;
  expiryDate?: Date;
  renewalDate?: Date;
  credentialId?: string;
  status: CertificationStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: CertificationProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.certificationName = props.certificationName;
    this.issuingBody = props.issuingBody;
    this.issueDate = props.issueDate;
    this.expiryDate = props.expiryDate;
    this.renewalDate = props.renewalDate;
    this.credentialId = props.credentialId;
    this.status = props.status ?? 'ACTIVE';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: CertificationProps, correlationId: Uuid): Certification {
    Guard.againstEmptyString(props.certificationName, 'certificationName');
    const ar = new Certification({ ...props, status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() });
    ar.addDomainEvent(new CertificationGranted({ tenantId: ar.tenantId, aggregateId: ar.id, correlationId }));
    return ar;
  }

  renew(newExpiryDate: Date, correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'EXPIRED') throw new ValidationError(`Cannot renew from ${this.status}`);
    this.renewalDate = new Date();
    this.expiryDate = newExpiryDate;
    this.status = 'RENEWED';
    this.addDomainEvent(new CertificationRenewed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  expire(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE' && this.status !== 'RENEWED') throw new ValidationError(`Cannot expire from ${this.status}`);
    this.status = 'EXPIRED';
    this.addDomainEvent(new CertificationExpired({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  revoke(correlationId: Uuid): void {
    if (this.status === 'REVOKED') throw new ValidationError(`Cannot revoke from ${this.status}`);
    this.status = 'REVOKED';
    this.addDomainEvent(new CertificationRevoked({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
