import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';
import { encryptPiiPayload, decryptPiiPayload } from '@hcm/platform-core';

export type PersonalDataRecordState = 'DRAFT' | 'ACTIVE' | 'SUPPRESSED' | 'DELETED';
export type DataCategory =
  | 'BASIC'
  | 'CONTACT'
  | 'BANKING'
  | 'TAX'
  | 'MEDICAL'
  | 'EMERGENCY_CONTACT'
  | 'DEPENDENT'
  | 'BACKGROUND'
  | 'COMPENSATION'
  | 'DOCUMENT'
  | 'WORK_AUTHORIZATION'
  | 'ASSET_ACCESS'
  | 'SKILLS'
  | 'CONSENT'
  | 'CUSTOM'
  | 'SPECIAL_CATEGORY';

export interface PersonalDataRecordProps {
  id: Uuid;
  tenantId: Uuid;
  workerId: Uuid;
  dataCategory: DataCategory;
  dataClassification: 'LOW' | 'CONFIDENTIAL' | 'HIGH_SENSITIVITY' | 'SPECIAL_CATEGORY' | 'LEGAL_HOLD';
  encryptedPayloadRef?: string;
  payload?: Record<string, unknown> | null;
  consentStatus: string;
  state: PersonalDataRecordState;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export class PersonalDataRecordCreated extends DomainEvent {
  readonly dataCategory: string;
  readonly dataClassification: string;

  constructor(props: {
    tenantId: Uuid;
    aggregateId: Uuid;
    correlationId: Uuid;
    dataCategory: DataCategory;
    dataClassification: string;
  }) {
    super({
      eventName: 'PersonalDataRecordCreated',
      tenantId: props.tenantId,
      aggregateType: 'PersonalDataRecord',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.dataCategory = props.dataCategory;
    this.dataClassification = props.dataClassification;
  }
}

export class PersonalDataRecordActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'PersonalDataRecordActivated',
      tenantId: props.tenantId,
      aggregateType: 'PersonalDataRecord',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class PersonalDataRecordUpdated extends DomainEvent {
  readonly fields: string[];

  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; fields: string[] }) {
    super({
      eventName: 'PersonalDataRecordUpdated',
      tenantId: props.tenantId,
      aggregateType: 'PersonalDataRecord',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
    this.fields = props.fields;
  }
}

export class PersonalDataRecordSuppressed extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'PersonalDataRecordSuppressed',
      tenantId: props.tenantId,
      aggregateType: 'PersonalDataRecord',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

export class PersonalDataRecordDeleted extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({
      eventName: 'PersonalDataRecordDeleted',
      tenantId: props.tenantId,
      aggregateType: 'PersonalDataRecord',
      aggregateId: props.aggregateId,
      correlationId: props.correlationId,
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate                                                          */
/* ------------------------------------------------------------------ */

/**
 * Represents a personal data record for a worker.
 * For SPECIAL_CATEGORY data, payload must be null and encryptedPayloadRef must be set.
 */
export class PersonalDataRecord extends AggregateRoot {
  private _aggregateVersion = 0;

  readonly tenantId: Uuid;
  readonly workerId: Uuid;
  dataCategory: DataCategory;
  dataClassification: 'LOW' | 'CONFIDENTIAL' | 'HIGH_SENSITIVITY' | 'SPECIAL_CATEGORY' | 'LEGAL_HOLD';
  /** @classification SPECIAL_CATEGORY — opaque AES-256-GCM ciphertext of the sensitive payload. */
  encryptedPayloadRef?: string;
  /** @classification CONFIDENTIAL..HIGH_SENSITIVITY — plaintext PII for non-SPECIAL_CATEGORY records only. */
  payload?: Record<string, unknown> | null;
  consentStatus: string;
  state: PersonalDataRecordState;
  createdAt: Date;
  updatedAt: Date;

  get version(): number {
    return this._aggregateVersion;
  }

  get aggregateVersion(): number {
    return this._aggregateVersion;
  }

  incrementVersion(): void {
    this._aggregateVersion++;
  }

  constructor(props: PersonalDataRecordProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.workerId = props.workerId;
    this.dataCategory = props.dataCategory;
    this.dataClassification = props.dataClassification;
    this.encryptedPayloadRef = props.encryptedPayloadRef;
    this.payload = props.payload;
    this.consentStatus = props.consentStatus;
    this.state = props.state;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) {
      this._aggregateVersion = props.aggregateVersion;
    }
  }

  static create(props: PersonalDataRecordProps, correlationId: Uuid): PersonalDataRecord {
    if (props.dataCategory === 'SPECIAL_CATEGORY') {
      if (props.payload !== null && props.payload !== undefined) {
        throw new ValidationError('SPECIAL_CATEGORY data must not contain a raw payload');
      }
      if (!props.encryptedPayloadRef) {
        throw new ValidationError('SPECIAL_CATEGORY data must have an encryptedPayloadRef');
      }
    }

    return PersonalDataRecord.#build(props, correlationId);
  }

  /**
   * Factory for SPECIAL_CATEGORY records that takes a plaintext sensitive
   * payload and encrypts it at rest into `encryptedPayloadRef`. The raw
   * payload is never persisted.
   */
  static createSpecialCategory(
    props: Omit<PersonalDataRecordProps, 'payload' | 'encryptedPayloadRef' | 'dataCategory'> & {
      sensitivePayload: Record<string, unknown>;
    },
    correlationId: Uuid,
  ): PersonalDataRecord {
    const { sensitivePayload, ...rest } = props;
    return PersonalDataRecord.#build(
      {
        ...rest,
        dataCategory: 'SPECIAL_CATEGORY',
        payload: null,
        encryptedPayloadRef: encryptPiiPayload(sensitivePayload),
      },
      correlationId,
    );
  }

  static #build(props: PersonalDataRecordProps, correlationId: Uuid): PersonalDataRecord {

    const record = new PersonalDataRecord({
      ...props,
      state: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    record.addDomainEvent(
      new PersonalDataRecordCreated({
        tenantId: record.tenantId,
        aggregateId: record.id,
        correlationId,
        dataCategory: record.dataCategory,
        dataClassification: record.dataClassification,
      }),
    );

    return record;
  }

  activate(correlationId: Uuid): void {
    if (this.state !== 'DRAFT') {
      throw new ValidationError(`Cannot activate personal data record from state ${this.state}`);
    }
    this.state = 'ACTIVE';
    this.addDomainEvent(
      new PersonalDataRecordActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  update(fields: Record<string, unknown>, correlationId: Uuid): void {
    if (this.state !== 'ACTIVE' && this.state !== 'DRAFT') {
      throw new ValidationError(`Cannot update personal data record from state ${this.state}`);
    }
    if (this.dataCategory === 'SPECIAL_CATEGORY') {
      throw new ValidationError('Cannot update SPECIAL_CATEGORY data directly');
    }
    this.payload = { ...(this.payload ?? {}), ...fields };
    this.addDomainEvent(
      new PersonalDataRecordUpdated({
        tenantId: this.tenantId,
        aggregateId: this.id,
        correlationId,
        fields: Object.keys(fields),
      }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  suppress(correlationId: Uuid): void {
    if (this.state === 'SUPPRESSED' || this.state === 'DELETED') {
      throw new ValidationError('Personal data record is already suppressed or deleted');
    }
    this.state = 'SUPPRESSED';
    this.addDomainEvent(
      new PersonalDataRecordSuppressed({ tenantId: this.tenantId, aggregateId: this.id, correlationId }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  deleteWithConsent(correlationId: Uuid): void {
    if (this.state === 'DELETED') {
      throw new ValidationError('Personal data record is already deleted');
    }
    this.state = 'DELETED';
    this.payload = null;
    this.encryptedPayloadRef = undefined;
    this.addDomainEvent(
      new PersonalDataRecordDeleted({ tenantId: this.tenantId, aggregateId: this.id, correlationId }),
    );
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  /**
   * Decrypt and return the SPECIAL_CATEGORY sensitive payload.
   *
   * Returns `undefined` once the record has been deleted (the ref is cleared).
   * Throws for non-special categories, whose payload is available directly.
   */
  readSensitivePayload(): Record<string, unknown> | undefined {
    if (this.dataCategory !== 'SPECIAL_CATEGORY') {
      throw new ValidationError('readSensitivePayload is only valid for SPECIAL_CATEGORY data');
    }
    if (this.state === 'DELETED' || !this.encryptedPayloadRef) {
      return undefined;
    }
    return decryptPiiPayload(this.encryptedPayloadRef);
  }
}
