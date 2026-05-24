import { AggregateRoot, DomainEvent, Uuid, ValidationError } from '@hcm/shared-kernel';

export type CalculatedFieldStatus = 'DRAFT' | 'ACTIVE' | 'DEPRECATED';

export interface CalculatedFieldProps {
  id: Uuid;
  tenantId: Uuid;
  fieldName: string;
  expression: string;
  dataType: string;
  sourceFields?: string[];
  status?: CalculatedFieldStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class CalculatedFieldCreated extends DomainEvent {
  readonly fieldName: string;
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid; fieldName: string }) {
    super({ eventName: 'CalculatedFieldCreated', tenantId: props.tenantId, aggregateType: 'CalculatedField', aggregateId: props.aggregateId, correlationId: props.correlationId });
    this.fieldName = props.fieldName;
  }
}
export class CalculatedFieldActivated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CalculatedFieldActivated', tenantId: props.tenantId, aggregateType: 'CalculatedField', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}
export class CalculatedFieldDeprecated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'CalculatedFieldDeprecated', tenantId: props.tenantId, aggregateType: 'CalculatedField', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class CalculatedField extends AggregateRoot {
  readonly tenantId: Uuid;
  fieldName: string;
  expression: string;
  dataType: string;
  sourceFields: string[];
  status: CalculatedFieldStatus;
  createdAt: Date;
  updatedAt: Date;

  get aggregateVersion(): number { return this.version; }

  constructor(props: CalculatedFieldProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.fieldName = props.fieldName;
    this.expression = props.expression;
    this.dataType = props.dataType;
    this.sourceFields = props.sourceFields ?? [];
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this.restoreVersion(props.aggregateVersion);
  }

  static create(props: CalculatedFieldProps, correlationId: Uuid): CalculatedField {
    const cf = new CalculatedField({ ...props, status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() });
    cf.addDomainEvent(new CalculatedFieldCreated({ tenantId: cf.tenantId, aggregateId: cf.id, correlationId, fieldName: cf.fieldName }));
    return cf;
  }

  activate(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot activate from state ${this.status}`);
    this.status = 'ACTIVE';
    this.addDomainEvent(new CalculatedFieldActivated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  deprecate(correlationId: Uuid): void {
    if (this.status !== 'ACTIVE') throw new ValidationError(`Cannot deprecate from state ${this.status}`);
    this.status = 'DEPRECATED';
    this.addDomainEvent(new CalculatedFieldDeprecated({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
