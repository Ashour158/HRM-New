import { AggregateRoot, DomainEvent, Uuid, Guard, ValidationError } from '@hcm/shared-kernel';

export type HrKnowledgeArticleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'DEPRECATED';

export interface HrKnowledgeArticleProps {
  id: Uuid;
  tenantId: Uuid;
  title: string;
  content: string;
  category: string;
  tags?: string[];
  viewCount?: number;
  status?: HrKnowledgeArticleStatus;
  aggregateVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class HrKnowledgeArticleCreated extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrKnowledgeArticleCreated', tenantId: props.tenantId, aggregateType: 'HrKnowledgeArticle', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class HrKnowledgeArticlePublished extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrKnowledgeArticlePublished', tenantId: props.tenantId, aggregateType: 'HrKnowledgeArticle', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class HrKnowledgeArticleArchived extends DomainEvent {
  constructor(props: { tenantId: Uuid; aggregateId: Uuid; correlationId: Uuid }) {
    super({ eventName: 'HrKnowledgeArticleArchived', tenantId: props.tenantId, aggregateType: 'HrKnowledgeArticle', aggregateId: props.aggregateId, correlationId: props.correlationId });
  }
}

export class HrKnowledgeArticle extends AggregateRoot {
  private _aggregateVersion = 0;
  readonly tenantId: Uuid;
  title: string;
  content: string;
  category: string;
  tags?: string[];
  viewCount: number;
  status: HrKnowledgeArticleStatus;
  createdAt: Date;
  updatedAt: Date;

  get version(): number { return this._aggregateVersion; }
  get aggregateVersion(): number { return this._aggregateVersion; }
  incrementVersion(): void { this._aggregateVersion++; }

  constructor(props: HrKnowledgeArticleProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.title = props.title;
    this.content = props.content;
    this.category = props.category;
    this.tags = props.tags;
    this.viewCount = props.viewCount ?? 0;
    this.status = props.status ?? 'DRAFT';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    if (props.aggregateVersion !== undefined) this._aggregateVersion = props.aggregateVersion;
  }

  static create(props: HrKnowledgeArticleProps, correlationId: Uuid): HrKnowledgeArticle {
    Guard.againstEmptyString(props.title, 'title');
    const ka = new HrKnowledgeArticle({ ...props, status: 'DRAFT', viewCount: 0, createdAt: new Date(), updatedAt: new Date() });
    ka.addDomainEvent(new HrKnowledgeArticleCreated({ tenantId: ka.tenantId, aggregateId: ka.id, correlationId }));
    return ka;
  }

  publish(correlationId: Uuid): void {
    if (this.status !== 'DRAFT') throw new ValidationError(`Cannot publish from ${this.status}`);
    this.status = 'PUBLISHED';
    this.addDomainEvent(new HrKnowledgeArticlePublished({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }

  archive(correlationId: Uuid): void {
    if (this.status !== 'DRAFT' && this.status !== 'PUBLISHED') throw new ValidationError(`Cannot archive from ${this.status}`);
    this.status = 'ARCHIVED';
    this.addDomainEvent(new HrKnowledgeArticleArchived({ tenantId: this.tenantId, aggregateId: this.id, correlationId }));
    this.incrementVersion();
    this.updatedAt = new Date();
  }
}
